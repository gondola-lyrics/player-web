import type { TimeRange } from '@gondola-lyrics/model/common'
import type { TimeCue } from '@root/renderer/dom/timeline'

import { getTimeRangeProgress } from '@gondola-lyrics/model/common'

import { buildRootVariableKey } from '@root/renderer/dom/css'

const MASK_ACTIVE_OPACITY = `var(${buildRootVariableKey('mask-active-opacity')})`
const MASK_NORMAL_OPACITY = `var(${buildRootVariableKey('mask-normal-opacity')})`

export interface MaskWord {
  readonly wipe: HTMLElement
  readonly word: HTMLElement
  readonly range: TimeRange
}

interface MaskLayer {
  width: number
  left: number
  top: number
  height: number
}

interface MaskGeometry {
  width: number
  feather: number
  layers: MaskLayer[]
}

interface MaskPart extends MaskWord {
  geometry?: MaskGeometry
  start: number
  position?: number
}

interface MaskGroup {
  parts: MaskPart[]
  index: number
  time: number
}

const maskGradient = (width: number, feather: number): string => {
  const imageWidth = 2 * width + feather
  const bright = (width / imageWidth) * 100
  const dim = ((width + feather) / imageWidth) * 100
  return `linear-gradient(to right, rgba(0, 0, 0, ${MASK_ACTIVE_OPACITY}) ${bright}%, rgba(0, 0, 0, ${MASK_NORMAL_OPACITY}) ${dim}%)`
}

const measureWord = ({ word, wipe }: MaskWord): MaskGeometry => {
  const width = wipe.clientWidth
  const height = word.clientHeight
  const single = { width, feather: height * 0.5, layers: [] }
  if (width === 0 || height === 0) {
    return single
  }

  const rects: { left: number; right: number; top: number; bottom: number }[] = []
  if (word.children.length) {
    // Character offsets remain in layout coordinates while emphasis scales and lifts the glyphs.
    for (const char of Array.from(word.children) as HTMLElement[]) {
      rects.push({
        left: char.offsetLeft,
        right: char.offsetLeft + char.offsetWidth,
        top: char.offsetTop,
        bottom: char.offsetTop + char.offsetHeight,
      })
    }
  } else {
    const range = word.ownerDocument.createRange()
    range.selectNodeContents(word)
    const origin = word.getBoundingClientRect()
    const scaleX = origin.width / word.offsetWidth || 1
    const scaleY = origin.height / word.offsetHeight || 1
    for (const rect of range.getClientRects()) {
      if (rect.width > 0 && rect.height > 0) {
        rects.push({
          left: (rect.left - origin.left) / scaleX,
          right: (rect.right - origin.left) / scaleX,
          top: (rect.top - origin.top) / scaleY,
          bottom: (rect.bottom - origin.top) / scaleY,
        })
      }
    }
  }
  const rows: { left: number; right: number; top: number; bottom: number }[] = []
  for (const rect of rects) {
    const previous = rows.at(-1)
    const center = (rect.top + rect.bottom) / 2
    if (previous && center >= previous.top && center <= previous.bottom) {
      previous.left = Math.min(previous.left, rect.left)
      previous.right = Math.max(previous.right, rect.right)
      previous.top = Math.min(previous.top, rect.top)
      previous.bottom = Math.max(previous.bottom, rect.bottom)
    } else {
      rows.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })
    }
  }
  if (rows.length < 2) {
    return single
  }
  const leading = Math.max(0, rows[0]!.left)
  const trailing = Math.max(0, width - Math.max(...rows.map((row) => row.right)))
  let top = 0
  const layers = rows.map((row, index) => {
    const next = rows[index + 1]
    const bottom = next ? (row.bottom + next.top) / 2 : height
    const left = Math.max(0, row.left - leading)
    const layer = { width: row.right - row.left + leading + trailing, left, top, height: bottom - top }
    top = bottom
    return layer
  })
  const virtualWidth = layers.reduce((sum, layer) => sum + layer.width, 0)
  return { width: virtualWidth, feather: (height / layers.length) * 0.5, layers }
}

const applyGeometry = (part: MaskPart, geometry: MaskGeometry) => {
  part.geometry = geometry
  part.position = undefined
  if (geometry.width === 0) {
    return
  }
  const { width, feather, layers } = geometry
  const style = part.wipe.style
  if (layers.length === 0) {
    style.maskImage = maskGradient(width, feather)
    style.maskSize = `${(2 + feather / width) * 100}% 100%`
  } else {
    style.maskImage = layers.map((layer) => maskGradient(layer.width, feather)).join(', ')
    style.maskSize = layers.map((layer) => `${2 * layer.width + feather}px ${layer.height}px`).join(', ')
  }
}

const paintWord = (part: MaskPart, cursor: number) => {
  const geometry = part.geometry
  if (!geometry || geometry.width === 0) {
    return
  }
  const { width, feather, layers } = geometry
  const position = Math.min(0, Math.max(-width - feather, cursor - part.start - width - 2 * feather))
  if (position === part.position) {
    return
  }
  part.position = position
  if (layers.length === 0) {
    part.wipe.style.maskPosition = `${position}px 0`
    return
  }
  let remaining = width
  part.wipe.style.maskPosition = layers
    .map((layer) => {
      remaining -= layer.width
      const offset = Math.min(0, Math.max(-layer.width - feather, position + remaining))
      return `${layer.left + offset}px ${layer.top}px`
    })
    .join(', ')
}

export class MaskAnimationHost {
  readonly cues: TimeCue[] = []

  private readonly groups: MaskGroup[] = []

  /**
   * Shares one feathered wipe across sequential words and gives overlapping voices their own cursor.
   */
  constructor(words: readonly MaskWord[], lineTime?: TimeRange) {
    for (const word of words) {
      let group = this.groups.at(-1)
      const previous = group?.parts.at(-1)?.range
      if (!group || !previous || word.range.start < (previous.end ?? previous.start)) {
        group = { parts: [], index: 0, time: -Infinity }
        this.groups.push(group)
      }
      group.parts.push({ ...word, start: 0 })
    }
    for (const group of this.groups) {
      const sync = (time: number) => {
        const sample = time < (lineTime?.start ?? -Infinity) ? -Infinity : time >= (lineTime?.end ?? Infinity) ? Infinity : time
        if (sample !== group.time) {
          this.paintGroup(group, sample)
        }
      }
      for (const { range } of group.parts) {
        this.cues.push({
          range,
          update: (time) => {
            sync(time)
            return range.end !== undefined && time >= range.start && time < range.end
          },
        })
      }
      if (lineTime) {
        this.cues.push({
          range: lineTime,
          update: (time) => {
            sync(time)
            return false
          },
        })
      }
    }
  }

  /**
   * Rebuilds word-width prefixes after layout and restores the last sampled clock, including during pauses.
   */
  measure() {
    for (const group of this.groups) {
      const geometry = group.parts.map(measureWord)
      let width = 0
      for (const [index, part] of group.parts.entries()) {
        const measured = geometry[index]!
        part.start = width
        width += measured.width
        applyGeometry(part, measured)
      }
      this.paintGroup(group, group.time)
    }
  }

  private paintGroup(group: MaskGroup, time: number) {
    group.time = time
    const parts = group.parts
    while (group.index > 0 && time < parts[group.index]!.range.start) {
      group.index--
    }
    while (group.index + 1 < parts.length && time >= parts[group.index + 1]!.range.start) {
      group.index++
    }
    const part = parts[group.index]!
    const { range } = part
    const progress = getTimeRangeProgress(range, time) ?? Number(time >= range.start)
    const distance = part.start + (part.geometry?.width ?? 0) * progress
    const entry = group.index === 0 ? progress : 1
    const exit = group.index === parts.length - 1 ? progress : 0
    for (const target of parts) {
      const feather = target.geometry?.feather ?? 0
      paintWord(target, distance + feather * (1.5 * entry + 0.5 * exit))
    }
  }
}

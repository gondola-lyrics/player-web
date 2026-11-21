import type { RenderChanges } from '@root/renderer/common/types'
import type { DomRendererConfigKeys } from '@root/renderer/dom/config'
import type { RenderContext } from '@root/renderer/dom/context'
import type { RenderMode } from '@root/renderer/dom/modes/types'

import { TimingLevel } from '@gondola-lyrics/model/common'

import { LineObject } from '@root/renderer/dom/components/line/line'
import { buildClassName, buildLineVariableKey, buildRootVariableKey } from '@root/renderer/dom/css'
import { RenderTimeline } from '@root/renderer/dom/timeline'

import { DEFAULT } from './config'
import { ListScroll } from './scroll'

const LAYOUT_GAP = buildRootVariableKey('layout-gap')
const LINE_POSITION = buildLineVariableKey('line-position')

export class ListMode implements RenderMode {
  private readonly element: HTMLDivElement
  private readonly content: HTMLDivElement
  private readonly observer: ResizeObserver
  private readonly scroll: ListScroll
  private readonly timeline = new RenderTimeline()
  private fonts: FontFaceSet
  private lines: LineObject[] = []
  private focusIndex = 0
  private layoutDirty = true
  private isDisposed = false

  /**
   * Mounts into the shared container immediately; content arrives with the first update.
   */
  constructor(private readonly context: RenderContext) {
    this.element = context.document.createElement('div')
    this.element.className = buildClassName('container')
    this.element.dataset.role = 'container'
    this.element.tabIndex = 0
    this.element.setAttribute('role', 'group')
    this.element.setAttribute('aria-label', 'Lyrics')
    this.element.addEventListener('keydown', this.handleKeyDown)
    this.element.addEventListener('focusin', this.handleFocusIn)
    this.content = context.document.createElement('div')
    this.content.className = buildClassName('list-content')
    this.element.appendChild(this.content)
    context.container.element.appendChild(this.element)
    this.scroll = new ListScroll(this.element, context.requestUpdate)
    this.observer = new ResizeObserver(this.handleSizeChange)
    this.fonts = context.document.fonts
    this.fonts.addEventListener('loadingdone', this.handleSizeChange)
  }

  private handleFocusIn = (event: FocusEvent) => {
    const index = this.lines.findIndex((line) => line.element === event.target)
    if (index !== -1) {
      this.setFocusIndex(index)
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || this.lines.length === 0) {
      return
    }
    const index = this.lines.findIndex((line) => line.element === event.target)
    if (index === -1 && event.target !== this.element) {
      return
    }
    let next = index === -1 ? this.focusIndex : index
    switch (event.key) {
      case 'ArrowUp':
        next--
        break
      case 'ArrowDown':
        next++
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = this.lines.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    this.setFocusIndex(next)
    const line = this.lines[this.focusIndex]!
    this.scroll.browse()
    line.element.focus({ preventScroll: true })
    const top = line.element.offsetTop
    const bottom = top + line.element.offsetHeight
    const current = this.element.scrollTop
    const target = top < current ? top : bottom > current + this.element.clientHeight ? Math.min(top, bottom - this.element.clientHeight) : current
    this.element.scrollTo({ top: target, behavior: 'instant' })
  }

  private setFocusIndex(index: number) {
    this.focusIndex = Math.min(this.lines.length - 1, Math.max(0, index))
    this.element.tabIndex = this.lines.length === 0 ? 0 : -1
    for (const [position, line] of this.lines.entries()) {
      line.element.tabIndex = position === this.focusIndex ? 0 : -1
    }
  }

  private handleSizeChange = () => {
    if (!this.isDisposed) {
      this.layoutDirty = true
      this.context.requestUpdate()
    }
  }

  private rebuildLines() {
    this.observer.disconnect()
    for (const line of this.lines) {
      line.dispose()
    }
    const { document, player, config, onLineClick, onLineContextMenu } = this.context
    this.lines = player.currentInfo.lines.map((line, index) => {
      return new LineObject(document, line, index, config.current.line, { click: onLineClick, contextMenu: onLineContextMenu })
    })
    this.content.replaceChildren(...this.lines.map((line) => line.element))
    for (const line of this.lines) {
      this.observer.observe(line.element)
    }
    this.setFocusIndex(this.context.player.activeIndexes[0] ?? 0)
    this.element.scrollTo({ top: 0, behavior: 'instant' })
    this.scroll.reset()
    this.layoutDirty = true
  }

  /**
   * Keeps native scrolling independent of line state, so browsing does not change which lyrics are active.
   */
  update(changes: RenderChanges<DomRendererConfigKeys>) {
    if (this.isDisposed) {
      return
    }
    const { currentInfo, activeIndexes, currentIndexes } = this.context.player
    const config = this.context.config.current
    const list = config.modes.list
    const hasTiming = currentInfo.timing === TimingLevel.LINE || currentInfo.timing === TimingLevel.WORD
    const fonts = this.context.document.fonts
    if (fonts !== this.fonts) {
      this.fonts.removeEventListener('loadingdone', this.handleSizeChange)
      this.fonts = fonts
      this.fonts.addEventListener('loadingdone', this.handleSizeChange)
      this.layoutDirty = true
    }
    this.scroll.updateConfig(list.scroll, hasTiming)

    if (changes.lyric) {
      this.rebuildLines()
    } else if (changes.config.has('line')) {
      for (const line of this.lines) {
        line.updateConfig(config.line)
      }
      this.layoutDirty = true
    }
    if (changes.lyric || changes.config.has('line.words.enabled')) {
      this.timeline.replace(this.lines.flatMap((line) => line.timeCues))
    }
    if (changes.seek) {
      this.scroll.reset()
    }
    const gap = Number.isFinite(list.gap) ? Math.max(0, list.gap) : DEFAULT.gap
    this.content.style.setProperty(LAYOUT_GAP, `${gap}px`)
    this.content.style.textAlign = list.align

    const active = new Set(activeIndexes)
    const current = new Set(currentIndexes)
    const lyricTime = this.context.player.currentTime + this.context.player.currentOffset
    for (const [index, line] of this.lines.entries()) {
      line.element.setAttribute('position', list.align)
      line.element.style.setProperty(LINE_POSITION, list.align)
      line.updateState(active.has(index), current.has(index), lyricTime)
    }
    if (!this.element.matches(':focus-within')) {
      this.setFocusIndex(activeIndexes[0] ?? 0)
    }

    const height = this.element.clientHeight
    const anchor = Number.isFinite(list.scroll.anchor) ? Math.min(100, Math.max(0, list.scroll.anchor)) : DEFAULT.scroll.anchor
    const targetY = (height * anchor) / 100
    if (this.layoutDirty || changes.size || changes.config.has('modes.list')) {
      for (const line of this.lines) {
        line.measureWords()
      }
      const first = this.lines[0]?.measure()
      const last = this.lines[this.lines.length - 1]?.measure()
      const follow = hasTiming && list.scroll.follow
      this.content.style.paddingBlockStart = `${follow && first ? Math.max(0, targetY - first.anchorY) : 0}px`
      this.content.style.paddingBlockEnd = `${follow && last ? Math.max(0, height - targetY - (last.height - last.anchorY)) : 0}px`
      this.layoutDirty = height === 0
    }
    const anchorLine = this.lines[activeIndexes[0] ?? 0]
    if (anchorLine && height > 0) {
      this.scroll.follow(anchorLine.element.offsetTop + anchorLine.measure().anchorY - targetY)
    }
  }

  /**
   * Paints timed text independently of list measurement, focus and scroll following.
   */
  updateTime(lyricTime: number): number {
    return this.timeline.updateTime(lyricTime)
  }

  /**
   * Detaches only this mode's nodes; the container is reused by the next mode.
   */
  dispose() {
    this.isDisposed = true
    this.observer.disconnect()
    this.fonts.removeEventListener('loadingdone', this.handleSizeChange)
    this.element.removeEventListener('keydown', this.handleKeyDown)
    this.element.removeEventListener('focusin', this.handleFocusIn)
    this.scroll.dispose()
    this.timeline.replace([])
    for (const line of this.lines) {
      line.dispose()
    }
    this.lines = []
    this.element.remove()
  }
}

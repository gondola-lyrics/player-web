import type { RenderChanges } from '@root/renderer/common/types'
import type { DomRendererConfigKeys } from '@root/renderer/dom/config'
import type { RenderContext } from '@root/renderer/dom/context'
import type { RenderMode } from '@root/renderer/dom/modes/types'
import type { ListModeConfigRequired } from './config'

import { TimingLevel } from '@gondola-lyrics/model/common'

import { buildClassName, buildLineVariableKey } from '@root/renderer/dom/css'
import { DEFAULT as LINE_DEFAULT } from '@root/renderer/dom/components/line/config'
import { LineElement } from '@root/renderer/dom/components/line/line'
import { DEFAULT as WORD_DEFAULT } from '@root/renderer/dom/components/word/config'
import { RenderTimeline } from '@root/renderer/dom/timeline'

import { DEFAULT } from './config'
import { ListLayout } from './layout'
import { ListScroll } from './scroll'

const LINE_POSITION = buildLineVariableKey('line-position')

export class ListMode implements RenderMode {
  private readonly element: HTMLDivElement
  private readonly content: HTMLDivElement
  private readonly observer: ResizeObserver
  private readonly layout: ListLayout
  private readonly scroll: ListScroll
  private readonly timeline = new RenderTimeline()
  private fonts: FontFaceSet
  private lineConfig = LINE_DEFAULT
  private wordConfig = WORD_DEFAULT
  private lines: LineElement[] = []
  private alignment?: ListModeConfigRequired['align']
  private layoutDirty = true
  private isDisposed = false

  constructor(private readonly context: RenderContext) {
    this.element = context.document.createElement('div')
    this.element.className = buildClassName('container')
    this.element.dataset.role = 'container'
    this.element.setAttribute('role', 'group')
    this.element.setAttribute('aria-label', 'Lyrics')

    this.content = context.document.createElement('div')
    this.content.className = buildClassName('list-content')
    this.element.appendChild(this.content)
    context.container.element.appendChild(this.element)

    this.layout = new ListLayout(this.content)
    this.scroll = new ListScroll(this.element, context.requestUpdate)
    this.observer = new ResizeObserver(this.handleSizeChange)
    this.fonts = context.document.fonts
    this.fonts.addEventListener('loadingdone', this.handleSizeChange)
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

    const { document, player, onLineClick, onLineContextMenu } = this.context
    this.lines = player.currentInfo.lines.map((line, index) => {
      return new LineElement(document, line, index, this.lineConfig, this.wordConfig, {
        click: onLineClick,
        contextMenu: onLineContextMenu,
      })
    })
    this.content.replaceChildren(...this.lines.map((line) => line.element))
    this.alignment = undefined
    for (const line of this.lines) {
      this.observer.observe(line.element)
    }

    this.scroll.reset(0)
    this.layoutDirty = true
  }

  private syncFonts() {
    const fonts = this.context.document.fonts
    if (fonts === this.fonts) {
      return
    }

    this.fonts.removeEventListener('loadingdone', this.handleSizeChange)
    this.fonts = fonts
    this.fonts.addEventListener('loadingdone', this.handleSizeChange)
    this.layoutDirty = true
  }

  private readLineConfig() {
    const config = this.context.config
    return {
      font: {
        size: config.resolve('modes.list.line.font.size', 'common.line.font.size'),
        family: config.resolve('modes.list.line.font.family', 'common.line.font.family'),
        weight: config.resolve('modes.list.line.font.weight', 'common.line.font.weight'),
      },
      style: {
        normal: {
          color: config.resolve('modes.list.line.style.normal.color', 'common.line.style.normal.color'),
          opacity: config.resolve('modes.list.line.style.normal.opacity', 'common.line.style.normal.opacity'),
        },
        active: {
          color: config.resolve('modes.list.line.style.active.color', 'common.line.style.active.color'),
          opacity: config.resolve('modes.list.line.style.active.opacity', 'common.line.style.active.opacity'),
        },
        played: {
          color: config.resolve('modes.list.line.style.played.color', 'common.line.style.played.color'),
          opacity: config.resolve('modes.list.line.style.played.opacity', 'common.line.style.played.opacity'),
        },
      },
    }
  }

  private syncContent(changes: RenderChanges<DomRendererConfigKeys>) {
    this.syncFonts()

    let lineChanged = false
    let fontChanged = false
    if (changes.lyric || changes.config.has('common.line') || changes.config.has('modes.list.line')) {
      const next = this.readLineConfig()
      const previous = this.lineConfig
      fontChanged = next.font.size !== previous.font.size || next.font.family !== previous.font.family || next.font.weight !== previous.font.weight
      lineChanged =
        fontChanged ||
        (['normal', 'active', 'played'] as const).some((state) => {
          return next.style[state].color !== previous.style[state].color || next.style[state].opacity !== previous.style[state].opacity
        })
      if (lineChanged) {
        this.lineConfig = next
      }
    }

    const enabled = this.context.config.resolve('modes.list.word.enabled', 'common.word.enabled')
    const wordChanged = enabled !== this.wordConfig.enabled
    if (wordChanged) {
      this.wordConfig = { enabled }
    }

    if (changes.lyric) {
      this.rebuildLines()
    } else if (lineChanged || wordChanged) {
      for (const line of this.lines) {
        line.updateConfig(this.lineConfig, this.wordConfig)
      }
      this.layoutDirty ||= fontChanged || wordChanged
    }

    if (changes.lyric || wordChanged) {
      this.timeline.replace(this.lines.flatMap((line) => line.timeCues))
    }
  }

  private updateAlignment(align: ListModeConfigRequired['align']) {
    if (align === this.alignment) {
      return
    }

    this.content.style.textAlign = align
    for (const line of this.lines) {
      line.element.setAttribute('position', align)
      line.element.style.setProperty(LINE_POSITION, align)
    }
    this.alignment = align
  }

  private updateLineState(activeIndexes: readonly number[], currentIndexes: readonly number[]) {
    const active = new Set(activeIndexes)
    const current = new Set(currentIndexes)
    const lyricTime = this.context.player.currentTime + this.context.player.currentOffset

    for (const [index, line] of this.lines.entries()) {
      line.updateState(active.has(index), current.has(index), lyricTime)
    }
  }

  private updateLayout(changes: RenderChanges<DomRendererConfigKeys>, list: typeof DEFAULT, follow: boolean) {
    const height = this.element.clientHeight
    const spacingChanged = changes.config.has('modes.list.gap') || changes.config.has('modes.list.align')
    const layoutChanged = this.layoutDirty || changes.size || spacingChanged
    if (layoutChanged) {
      for (const line of this.lines) {
        line.measureWords()
      }

      const gap = Number.isFinite(list.gap) ? Math.max(0, list.gap) : DEFAULT.gap
      this.layout.measure(this.lines, gap)
      this.layoutDirty = height === 0
    }

    const anchorChanged = changes.config.has('modes.list.scroll.anchor') || changes.config.has('modes.list.scroll.follow')
    this.layout.position(this.scroll.index, height, list.scroll, {
      follow,
      browsing: this.scroll.isBrowsing,
      immediate: layoutChanged || anchorChanged,
    })
  }

  /**
   * Selects a visual anchor independently of which lyrics are active.
   */
  update(changes: RenderChanges<DomRendererConfigKeys>) {
    if (this.isDisposed) {
      return
    }

    const { currentInfo, activeIndexes, currentIndexes } = this.context.player
    const list = this.context.config.current.modes.list
    const timed = currentInfo.timing === TimingLevel.LINE || currentInfo.timing === TimingLevel.WORD
    const follow = list.scroll.follow && timed
    this.syncContent(changes)

    if (changes.seek) {
      this.scroll.reset()
    }

    const activeIndex = follow ? (activeIndexes[0] ?? 0) : undefined
    this.scroll.update(activeIndex, this.lines.length, list.scroll.resumeDelay)
    this.updateAlignment(list.align)
    this.updateLineState(activeIndexes, currentIndexes)
    this.updateLayout(changes, list, follow)
  }

  /**
   * Paints timed text independently of list measurement and scroll following.
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
    this.scroll.dispose()
    this.layout.clear()
    this.timeline.replace([])

    for (const line of this.lines) {
      line.dispose()
    }

    this.lines = []
    this.element.remove()
  }
}

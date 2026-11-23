import type { RenderChanges } from '@root/renderer/common/types'
import type { DomRendererConfigKeys } from '@root/renderer/dom/config'
import type { RenderContext } from '@root/renderer/dom/context'
import type { RenderMode } from '@root/renderer/dom/modes/types'

import { TimingLevel } from '@gondola-lyrics/model/common'

import { buildClassName, buildLineVariableKey } from '@root/renderer/dom/css'
import { LineObject } from '@root/renderer/dom/components/line/line'
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
  private lines: LineObject[] = []
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
    const { document, player, config, onLineClick, onLineContextMenu } = this.context
    this.lines = player.currentInfo.lines.map((line, index) => {
      return new LineObject(document, line, index, config.current.line, { click: onLineClick, contextMenu: onLineContextMenu })
    })
    this.content.replaceChildren(...this.lines.map((line) => line.element))
    for (const line of this.lines) {
      this.observer.observe(line.element)
    }
    this.scroll.reset(0)
    this.layoutDirty = true
  }

  /**
   * Selects a visual anchor independently of which lyrics are active.
   */
  update(changes: RenderChanges<DomRendererConfigKeys>) {
    if (this.isDisposed) {
      return
    }
    const { currentInfo, activeIndexes, currentIndexes } = this.context.player
    const config = this.context.config.current
    const list = config.modes.list
    const follow = list.scroll.follow && (currentInfo.timing === TimingLevel.LINE || currentInfo.timing === TimingLevel.WORD)
    const fonts = this.context.document.fonts
    if (fonts !== this.fonts) {
      this.fonts.removeEventListener('loadingdone', this.handleSizeChange)
      this.fonts = fonts
      this.fonts.addEventListener('loadingdone', this.handleSizeChange)
      this.layoutDirty = true
    }
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
    this.scroll.update(follow ? (activeIndexes[0] ?? 0) : undefined, this.lines.length, list.scroll.resumeDelay)
    this.content.style.textAlign = list.align

    const active = new Set(activeIndexes)
    const current = new Set(currentIndexes)
    const lyricTime = this.context.player.currentTime + this.context.player.currentOffset
    for (const [index, line] of this.lines.entries()) {
      line.element.setAttribute('position', list.align)
      line.element.style.setProperty(LINE_POSITION, list.align)
      line.updateState(active.has(index), current.has(index), lyricTime)
    }

    const height = this.element.clientHeight
    const layoutChanged = this.layoutDirty || changes.size || changes.config.has('modes.list.gap') || changes.config.has('modes.list.align')
    if (layoutChanged) {
      for (const line of this.lines) {
        line.measureWords()
      }
      const gap = Number.isFinite(list.gap) ? Math.max(0, list.gap) : DEFAULT.gap
      this.layout.measure(this.lines, gap)
      this.layoutDirty = height === 0
    }
    this.layout.position(this.scroll.index, height, list.scroll, {
      follow,
      browsing: this.scroll.isBrowsing,
      immediate: layoutChanged || changes.config.has('modes.list.scroll.anchor') || changes.config.has('modes.list.scroll.follow'),
    })
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

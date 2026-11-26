import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { TimeCue } from '@root/renderer/dom/timeline'
import type { ContentDisplay, LineInteractions } from './content'

import { EnrichedLineType } from '@gondola-lyrics/model/enriched'

import { buildClassName } from '@root/renderer/dom/css'

import { LineContentElement } from './content'

export class LineElement {
  readonly element: HTMLDivElement

  private readonly main: LineContentElement
  private readonly backgrounds: LineContentElement[] = []
  private active?: boolean
  private played?: boolean
  private current?: boolean

  constructor(
    document: Document,
    private readonly line: EnrichedLine,
    index: number,
    display: ContentDisplay,
    interactions: LineInteractions,
  ) {
    this.element = document.createElement('div')
    this.element.className = buildClassName('wrapper')
    this.element.dataset.role = 'line'
    this.element.dataset.lineIndex = String(index)
    this.element.dataset.type = line.type === EnrichedLineType.INSTRUMENTAL ? 'instrumental' : 'normal'

    this.main = new LineContentElement(document, line, index, display, interactions)
    this.element.appendChild(this.main.element)

    if (line.type !== EnrichedLineType.INSTRUMENTAL) {
      for (const background of line.backgrounds) {
        const content = new LineContentElement(document, background, index, display, interactions, true)
        this.backgrounds.push(content)
        this.element.appendChild(content.element)
      }
    }
  }

  /**
   * Reports whether a content switch requires layout and time callbacks to be refreshed.
   */
  updateConfig(display: ContentDisplay): boolean {
    let contentChanged = this.main.updateConfig(display)
    for (const background of this.backgrounds) {
      const changed = background.updateConfig(display)
      contentChanged ||= changed
    }

    return contentChanged
  }

  /**
   * Includes background vocals even when their first word precedes the main line.
   */
  get timeCues(): TimeCue[] {
    return [...this.main.timeCues, ...this.backgrounds.flatMap((background) => background.timeCues)]
  }

  /**
   * Applies display and original-time state equally during playback and paused seeks.
   */
  updateState(active: boolean, current: boolean, lyricTime: number) {
    const played = !active && lyricTime >= (this.line.time?.end ?? Infinity)
    if (active !== this.active) {
      this.element.toggleAttribute('active', active)
      this.active = active
    }
    if (played !== this.played) {
      this.element.toggleAttribute('played', played)
      this.played = played
    }

    if (current !== this.current) {
      this.element.toggleAttribute('data-current', current)
      if (current) {
        this.element.setAttribute('aria-current', 'true')
      } else {
        this.element.removeAttribute('aria-current')
      }
      this.current = current
    }

    this.main.updateState(active, lyricTime)
    for (const background of this.backgrounds) {
      background.updateState(false, lyricTime)
    }
  }

  /**
   * Refreshes text masks independently of the row's scroll anchor.
   */
  measureWords() {
    this.main.measureWords()
    for (const background of this.backgrounds) {
      background.measureWords()
    }
  }

  /**
   * Uses natural layout dimensions so visual transforms cannot move the scroll anchor.
   */
  measure(): { height: number; anchorY: number } {
    const { anchorY } = this.main.measure()
    return { height: this.element.offsetHeight, anchorY: this.main.element.offsetTop + anchorY }
  }

  /**
   * Releases the complete row while preserving the shared player and source lyric.
   */
  dispose() {
    this.main.dispose()
    for (const background of this.backgrounds) {
      background.dispose()
    }

    this.backgrounds.length = 0
    this.element.remove()
  }
}

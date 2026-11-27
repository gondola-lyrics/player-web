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
   * Returns true when any source needs new measurements and time cues.
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
   * Timeline entries for every source, including background vocals that start before the main line.
   */
  get timeCues(): TimeCue[] {
    return [...this.main.timeCues, ...this.backgrounds.flatMap((background) => background.timeCues)]
  }

  /**
   * Applies the list's row state and samples each source at the offset-adjusted lyric time in milliseconds.
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
    // Background vocals become active on their own timing even when their row is highlighted.
    for (const background of this.backgrounds) {
      background.updateState(false, lyricTime)
    }
  }

  /**
   * Refreshes the main and background masks after fonts or wrapping change.
   */
  measureWords() {
    this.main.measureWords()
    for (const background of this.backgrounds) {
      background.measureWords()
    }
  }

  /**
   * Measures in layout coordinates so animations preserve the row's scroll anchor.
   */
  measure(): {
    /**
     * Full row height in CSS pixels, including background vocals.
     */
    height: number
    /**
     * Center of the main text or interlude in CSS pixels from the row's top edge.
     */
    anchorY: number
  } {
    const { anchorY } = this.main.measure()
    return { height: this.element.offsetHeight, anchorY: this.main.element.offsetTop + anchorY }
  }

  dispose() {
    this.main.dispose()
    for (const background of this.backgrounds) {
      background.dispose()
    }

    this.backgrounds.length = 0
    this.element.remove()
  }
}

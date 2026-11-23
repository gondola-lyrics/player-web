import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { TimeCue } from '@root/renderer/dom/timeline'
import type { LineConfigRequired } from './config'
import type { LineInteractions } from './content'

import { EnrichedLineType } from '@gondola-lyrics/model/enriched'

import { buildClassName, buildLineVariableKey } from '@root/renderer/dom/css'

import { DEFAULT } from './config'
import { LineContentElement } from './content'

const FONT_SIZE = buildLineVariableKey('line-normal-base-font-size')
const FONT_FAMILY = buildLineVariableKey('line-normal-base-font-family')
const FONT_WEIGHT = buildLineVariableKey('line-normal-base-font-weight')

export class LineElement {
  readonly element: HTMLDivElement

  private readonly main: LineContentElement
  private readonly backgrounds: LineContentElement[] = []

  constructor(
    document: Document,
    private readonly line: EnrichedLine,
    index: number,
    config: LineConfigRequired,
    interactions: LineInteractions,
  ) {
    this.element = document.createElement('div')
    this.element.className = buildClassName('wrapper')
    this.element.dataset.role = 'line'
    this.element.dataset.lineIndex = String(index)
    this.element.dataset.type = line.type === EnrichedLineType.INSTRUMENTAL ? 'instrumental' : 'normal'

    this.main = new LineContentElement(document, line, index, config, interactions)
    this.element.appendChild(this.main.element)

    if (line.type !== EnrichedLineType.INSTRUMENTAL) {
      for (const background of line.backgrounds) {
        const content = new LineContentElement(document, background, index, config, interactions, true)
        this.backgrounds.push(content)
        this.element.appendChild(content.element)
      }
    }

    this.updateConfig(config)
  }

  /**
   * Shares the row's font while each main or background content keeps its own word instance.
   */
  updateConfig(config: LineConfigRequired) {
    const size = Number.isFinite(config.font.size) && config.font.size > 0 ? config.font.size : DEFAULT.font.size
    const weight = Number.isFinite(config.font.weight) ? config.font.weight : DEFAULT.font.weight

    this.element.style.setProperty(FONT_SIZE, `${size}px`)
    this.element.style.setProperty(FONT_FAMILY, config.font.family || 'inherit')
    this.element.style.setProperty(FONT_WEIGHT, String(weight))

    this.main.updateConfig(config)
    for (const background of this.backgrounds) {
      background.updateConfig(config)
    }
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
    this.element.toggleAttribute('active', active)
    this.element.toggleAttribute('played', !active && lyricTime >= (this.line.time?.end ?? Infinity))
    this.element.toggleAttribute('data-current', current)

    if (current) {
      this.element.setAttribute('aria-current', 'true')
    } else {
      this.element.removeAttribute('aria-current')
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

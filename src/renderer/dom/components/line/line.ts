import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { TimeCue } from '@root/renderer/dom/timeline'
import type { WordConfigRequired } from '@root/renderer/dom/components/word/config'
import type { LineConfigRequired } from './config'
import type { LineInteractions } from './content'

import { EnrichedLineType } from '@gondola-lyrics/model/enriched'

import { buildClassName, buildLineVariableKey } from '@root/renderer/dom/css'

import { DEFAULT } from './config'
import { LineContentElement } from './content'

const FONT_SIZE = buildLineVariableKey('line-normal-base-font-size')
const FONT_FAMILY = buildLineVariableKey('line-normal-base-font-family')
const FONT_WEIGHT = buildLineVariableKey('line-normal-base-font-weight')
const STYLE_STATES = ['normal', 'active', 'played'] as const
const STYLE_VARIABLES = {
  normal: {
    color: buildLineVariableKey('line-normal-main-syllable-color'),
    opacity: buildLineVariableKey('line-normal-main-syllable-opacity'),
  },
  active: {
    color: buildLineVariableKey('line-normal-main-syllable-active-color'),
    opacity: buildLineVariableKey('line-normal-main-syllable-active-opacity'),
  },
  played: {
    color: buildLineVariableKey('line-normal-main-syllable-played-color'),
    opacity: buildLineVariableKey('line-normal-main-syllable-played-opacity'),
  },
}

export class LineElement {
  readonly element: HTMLDivElement

  private readonly main: LineContentElement
  private readonly backgrounds: LineContentElement[] = []
  private config?: LineConfigRequired
  private wordConfig: WordConfigRequired
  private active?: boolean
  private played?: boolean
  private current?: boolean

  constructor(
    document: Document,
    private readonly line: EnrichedLine,
    index: number,
    config: LineConfigRequired,
    word: WordConfigRequired,
    interactions: LineInteractions,
  ) {
    this.wordConfig = word
    this.element = document.createElement('div')
    this.element.className = buildClassName('wrapper')
    this.element.dataset.role = 'line'
    this.element.dataset.lineIndex = String(index)
    this.element.dataset.type = line.type === EnrichedLineType.INSTRUMENTAL ? 'instrumental' : 'normal'

    this.main = new LineContentElement(document, line, index, word, interactions)
    this.element.appendChild(this.main.element)

    if (line.type !== EnrichedLineType.INSTRUMENTAL) {
      for (const background of line.backgrounds) {
        const content = new LineContentElement(document, background, index, word, interactions, true)
        this.backgrounds.push(content)
        this.element.appendChild(content.element)
      }
    }

    this.updateConfig(config, word)
  }

  private updateFont(font: LineConfigRequired['font'], previous?: LineConfigRequired['font']) {
    const style = this.element.style
    if (font.size !== previous?.size) {
      const size = Number.isFinite(font.size) && font.size > 0 ? font.size : DEFAULT.font.size
      style.setProperty(FONT_SIZE, `${size}px`)
    }
    if (font.family !== previous?.family) {
      style.setProperty(FONT_FAMILY, font.family || 'inherit')
    }
    if (font.weight !== previous?.weight) {
      const weight = Number.isFinite(font.weight) ? font.weight : DEFAULT.font.weight
      style.setProperty(FONT_WEIGHT, String(weight))
    }
  }

  private updateStyle(styles: LineConfigRequired['style'], previous?: LineConfigRequired['style']) {
    const style = this.element.style
    for (const state of STYLE_STATES) {
      const current = styles[state]
      const before = previous?.[state]
      if (current === before) {
        continue
      }

      const variables = STYLE_VARIABLES[state]
      if (current.color !== before?.color) {
        style.setProperty(variables.color, current.color)
      }
      if (current.opacity !== before?.opacity) {
        style.setProperty(variables.opacity, String(current.opacity))
      }
    }
  }

  /**
   * Writes changed appearance fields and updates word content only when its configuration changes.
   */
  updateConfig(config: LineConfigRequired, word: WordConfigRequired) {
    if (config.font !== this.config?.font) {
      this.updateFont(config.font, this.config?.font)
    }
    if (config.style !== this.config?.style) {
      this.updateStyle(config.style, this.config?.style)
    }
    this.config = config

    if (word !== this.wordConfig) {
      this.main.updateConfig(word)
      for (const background of this.backgrounds) {
        background.updateConfig(word)
      }
      this.wordConfig = word
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

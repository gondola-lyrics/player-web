import type { EnrichedLine, EnrichedLineBackground } from '@gondola-lyrics/model/enriched'
import type { WordEffects } from '@root/renderer/dom/components/word/config'
import type { DomRendererConfigManager, DomRendererMode } from '@root/renderer/dom/config'
import type { DomRendererEventMap } from '@root/renderer/dom/events'
import type { TimeCue } from '@root/renderer/dom/timeline'
import type { ContentUnit } from './config'

import { isTimeInTimeRange } from '@gondola-lyrics/model/common'
import { EnrichedLineType, getEnrichedLineContentText, hasEnrichedLineWords } from '@gondola-lyrics/model/enriched'

import { buildClassName } from '@root/renderer/dom/css'
import { TimedWords } from '@root/renderer/dom/components/word/words'

export interface LineInteractions {
  click: DomRendererEventMap['line-click']
  contextMenu: DomRendererEventMap['line-context-menu']
}

export interface ContentDisplay {
  unit: ContentUnit
  effects: WordEffects
}

/**
 * Resolves content preferences once for all vocals in the mode.
 */
export const resolveContentDisplay = (config: DomRendererConfigManager, mode: DomRendererMode): ContentDisplay => {
  return {
    unit: config.resolve(`modes.${mode}.content.unit`, 'common.content.unit'),
    effects: {
      mask: config.resolve(`modes.${mode}.content.word.mask.enabled`, 'common.content.word.mask.enabled'),
      float: config.resolve(`modes.${mode}.content.word.float.enabled`, 'common.content.word.float.enabled'),
      emphasis: config.resolve(`modes.${mode}.content.word.emphasis.enabled`, 'common.content.word.emphasis.enabled'),
    },
  }
}

export class LineContentElement {
  readonly element: HTMLDivElement

  private readonly text: HTMLDivElement | null
  private readonly cues: TimeCue[] = []
  private words?: TimedWords | null
  private active = false
  private lyricTime = -Infinity
  private renderedActive?: boolean
  private renderedPlayed?: boolean
  private renderedCurrent?: boolean

  constructor(
    document: Document,
    private readonly line: EnrichedLine | EnrichedLineBackground,
    private readonly index: number,
    display: ContentDisplay,
    private readonly interactions: LineInteractions,
    private readonly background = false,
  ) {
    this.element = document.createElement('div')
    this.text = null

    if ('type' in line && line.type === EnrichedLineType.INSTRUMENTAL) {
      this.element.className = buildClassName('interlude')
      this.element.dataset.role = 'line-interlude'
      this.element.textContent = '···'
      this.element.setAttribute('aria-label', 'Instrumental')
    } else {
      this.element.className = buildClassName('normal')
      this.element.classList.toggle(buildClassName('background'), background)
      this.element.dataset.role = 'line-normal'

      const language = line.languages.find((language) => language.trim().length > 0)
      if (language) {
        this.element.lang = language
      }

      this.text = document.createElement('div')
      this.text.dataset.role = 'line-normal-text'
      this.element.appendChild(this.text)
    }

    this.updateConfig(display)
    if (line.time) {
      this.cues.push({
        range: line.time,
        update: (lyricTime) => {
          this.lyricTime = lyricTime
          this.syncState()
          return false
        },
      })
    }

    this.element.addEventListener('click', this.handleClick)
    this.element.addEventListener('contextmenu', this.handleContextMenu)
  }

  private syncState() {
    const current = isTimeInTimeRange(this.line.time, this.lyricTime)
    const active = this.active || current
    const played = !active && this.lyricTime >= (this.line.time?.end ?? Infinity)

    if (active !== this.renderedActive) {
      this.element.toggleAttribute('active', active)
      this.text?.toggleAttribute('active', active)
      this.renderedActive = active
    }
    if (played !== this.renderedPlayed) {
      this.element.toggleAttribute('played', played)
      this.text?.toggleAttribute('played', played)
      this.renderedPlayed = played
    }
    if (current !== this.renderedCurrent) {
      this.element.toggleAttribute('data-current', current)
      this.renderedCurrent = current
    }
  }

  private handleClick = (event: MouseEvent) => {
    if (event.defaultPrevented) {
      return
    }

    const selection = this.element.ownerDocument.getSelection()
    if (event.detail > 0 && selection && !selection.isCollapsed) {
      for (let index = 0; index < selection.rangeCount; index++) {
        if (selection.getRangeAt(index).intersectsNode(this.element)) {
          return
        }
      }
    }

    this.interactions.click(this.line, this.index, event)
  }

  private handleContextMenu = (event: MouseEvent) => {
    this.interactions.contextMenu(this.line, this.index, event)
  }

  /**
   * Preserves matching representations and reports changes to word geometry and time callbacks.
   */
  updateConfig({ unit, effects }: ContentDisplay): boolean {
    if (!this.text) {
      return false
    }

    if (unit === 'word' && hasEnrichedLineWords(this.line)) {
      const previous = this.words?.effects
      if (previous && previous.mask === effects.mask && previous.float === effects.float && previous.emphasis === effects.emphasis) {
        return false
      }

      this.words?.dispose()
      this.text.className = buildClassName('syllable')
      this.words = new TimedWords(this.text, this.line.content!.words, this.line.time, this.background, effects)
    } else {
      if (this.words === null) {
        return false
      }

      this.words?.dispose()
      this.words = null
      this.text.className = buildClassName('plain')
      this.text.textContent = getEnrichedLineContentText(this.line.content)
    }

    return true
  }

  /**
   * Schedules this source independently of the main lyric's start time.
   */
  get timeCues(): TimeCue[] {
    return [...this.cues, ...(this.words?.cues ?? [])]
  }

  /**
   * Combines list activation with this source's original time during playback and paused seeks.
   */
  updateState(active: boolean, lyricTime: number) {
    this.active = active
    this.lyricTime = lyricTime
    this.syncState()
  }

  /**
   * Refreshes masks after layout without changing playback or the containing row's position.
   */
  measureWords() {
    this.words?.measure()
  }

  /**
   * Uses natural text dimensions so word transforms cannot move the scroll anchor.
   */
  measure(): { height: number; anchorY: number } {
    const anchorY = this.text ? this.text.offsetTop + this.text.offsetHeight / 2 : this.element.offsetHeight / 2
    return { height: this.element.offsetHeight, anchorY }
  }

  /**
   * Releases only this content's listeners and word effects, preserving the source lyric.
   */
  dispose() {
    this.element.removeEventListener('click', this.handleClick)
    this.element.removeEventListener('contextmenu', this.handleContextMenu)
    this.words?.dispose()
    this.words = null
    this.cues.length = 0
    this.element.remove()
  }
}

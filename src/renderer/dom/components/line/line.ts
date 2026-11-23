import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { TimeCue } from '@root/renderer/dom/timeline'
import type { LineConfigRequired } from './config'

import { isTimeInTimeRange } from '@gondola-lyrics/model/common'
import { EnrichedLineType, getEnrichedLineContentText, hasEnrichedLineWords } from '@gondola-lyrics/model/enriched'

import { buildClassName, buildLineVariableKey } from '@root/renderer/dom/css'
import { TimedWords } from '@root/renderer/dom/components/word/words'

import { DEFAULT } from './config'

const FONT_SIZE = buildLineVariableKey('line-normal-base-font-size')
const FONT_FAMILY = buildLineVariableKey('line-normal-base-font-family')
const FONT_WEIGHT = buildLineVariableKey('line-normal-base-font-weight')

interface LineInteractions {
  click: (line: EnrichedLine, index: number, event: MouseEvent) => void
  contextMenu: (line: EnrichedLine, index: number, event: MouseEvent) => void
}

type VocalSource = Pick<EnrichedLine, 'languages' | 'content' | 'time'>

interface VocalPart {
  readonly element: HTMLDivElement
  readonly text: HTMLDivElement
  readonly source: VocalSource
  readonly background: boolean
  readonly cues: TimeCue[]
  words?: TimedWords | null
  active: boolean
  lyricTime: number
}

export class LineObject {
  readonly element: HTMLDivElement

  private readonly main: VocalPart | null
  private readonly parts: VocalPart[] = []
  private readonly instrumental: HTMLDivElement | null

  constructor(
    document: Document,
    private readonly line: EnrichedLine,
    private readonly index: number,
    config: LineConfigRequired,
    private readonly interactions: LineInteractions,
  ) {
    this.element = document.createElement('div')
    this.element.className = buildClassName('wrapper')
    this.element.dataset.role = 'line'
    this.element.dataset.lineIndex = String(index)
    this.main = null
    this.instrumental = null

    if (line.type === EnrichedLineType.INSTRUMENTAL) {
      this.element.dataset.type = 'instrumental'
      this.instrumental = document.createElement('div')
      this.instrumental.className = buildClassName('interlude')
      this.instrumental.dataset.role = 'line-interlude'
      this.instrumental.textContent = '···'
      this.instrumental.setAttribute('aria-label', 'Instrumental')
      this.element.appendChild(this.instrumental)
    } else {
      this.element.dataset.type = 'normal'
      this.main = this.createPart(document, line, config.words.enabled)
      this.element.appendChild(this.main.element)
      if (line.backgrounds.length > 0) {
        const backgroundElement = document.createElement('div')
        backgroundElement.className = buildClassName('backgrounds')
        for (const background of line.backgrounds) {
          const part = this.createPart(document, background, config.words.enabled, true)
          backgroundElement.appendChild(part.element)
        }
        this.element.appendChild(backgroundElement)
      }
    }

    this.updateConfig(config)
    this.element.addEventListener('click', this.handleClick)
    this.element.addEventListener('contextmenu', this.handleContextMenu)
  }

  private createPart(document: Document, source: VocalSource, wordsEnabled: boolean, background = false): VocalPart {
    const element = document.createElement('div')
    element.className = buildClassName('normal')
    element.classList.toggle(buildClassName('background'), background)
    element.dataset.role = 'line-normal'

    const language = source.languages.find((language) => language.trim().length > 0)
    if (language) {
      element.lang = language
    }

    const text = document.createElement('div')
    text.dataset.role = 'line-normal-text'
    element.appendChild(text)

    const part: VocalPart = { element, text, source, background, cues: [], active: false, lyricTime: -Infinity }
    this.updateWords(part, wordsEnabled)

    if (source.time) {
      part.cues.push({
        range: source.time,
        update: (lyricTime) => {
          part.lyricTime = lyricTime
          this.updatePartState(part)
          return false
        },
      })
    }

    this.parts.push(part)

    return part
  }

  private updateWords(part: VocalPart, enabled: boolean) {
    const timed = enabled && hasEnrichedLineWords(part.source)
    if (part.words !== undefined && timed === Boolean(part.words)) {
      return
    }

    part.words?.dispose()
    part.text.className = buildClassName(timed ? 'syllable' : 'plain')
    if (timed) {
      part.words = new TimedWords(part.text, part.source.content!.words, part.source.time, part.background)
    } else {
      part.words = null
      part.text.textContent = getEnrichedLineContentText(part.source.content)
    }
  }

  private updatePartState(part: VocalPart) {
    const current = isTimeInTimeRange(part.source.time, part.lyricTime)
    const active = part.active || current
    const played = !active && part.lyricTime >= (part.source.time?.end ?? Infinity)

    part.element.toggleAttribute('active', active)
    part.element.toggleAttribute('played', played)
    part.text.toggleAttribute('active', active)
    part.text.toggleAttribute('played', played)
    if (part.background) {
      part.element.toggleAttribute('data-current', current)
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
   * Shares the font across the row and applies word timing independently to each vocal part.
   */
  updateConfig(config: LineConfigRequired) {
    const size = Number.isFinite(config.font.size) && config.font.size > 0 ? config.font.size : DEFAULT.font.size
    const weight = Number.isFinite(config.font.weight) ? config.font.weight : DEFAULT.font.weight

    this.element.style.setProperty(FONT_SIZE, `${size}px`)
    this.element.style.setProperty(FONT_FAMILY, config.font.family || 'inherit')
    this.element.style.setProperty(FONT_WEIGHT, String(weight))

    for (const part of this.parts) {
      this.updateWords(part, config.words.enabled)
    }
  }

  /**
   * Includes background vocals even when their first word precedes the main line.
   */
  get timeCues(): TimeCue[] {
    return this.parts.flatMap((part) => {
      return [...part.cues, ...(part.words?.cues ?? [])]
    })
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

    if (this.main) {
      this.main.active = active
      this.main.element.toggleAttribute('data-current', current)
      this.updatePartState(this.main)
    }
  }

  /**
   * Refreshes text masks independently of the row's scroll anchor.
   */
  measureWords() {
    for (const part of this.parts) {
      part.words?.measure()
    }
  }

  /**
   * Uses natural layout dimensions so visual transforms cannot move the scroll anchor.
   */
  measure(): { height: number; anchorY: number } {
    const anchorY = this.main
      ? this.main.element.offsetTop + this.main.text.offsetTop + this.main.text.offsetHeight / 2
      : (this.instrumental?.offsetTop ?? 0) + (this.instrumental?.offsetHeight ?? 0) / 2

    return { height: this.element.offsetHeight, anchorY }
  }

  /**
   * Releases the complete row while preserving the shared player and source lyric.
   */
  dispose() {
    this.element.removeEventListener('click', this.handleClick)
    this.element.removeEventListener('contextmenu', this.handleContextMenu)

    for (const part of this.parts) {
      part.words?.dispose()
    }

    this.parts.length = 0
    this.element.remove()
  }
}

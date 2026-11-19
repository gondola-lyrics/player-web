import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { TimeCue } from '@root/renderer/dom/timeline'

import { isTimeInTimeRange } from '@gondola-lyrics/model/common'
import { getEnrichedLineContentText, hasEnrichedLineWords } from '@gondola-lyrics/model/enriched'

import { TimedWords } from './words'

type ContentSource = Pick<EnrichedLine, 'languages' | 'content' | 'time'>

export class ContentBlock {
  readonly element: HTMLDivElement

  private readonly main: HTMLDivElement
  private readonly cues: TimeCue[] = []
  private words?: TimedWords | null
  private active = false
  private lyricTime = -Infinity

  /**
   * Preserves source whitespace as text and exposes its primary language to assistive technology.
   */
  constructor(
    document: Document,
    private readonly source: ContentSource,
    wordsEnabled: boolean,
    private readonly background = false,
  ) {
    this.element = document.createElement('div')
    this.element.className = background ? 'gondola-lyrics-player-normal gondola-lyrics-player-background' : 'gondola-lyrics-player-normal'
    this.element.dataset.role = 'line-normal'
    const language = source.languages.find((language) => language.trim().length > 0)
    if (language) {
      this.element.lang = language
    }
    this.main = document.createElement('div')
    this.main.dataset.role = 'line-normal-text'
    this.element.appendChild(this.main)
    this.setWordsEnabled(wordsEnabled)
    if (source.time) {
      this.cues.push({
        range: source.time,
        update: (lyricTime) => {
          this.lyricTime = lyricTime
          this.syncState()
          return false
        },
      })
    }
  }

  /**
   * Preserves text nodes and selections when the current representation still applies.
   */
  setWordsEnabled(enabled: boolean) {
    const timed = enabled && hasEnrichedLineWords(this.source)
    if (this.words !== undefined && timed === Boolean(this.words)) {
      return
    }
    this.words?.dispose()
    this.main.className = timed ? 'gondola-lyrics-player-syllable' : 'gondola-lyrics-player-plain'
    if (timed) {
      this.words = new TimedWords(this.main, this.source.content!.words, this.source.time, this.background)
    } else {
      this.words = null
      this.main.textContent = getEnrichedLineContentText(this.source.content)
    }
  }

  /**
   * Includes the content's own singing range along with each timed word.
   */
  get timeCues(): TimeCue[] {
    return [...this.cues, ...(this.words?.cues ?? [])]
  }

  /**
   * Exposes local state so a parent line cannot highlight its background blocks through a descendant selector.
   */
  updateState(active: boolean, current: boolean) {
    this.active = active
    this.element.toggleAttribute('data-current', current)
    this.syncState()
  }

  private syncState() {
    const current = isTimeInTimeRange(this.source.time, this.lyricTime)
    const active = this.active || current
    this.element.toggleAttribute('active', active)
    this.element.toggleAttribute('played', !active && this.lyricTime >= (this.source.time?.end ?? Infinity))
    if (this.background) {
      this.element.toggleAttribute('data-current', current)
    }
  }

  /**
   * Reads the natural text geometry after fonts and wrapping settle.
   */
  measureWords() {
    this.words?.measure()
  }

  /**
   * Keeps scrolling centered on the original text when it wraps.
   */
  get anchorY(): number {
    return this.main.offsetTop + this.main.offsetHeight / 2
  }

  /**
   * Detaches the block without changing the shared source data.
   */
  dispose() {
    this.words?.dispose()
    this.element.remove()
  }
}

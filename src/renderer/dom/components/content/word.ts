import type { TimeRange } from '@gondola-lyrics/model/common'
import type { EnrichedWord } from '@gondola-lyrics/model/enriched'

import { WordMotion } from './animation/motion'

export class WordElement {
  readonly element: HTMLSpanElement
  readonly wipe: HTMLSpanElement
  readonly word: HTMLSpanElement
  readonly motion?: WordMotion

  /**
   * Keeps the wipe outside the moving text so the feather also covers emphasis and glow.
   */
  constructor(document: Document, source: EnrichedWord, block: TimeRange | undefined, background: boolean) {
    this.element = document.createElement('span')
    this.element.className = 'gondola-lyrics-player-cell'
    this.element.dataset.role = 'line-normal-text-word'
    if (source.language) {
      this.element.lang = source.language
    }
    this.wipe = document.createElement('span')
    this.wipe.className = 'gondola-lyrics-player-wipe'
    this.word = document.createElement('span')
    this.word.className = 'gondola-lyrics-player-word'
    const chars: HTMLSpanElement[] = []
    if (source.time && source.emphasis?.value) {
      const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(source.text)
      for (const { segment } of segments) {
        const char = document.createElement('span')
        char.className = 'gondola-lyrics-player-char'
        char.dataset.role = 'line-normal-text-word-char'
        char.textContent = segment
        this.word.appendChild(char)
        chars.push(char)
      }
      this.element.style.setProperty('--gondola-lyrics-player-emphasize-padding-horizontal', '9px')
      this.element.style.setProperty('--gondola-lyrics-player-emphasize-padding-vertical', '5px')
    } else {
      this.word.textContent = source.text
    }
    this.wipe.appendChild(this.word)
    this.element.appendChild(this.wipe)
    if (source.time) {
      this.motion = new WordMotion(this.word, chars, source.time, block, background)
    }
  }

  /**
   * Cancels animation effects before the containing text is replaced.
   */
  dispose() {
    this.motion?.dispose()
  }
}

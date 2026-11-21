import type { TimeRange } from '@gondola-lyrics/model/common'
import type { EnrichedWord } from '@gondola-lyrics/model/enriched'

import { buildClassName, buildRootVariableKey } from '@root/renderer/dom/css'

import { WordMotion } from './animation/motion'

const EMPHASIZE_PADDING_HORIZONTAL = buildRootVariableKey('emphasize-padding-horizontal')
const EMPHASIZE_PADDING_VERTICAL = buildRootVariableKey('emphasize-padding-vertical')

export class WordElement {
  readonly element: HTMLSpanElement
  readonly wipe: HTMLSpanElement
  readonly word: HTMLSpanElement
  readonly motion?: WordMotion

  constructor(document: Document, source: EnrichedWord, block: TimeRange | undefined, background: boolean) {
    this.element = document.createElement('span')
    this.element.className = buildClassName('cell')
    this.element.dataset.role = 'line-normal-text-word'
    if (source.language) {
      this.element.lang = source.language
    }
    this.wipe = document.createElement('span')
    this.wipe.className = buildClassName('wipe')
    this.word = document.createElement('span')
    this.word.className = buildClassName('word')
    const chars: HTMLSpanElement[] = []
    if (source.time && source.emphasis?.value) {
      const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(source.text)
      for (const { segment } of segments) {
        const char = document.createElement('span')
        char.className = buildClassName('char')
        char.dataset.role = 'line-normal-text-word-char'
        char.textContent = segment
        this.word.appendChild(char)
        chars.push(char)
      }
      this.element.style.setProperty(EMPHASIZE_PADDING_HORIZONTAL, '9px')
      this.element.style.setProperty(EMPHASIZE_PADDING_VERTICAL, '5px')
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

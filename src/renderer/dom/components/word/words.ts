import type { TimeRange } from '@gondola-lyrics/model/common'
import type { EnrichedWord } from '@gondola-lyrics/model/enriched'
import type { TimeCue } from '@root/renderer/dom/timeline'
import type { MaskWord } from './animation/mask'
import type { WordEffects } from './config'

import { EnrichedWordType } from '@gondola-lyrics/model/enriched'

import { MaskAnimationHost } from './animation/mask'
import { WordElement } from './word'

export class TimedWords {
  readonly cues: TimeCue[] = []
  private readonly words: WordElement[] = []
  private readonly mask?: MaskAnimationHost

  constructor(
    text: HTMLElement,
    words: readonly EnrichedWord[],
    range: TimeRange | undefined,
    background: boolean,
    readonly effects: WordEffects,
  ) {
    const document = text.ownerDocument
    const fragment = document.createDocumentFragment()
    const masked: MaskWord[] = []

    for (const word of words) {
      if (word.type !== EnrichedWordType.NORMAL) {
        fragment.append(word.text)
        continue
      }

      const element = new WordElement(document, word, range, background, effects)
      this.words.push(element)
      if (effects.mask && word.time) {
        masked.push({ wipe: element.wipe, word: element.word, range: word.time })
      }

      this.cues.push(...(element.motion?.cues ?? []))
      fragment.appendChild(element.element)
    }

    text.replaceChildren(fragment)
    if (masked.length > 0) {
      this.mask = new MaskAnimationHost(masked, range)
      this.cues.push(...this.mask.cues)
    }
  }

  /**
   * Recomputes highlight geometry after the font or available width changes.
   */
  measure() {
    this.mask?.measure()
  }

  /**
   * Cancels native animations before the caller replaces the text nodes.
   */
  dispose() {
    for (const word of this.words) {
      word.dispose()
    }
  }
}

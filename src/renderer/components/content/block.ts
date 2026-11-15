import type { EnrichedLine } from '@gondola-lyrics/model/enriched'

import { getEnrichedLineContentText } from '@gondola-lyrics/model/enriched'

type ContentSource = Pick<EnrichedLine, 'languages' | 'content'>

export class ContentBlock {
  readonly element: HTMLDivElement

  private readonly main: HTMLDivElement

  /**
   * Preserves source whitespace as text and exposes its primary language to assistive technology.
   */
  constructor(document: Document, source: ContentSource) {
    this.element = document.createElement('div')
    this.element.className = 'gondola-content'
    const language = source.languages.find((language) => language.trim().length > 0)
    if (language) {
      this.element.lang = language
    }
    this.main = document.createElement('div')
    this.main.className = 'gondola-text'
    this.main.textContent = getEnrichedLineContentText(source.content)
    this.element.appendChild(this.main)
  }

  /**
   * Exposes local state so a parent line cannot highlight its background blocks through a descendant selector.
   */
  updateState(active: boolean, current: boolean) {
    this.element.toggleAttribute('data-active', active)
    this.element.toggleAttribute('data-current', current)
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
    this.element.remove()
  }
}

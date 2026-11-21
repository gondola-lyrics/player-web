import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { LineConfigRequired } from './config'

import { EnrichedLineType } from '@gondola-lyrics/model/enriched'

import { ContentBlock } from '@root/renderer/dom/components/content/block'
import { buildClassName, buildLineVariableKey } from '@root/renderer/dom/css'

import { DEFAULT } from './config'

const FONT_SIZE = buildLineVariableKey('line-normal-base-font-size')
const FONT_FAMILY = buildLineVariableKey('line-normal-base-font-family')
const FONT_WEIGHT = buildLineVariableKey('line-normal-base-font-weight')

interface LineInteractions {
  click: (line: EnrichedLine, index: number, event: MouseEvent) => void
  contextMenu: (line: EnrichedLine, index: number, event: MouseEvent) => void
}

export class LineObject {
  readonly element: HTMLDivElement

  private readonly main: ContentBlock | null
  private readonly blocks: ContentBlock[] = []
  private readonly instrumental: HTMLDivElement | null

  /**
   * Binds one original lyric index to its main content and all background vocals.
   */
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
      this.main = new ContentBlock(document, line, config.words.enabled)
      this.blocks.push(this.main)
      this.element.appendChild(this.main.element)
      if (line.backgrounds.length > 0) {
        const backgroundElement = document.createElement('div')
        backgroundElement.className = buildClassName('backgrounds')
        for (const background of line.backgrounds) {
          const block = new ContentBlock(document, background, config.words.enabled, true)
          this.blocks.push(block)
          backgroundElement.appendChild(block.element)
        }
        this.element.appendChild(backgroundElement)
      }
    }
    this.updateConfig(config)
    this.element.addEventListener('click', this.handleClick)
    this.element.addEventListener('contextmenu', this.handleContextMenu)
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
    for (const block of this.blocks) {
      block.setWordsEnabled(config.words.enabled)
    }
  }

  /**
   * Includes background vocals even when their first word precedes the main line.
   */
  get timeCues() {
    return this.blocks.flatMap((block) => block.timeCues)
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
    this.main?.updateState(active, current)
  }

  /**
   * Refreshes text masks independently of the row's scroll anchor.
   */
  measureWords() {
    for (const block of this.blocks) {
      block.measureWords()
    }
  }

  /**
   * Uses natural layout dimensions so visual transforms cannot move the scroll anchor.
   */
  measure(): { height: number; anchorY: number } {
    const anchorY = this.main
      ? this.main.element.offsetTop + this.main.anchorY
      : (this.instrumental?.offsetTop ?? 0) + (this.instrumental?.offsetHeight ?? 0) / 2
    return { height: this.element.offsetHeight, anchorY }
  }

  /**
   * Releases the complete row while preserving the shared player and source lyric.
   */
  dispose() {
    this.element.removeEventListener('click', this.handleClick)
    this.element.removeEventListener('contextmenu', this.handleContextMenu)
    for (const block of this.blocks) {
      block.dispose()
    }
    this.element.remove()
  }
}

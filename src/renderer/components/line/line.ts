import type { EnrichedLine } from '@gondola-lyrics/model/enriched'
import type { LineConfigRequired } from './config'

import { EnrichedLineType } from '@gondola-lyrics/model/enriched'

import { ContentBlock } from '../content/block'
import { DEFAULT } from './config'

interface LineInteractions {
  click: (line: EnrichedLine, index: number, event: MouseEvent) => void
  contextMenu: (line: EnrichedLine, index: number, event: MouseEvent) => void
}

export class LineObject {
  readonly element: HTMLDivElement

  private readonly main: ContentBlock | null
  private readonly backgrounds: ContentBlock[]
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
    this.element.className = 'gondola-line'
    this.element.dataset.lineIndex = String(index)
    this.element.setAttribute('role', 'button')
    this.element.tabIndex = -1
    this.main = null
    this.instrumental = null
    this.backgrounds = []

    if (line.type === EnrichedLineType.INSTRUMENTAL) {
      this.element.dataset.type = 'instrumental'
      this.instrumental = document.createElement('div')
      this.instrumental.className = 'gondola-instrumental'
      this.instrumental.textContent = '···'
      this.instrumental.setAttribute('aria-label', 'Instrumental')
      this.element.appendChild(this.instrumental)
    } else {
      this.element.dataset.type = 'normal'
      this.main = new ContentBlock(document, line)
      this.element.appendChild(this.main.element)
      if (line.backgrounds.length > 0) {
        const backgroundElement = document.createElement('div')
        backgroundElement.className = 'gondola-backgrounds'
        for (const background of line.backgrounds) {
          const block = new ContentBlock(document, background)
          this.backgrounds.push(block)
          backgroundElement.appendChild(block.element)
        }
        this.element.appendChild(backgroundElement)
      }
    }
    this.updateConfig(config)
    this.element.addEventListener('click', this.handleClick)
    this.element.addEventListener('contextmenu', this.handleContextMenu)
    this.element.addEventListener('keydown', this.handleKeyDown)
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

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.target === this.element && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      if (!event.repeat) {
        this.element.click()
      }
    }
  }

  /**
   * Shares configurable fonts with text and instrumental content while leaving CSS properties overridable by the host.
   */
  updateConfig(config: LineConfigRequired) {
    const size = Number.isFinite(config.font.size) && config.font.size > 0 ? config.font.size : DEFAULT.font.size
    const weight = Number.isFinite(config.font.weight) ? config.font.weight : DEFAULT.font.weight
    this.element.style.setProperty('--gondola-font-size', `${size}px`)
    this.element.style.setProperty('--gondola-font-family', config.font.family || 'inherit')
    this.element.style.setProperty('--gondola-font-weight', String(weight))
  }

  /**
   * Applies display and original-time state equally during playback and paused seeks.
   */
  updateState(active: boolean, current: boolean) {
    this.element.toggleAttribute('data-active', active)
    this.element.toggleAttribute('data-current', current)
    if (current) {
      this.element.setAttribute('aria-current', 'true')
    } else {
      this.element.removeAttribute('aria-current')
    }
    this.main?.updateState(active, current)
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
    this.element.removeEventListener('keydown', this.handleKeyDown)
    this.main?.dispose()
    for (const background of this.backgrounds) {
      background.dispose()
    }
    this.element.remove()
  }
}

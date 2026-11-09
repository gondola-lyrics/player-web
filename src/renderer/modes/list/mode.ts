import type { RenderChanges, RenderContext } from '../../context'
import type { RenderMode } from '../types'

import { getContentText } from '@gondola-lyrics/model/runtime'

export class ListMode implements RenderMode {
  private readonly element: HTMLDivElement

  /**
   * Mounts into the shared container immediately; content arrives with the first update.
   */
  constructor(private readonly context: RenderContext) {
    this.element = context.document.createElement('div')
    context.container.element.appendChild(this.element)
  }

  /**
   * Rebuilds rows only after a lyric change.
   * Highlights activeIndexes, so display holds and merged groups stay lit together.
   */
  update(changes: RenderChanges): void {
    const { currentInfo, activeIndexes } = this.context.player
    if (changes.lyric) {
      this.element.replaceChildren(
        ...currentInfo.lines.map((line) => {
          const row = this.context.document.createElement('div')
          row.textContent = getContentText(line.content)
          return row
        }),
      )
    }
    const active = new Set(activeIndexes)
    for (const [index, row] of Array.from(this.element.children).entries()) {
      row.toggleAttribute('data-active', active.has(index))
    }
  }

  /**
   * Detaches only this mode's nodes; the container is reused by the next mode.
   */
  dispose(): void {
    this.element.remove()
  }
}

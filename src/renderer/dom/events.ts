import type { EnrichedLine, EnrichedLineBackground } from '@gondola-lyrics/model/enriched'

export interface DomRendererEventMap {
  /**
   * Reports the clicked source, its containing row's zero-based index, and the original mouse event.
   */
  'line-click': (line: EnrichedLine | EnrichedLineBackground, index: number, event: MouseEvent) => void
  /**
   * Reports the source, zero-based row index, and original event so listeners can cancel the browser menu.
   */
  'line-context-menu': (line: EnrichedLine | EnrichedLineBackground, index: number, event: MouseEvent) => void
  /**
   * Emitted once after cleanup and before renderer listeners are removed.
   */
  dispose: () => void
}

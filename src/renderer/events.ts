import type { EnrichedLine } from '@gondola-lyrics/model/enriched'

export interface DomRendererEventMap {
  /**
   * Includes clicks on background content and keyboard activation, retaining the original lyric index.
   */
  'line-click': (line: EnrichedLine, index: number, event: MouseEvent) => void
  /**
   * Leaves default menu handling and any playback action to the host.
   */
  'line-context-menu': (line: EnrichedLine, index: number, event: MouseEvent) => void
  /**
   * Emitted once after cleanup and before renderer listeners are removed.
   */
  dispose: () => void
}

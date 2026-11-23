import type { EnrichedLine, EnrichedLineBackground } from '@gondola-lyrics/model/enriched'

export interface DomRendererEventMap {
  /**
   * Reports the clicked main or background source; index identifies its containing lyric line.
   */
  'line-click': (line: EnrichedLine | EnrichedLineBackground, index: number, event: MouseEvent) => void
  /**
   * Reports the main or background source without taking over the browser's menu or playback.
   */
  'line-context-menu': (line: EnrichedLine | EnrichedLineBackground, index: number, event: MouseEvent) => void
  /**
   * Emitted once after cleanup and before renderer listeners are removed.
   */
  dispose: () => void
}

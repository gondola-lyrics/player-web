export interface DomRendererEventMap {
  /**
   * Emitted once after cleanup and before renderer listeners are removed.
   */
  dispose: () => void
}

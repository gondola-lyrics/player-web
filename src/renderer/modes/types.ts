import type { RenderChanges } from '../context'

/**
 * A mode mounts itself into the shared container when constructed.
 */
export interface RenderMode {
  /**
   * Reads the latest player state; changes lists what happened since the previous update.
   */
  update(changes: RenderChanges): void
  /**
   * Releases only the mode's own nodes, listeners and animations.
   */
  dispose(): void
}

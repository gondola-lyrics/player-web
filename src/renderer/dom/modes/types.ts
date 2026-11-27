import type { RenderChanges } from '@root/renderer/common/types'
import type { DomRendererConfigKeys } from '@root/renderer/dom/config'

/**
 * A mode mounts itself into the shared container when constructed.
 */
export interface RenderMode {
  /**
   * Synchronizes the mode with the changed player, viewport, and configuration state.
   */
  update(changes: RenderChanges<DomRendererConfigKeys>): void
  /**
   * Paints at the given lyric time in milliseconds and returns the next timestamp to repaint.
   * Returning `lyricTime` requests a frame during playback, while `Infinity` leaves the mode idle.
   */
  updateTime(lyricTime: number): number
  /**
   * Releases the mode's nodes, listeners, and animations from the shared viewport.
   */
  dispose(): void
}

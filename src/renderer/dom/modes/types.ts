import type { RenderChanges } from '@root/renderer/common/types'
import type { DomRendererConfigKeys } from '@root/renderer/dom/config'

/**
 * A mode mounts itself into the shared container when constructed.
 */
export interface RenderMode {
  /**
   * Reads the latest player state; changes lists what happened since the previous update.
   */
  update(changes: RenderChanges<DomRendererConfigKeys>): void
  /**
   * Paints the lyric clock in milliseconds and returns the next lyric time requiring a repaint.
   */
  updateTime(lyricTime: number): number
  /**
   * Releases only the mode's own nodes, listeners and animations.
   */
  dispose(): void
}

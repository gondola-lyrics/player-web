import type { RendererSource } from '@root/renderer/common/types'
import type { DomRendererConfigManager } from './config'
import type { Container } from './container'
import type { DomRendererEventMap } from './events'

export interface RenderContext {
  /**
   * The viewport's current owner document, which can change when its host moves.
   */
  readonly document: Document
  /**
   * Shared playback state. The lyric clock in milliseconds is `currentTime + currentOffset`.
   */
  readonly player: RendererSource
  /**
   * Live renderer settings with per-field fallback from mode overrides to shared settings.
   */
  readonly config: DomRendererConfigManager
  /**
   * Renderer-owned viewport where the mode mounts its content and applies style variables.
   */
  readonly container: Container
  /**
   * Coalesces mode-local input and measurement changes with player updates.
   */
  readonly requestUpdate: () => void
  /**
   * Forwards a source click with the containing lyric row's zero-based index.
   */
  readonly onLineClick: DomRendererEventMap['line-click']
  /**
   * Forwards the source's original context-menu event for the listener to handle.
   */
  readonly onLineContextMenu: DomRendererEventMap['line-context-menu']
}

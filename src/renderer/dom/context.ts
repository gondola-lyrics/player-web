import type { RendererSource } from '@root/renderer/common/types'
import type { DomRendererConfigManager } from './config'
import type { Container } from './container'
import type { DomRendererEventMap } from './events'

export interface RenderContext {
  readonly document: Document
  /**
   * Lyric times compare against currentTime plus currentOffset.
   */
  readonly player: RendererSource
  readonly config: DomRendererConfigManager
  readonly container: Container
  /**
   * Coalesces mode-local input and measurement changes with player updates.
   */
  readonly requestUpdate: () => void
  readonly onLineClick: DomRendererEventMap['line-click']
  readonly onLineContextMenu: DomRendererEventMap['line-context-menu']
}

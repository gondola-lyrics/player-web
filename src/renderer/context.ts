import type { CorePlayer } from '@root/core'
import type { DomRendererConfigKeys, DomRendererConfigManager } from './config'
import type { Container } from './container'
import type { DomRendererEventMap } from './events'

export type DomRendererSource = Readonly<
  Pick<CorePlayer, 'currentInfo' | 'currentTime' | 'currentOffset' | 'currentPlaying' | 'activeIndexes' | 'currentIndexes'>
> & {
  readonly event: Pick<CorePlayer['event'], 'add' | 'remove'>
}

export interface RenderContext {
  readonly document: Document
  /**
   * Lyric times compare against currentTime plus currentOffset.
   */
  readonly player: DomRendererSource
  readonly config: DomRendererConfigManager
  readonly container: Container
  /**
   * Coalesces mode-local input and measurement changes with player updates.
   */
  readonly requestUpdate: () => void
  readonly onLineClick: DomRendererEventMap['line-click']
  readonly onLineContextMenu: DomRendererEventMap['line-context-menu']
}

/**
 * Accumulates everything since the previous update, so a mode can skip work that nothing invalidated.
 */
export interface RenderChanges {
  /**
   * Also set for a mode's first update and for reloads that keep the same lyric object.
   */
  readonly lyric: boolean
  readonly size: boolean
  readonly seek: boolean
  readonly config: ReadonlySet<DomRendererConfigKeys>
}

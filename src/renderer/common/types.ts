import type { CorePlayer } from '@root/core'

export type RendererSource = Readonly<
  Pick<CorePlayer, 'currentInfo' | 'currentTime' | 'currentOffset' | 'currentPlaying' | 'activeIndexes' | 'currentIndexes'>
> & {
  readonly event: Pick<CorePlayer['event'], 'add' | 'remove'>
}

/**
 * Accumulates everything since the previous update so a renderer can skip unaffected work.
 */
export interface RenderChanges<Key extends string> {
  /**
   * Includes the first update and reloads that retain the same lyric object.
   */
  readonly lyric: boolean
  readonly size: boolean
  readonly seek: boolean
  readonly config: ReadonlySet<Key>
}

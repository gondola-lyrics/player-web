export interface RenderChanges<Key extends string> {
  /**
   * Rebuilds lyric rows on the initial update or when the lyric is loaded again, including reuse of the same object.
   */
  readonly lyric: boolean
  /**
   * The viewport was resized or its mount ancestry changed.
   */
  readonly size: boolean
  /**
   * Playback was repositioned, including seeks within the same lyric line.
   */
  readonly seek: boolean
  /**
   * Dot-separated paths changed in this batch, including affected parent branches.
   */
  readonly config: ReadonlySet<Key>
}

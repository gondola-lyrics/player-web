import type { EnrichedLine, EnrichedLyric } from '@gondola-lyrics/model/enriched'

/**
 * Playback and lyric state notifications from the core player.
 */
export interface CorePlayerEventMap {
  /**
   * Emitted after initial line synchronization when playback starts, with the position in milliseconds.
   */
  play: (currentTime: number) => void
  /**
   * Emitted when playback pauses, with the frozen position in milliseconds.
   */
  pause: (currentTime: number) => void
  /**
   * Emitted after `seek(time)` or `play(time)` positions the clock, including moves within a line.
   * Both times are playback milliseconds.
   * A newer seek or lyric replacement supersedes a pending notification.
   */
  seek: (currentTime: number, previousTime: number) => void
  /**
   * Reports the loaded lyric after the playback clock returns to zero, including an empty lyric for rejected input.
   */
  'lyric-update': (lyric: EnrichedLyric) => void
  /**
   * Reports display lines after a change or a requested resynchronization.
   *
   * Indexes are zero-based and `firstIndex` is `-1` for an empty set.
   * The `isSeek` flag also marks rematches caused by offset or configuration changes.
   */
  'active-lines-update': (lines: EnrichedLine[], indexes: number[], firstIndex: number, isSeek: boolean) => void
  /**
   * Reports changes to matches in the original timing ranges at the offset-adjusted position.
   *
   * Indexes are zero-based and `firstIndex` is `-1` when no ranges match.
   */
  'current-lines-update': (lines: EnrichedLine[], indexes: number[], firstIndex: number) => void
  /**
   * Emitted after line state synchronizes when the effective offset changes.
   * Both offsets are in milliseconds.
   */
  'offset-update': (offset: number, previousOffset: number) => void
  /**
   * Emitted once after playback state and pending ticks have been cleared.
   */
  dispose: () => void
}

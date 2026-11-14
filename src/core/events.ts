import type { EnrichedLine, EnrichedLyric } from '@gondola-lyrics/model/enriched'

export interface CorePlayerEventMap {
  /**
   * Emitted after initial line synchronization when the lyric clock starts; time is in playback milliseconds.
   */
  play: (currentTime: number) => void
  /**
   * Emitted on a transition from playing to paused, with the frozen playback time in milliseconds.
   */
  pause: (currentTime: number) => void
  /**
   * Emitted after positioning by seek(time) or play(time), including moves within the same line.
   * Both arguments use playback milliseconds; a newer seek or lyric replacement suppresses an obsolete notification.
   */
  seek: (currentTime: number, previousTime: number) => void
  /**
   * Emitted after replacing the lyric and resetting the clock; rejected input is represented by an empty lyric.
   */
  'lyric-update': (lyric: EnrichedLyric) => void
  /**
   * Requests renderer synchronization after display changes or a full rematch, even if the set stays unchanged.
   *
   * Indexes refer to the loaded lyric; firstIndex is -1 for an empty set.
   * isSeek also covers offset and configuration rematches.
   */
  'active-lines-update': (lines: EnrichedLine[], indexes: number[], firstIndex: number, isSeek: boolean) => void
  /**
   * Emitted when original-time matches change, independently of display holds, merging and bridging.
   *
   * Offsets apply to matching; indexes refer to the loaded lyric and firstIndex is -1 for an empty set.
   */
  'current-lines-update': (lines: EnrichedLine[], indexes: number[], firstIndex: number) => void
  /**
   * Emitted only when the combined offset changes during the player's lifetime, after line state is synchronized.
   * Both values are milliseconds added to the playback clock.
   */
  'offset-update': (offset: number, previousOffset: number) => void
  /**
   * Emitted once after state and pending ticks are cleared, while player listeners are still registered.
   */
  dispose: () => void
}

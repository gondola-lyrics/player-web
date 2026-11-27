import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'

/**
 * Partial overrides for playback, lyric offsets, and display matching.
 */
export interface CorePlayerConfig {
  /**
   * Use `'timer'` to schedule ticks with a 16 ms delay when animation frames are unavailable.
   *
   * @default 'animation'
   */
  driver?: 'animation' | 'timer'
  /**
   * Controls the offset added to playback time when matching lyrics.
   */
  offset?: {
    /**
     * Adjustment in milliseconds for every lyric, where positive values advance cues.
     *
     * @default 0
     */
    global?: number
    /**
     * Includes the loaded lyric's metadata offset when matching lines.
     *
     * @default true
     */
    useMeta?: boolean
    /**
     * Clears the temporary offset on lyric replacement so adjustments stay scoped to one lyric.
     *
     * @default true
     */
    resetTempOnLyricChange?: boolean
  }
  /**
   * Includes timed lines between the first and last active display lines to keep the highlight contiguous.
   *
   * @default true
   */
  bridgeActive?: boolean
  /**
   * Groups adjacent display ends less than this many milliseconds apart so the lines leave together.
   * Non-positive values disable merging.
   *
   * @default 300
   */
  mergeWindow?: number
  /**
   * Maximum lines in each merge group, counted from later lines toward earlier ones.
   * Non-positive values allow unlimited group sizes, and one disables merging.
   *
   * @default 3
   */
  mergeLimit?: number
}

export type CorePlayerConfigRequired = DeepRequired<CorePlayerConfig>

/**
 * Dot-separated paths for reading and updating player settings.
 */
export type CorePlayerConfigKeys = NestedKeys<CorePlayerConfig>

export type CorePlayerConfigManager = ConfigManager<CorePlayerConfigRequired, CorePlayerConfig>

export const DEFAULT: CorePlayerConfigRequired = Object.freeze({
  driver: 'animation',
  bridgeActive: true,
  mergeWindow: 300,
  mergeLimit: 3,
  offset: Object.freeze({
    global: 0,
    useMeta: true,
    resetTempOnLyricChange: true,
  }),
})

import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'

/**
 * Omitted fields inherit the player's defaults, including fields within offset.
 */
export interface CorePlayerConfig {
  /**
   * Select 'timer' where requestAnimationFrame is unavailable; it schedules ticks at 16 ms intervals.
   *
   * @default 'animation'
   */
  driver?: 'animation' | 'timer'
  /**
   * Offsets shift the comparison clock for both line sets without changing stored lyric timestamps.
   */
  offset?: {
    /**
     * Adds milliseconds to every lyric's clock; positive values advance lyric cues.
     *
     * @default 0
     */
    global?: number
    /**
     * Includes the loaded lyric's metadata offset in the comparison clock.
     *
     * @default true
     */
    useMeta?: boolean
    /**
     * Resets the temporary offset on updateLyric so per-song adjustments do not carry over.
     *
     * @default true
     */
    resetTempOnLyricChange?: boolean
  }
  /**
   * Fills gaps between simultaneous display lines to keep one continuous highlighted block.
   *
   * @default true
   */
  bridgeActive?: boolean
  /**
   * Groups consecutive display ends less than this many milliseconds apart to avoid successive scroll jumps.
   * Zero disables merging; original lyric times remain unchanged.
   *
   * @default 300
   */
  mergeWindow?: number
  /**
   * Caps each merge batch, counted backward from later lines, so a long run does not leave together.
   * Zero or less removes the cap; one disables merging.
   *
   * @default 3
   */
  mergeLimit?: number
}

export type CorePlayerConfigRequired = DeepRequired<CorePlayerConfig>
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

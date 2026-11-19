import type { DeepRequired } from '@root/utils'

export interface ListModeConfig {
  /**
   * Space between original lyric rows in pixels.
   *
   * @default 24
   */
  gap?: number
  /**
   * @default 'left'
   */
  align?: 'left' | 'center' | 'right'
  scroll?: {
    /**
     * Automatically follows display-active rows when the lyric has line timing.
     *
     * @default true
     */
    follow?: boolean
    /**
     * Main text center as a percentage of viewport height, clamped to 0–100.
     *
     * @default 50
     */
    anchor?: number
    /**
     * Milliseconds without manual scrolling before following resumes.
     * Infinity keeps browsing until an explicit seek or lyric replacement.
     *
     * @default 3000
     */
    resumeDelay?: number
  }
}

export type ListModeConfigRequired = DeepRequired<ListModeConfig>

export const DEFAULT: ListModeConfigRequired = Object.freeze({
  gap: 24,
  align: 'left',
  scroll: Object.freeze({ follow: true, anchor: 50, resumeDelay: 3000 }),
})

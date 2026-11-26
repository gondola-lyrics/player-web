import type { DeepRequired } from '@root/utils'
import type { ContentConfig } from '@root/renderer/dom/components/line/config'

export interface ListScrollAnimationConfig {
  /**
   * Switches between animated row movement and immediate positioning.
   *
   * @default true
   */
  enabled?: boolean
  /**
   * Controls the distribution of start times across rows.
   *
   * @default 'uniform'
   */
  mode?: 'uniform'
  /**
   * Automatic movement time in milliseconds, excluding the start delay. Zero positions immediately.
   *
   * @default 500
   */
  duration?: number
  /**
   * CSS timing function used for the movement.
   *
   * @default 'ease'
   */
  easing?: string
  uniform?: {
    /**
     * Milliseconds before the whole list starts moving together.
     *
     * @default 0
     */
    delay?: number
  }
}

export interface ListModeConfig {
  /**
   * Omitted fields inherit from the renderer's common content configuration.
   */
  content?: ContentConfig
  layout?: {
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
  }
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
    resume?: {
      /**
       * Automatically returns to the playing line after manual browsing.
       *
       * @default true
       */
      enabled?: boolean
      /**
       * Milliseconds of inactivity before following resumes.
       *
       * @default 3000
       */
      delay?: number
    }
    animation?: ListScrollAnimationConfig
  }
}

export type ListModeConfigRequired = DeepRequired<Omit<ListModeConfig, 'content'>> & { content: ContentConfig }

export const DEFAULT: ListModeConfigRequired = Object.freeze({
  content: Object.freeze({}),
  layout: Object.freeze({ gap: 24, align: 'left' }),
  scroll: Object.freeze({
    follow: true,
    anchor: 50,
    resume: Object.freeze({ enabled: true, delay: 3000 }),
    animation: Object.freeze({
      enabled: true,
      mode: 'uniform',
      duration: 500,
      easing: 'ease',
      uniform: Object.freeze({ delay: 0 }),
    }),
  }),
})

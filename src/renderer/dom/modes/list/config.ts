import type { DeepRequired } from '@root/utils'
import type { ContentConfig } from '@root/renderer/dom/components/line/config'

export interface ListScrollAnimationConfig {
  /**
   * Enables scroll transitions when the browser's motion preference allows them.
   *
   * @default true
   */
  enabled?: boolean
  /**
   * The supported `uniform` mode starts all row transitions together.
   *
   * @default 'uniform'
   */
  mode?: 'uniform'
  /**
   * Automatic scroll duration in milliseconds, excluding the start delay. Zero positions rows immediately.
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
  /**
   * Timing settings for transitions that start together.
   */
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
  /**
   * Row spacing and horizontal text alignment.
   */
  layout?: {
    /**
     * Space between lyric rows in CSS pixels.
     *
     * @default 24
     */
    gap?: number
    /**
     * Horizontal alignment of lyric text within each row.
     *
     * @default 'left'
     */
    align?: 'left' | 'center' | 'right'
  }
  /**
   * Playback following, manual browsing recovery, and scroll transitions.
   */
  scroll?: {
    /**
     * Follows display-active rows when line or word timing is available.
     *
     * @default true
     */
    follow?: boolean
    /**
     * Target position for the center of the main text or interlude, clamped to 0–100% of viewport height.
     *
     * @default 50
     */
    anchor?: number
    /**
     * Controls when playback following resumes after manual browsing.
     */
    resume?: {
      /**
       * Automatically returns to the playing line after manual browsing.
       *
       * @default true
       */
      enabled?: boolean
      /**
       * Delay in milliseconds after manual input ends before following resumes.
       *
       * @default 3000
       */
      delay?: number
    }
    /**
     * Transition settings used for automatic following and manual browsing.
     */
    animation?: ListScrollAnimationConfig
  }
}

export type ListModeConfigRequired = DeepRequired<Omit<ListModeConfig, 'content'>> & {
  /**
   * Content overrides, with omitted fields inherited from the shared renderer settings.
   */
  content: ContentConfig
}

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

import type { DeepRequired } from '@root/utils'
import type { LineConfig } from '@root/renderer/dom/components/line/config'
import type { WordConfig } from '@root/renderer/dom/components/word/config'

import { DEFAULT as LINE_DEFAULT } from '@root/renderer/dom/components/line/config'
import { DEFAULT as WORD_DEFAULT } from '@root/renderer/dom/components/word/config'

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
  line?: LineConfig
  word?: WordConfig
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
    animation?: ListScrollAnimationConfig
  }
}

export type ListModeConfigRequired = DeepRequired<ListModeConfig>

export const DEFAULT: ListModeConfigRequired = Object.freeze({
  line: LINE_DEFAULT,
  word: WORD_DEFAULT,
  gap: 24,
  align: 'left',
  scroll: Object.freeze({
    follow: true,
    anchor: 50,
    resumeDelay: 3000,
    animation: Object.freeze({
      enabled: true,
      mode: 'uniform',
      duration: 500,
      easing: 'ease',
      uniform: Object.freeze({ delay: 0 }),
    }),
  }),
})

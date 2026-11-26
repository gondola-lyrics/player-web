import type { DeepRequired } from '@root/utils'
import type { WordConfig } from '../word/config'

import { DEFAULT as WORD_DEFAULT } from '../word/config'

export type ContentUnit = 'line' | 'word'

export interface LineStateStyle {
  /**
   * Uses the source's line state, including when individual words have not started.
   *
   * @default 'currentColor'
   */
  color?: string
  /**
   * Final text opacity from zero to one; zero is supported by plain text and timed masks.
   */
  opacity?: number
}

export interface ContentStyle {
  font?: {
    /**
     * Main text size in pixels; backgrounds scale relative to it.
     *
     * @default 30
     */
    size?: number
    /**
     * Empty values inherit the host's font family.
     */
    family?: string
    /**
     * @default 500
     */
    weight?: number
  }
  /**
   * Main and background sources select their own state from these shared styles.
   * Omitted fields retain that state's value; normal does not override the other states.
   */
  states?: {
    normal?: LineStateStyle
    active?: LineStateStyle
    played?: LineStateStyle
  }
}

export interface ContentConfig {
  /**
   * Word display follows the source segments, including syllables, and falls back to whole-line text per vocal.
   *
   * @default 'word'
   */
  unit?: ContentUnit
  style?: ContentStyle
  /**
   * Effect preferences are retained when switching to whole-line display.
   */
  word?: WordConfig
}

export const DEFAULT: DeepRequired<ContentConfig> = Object.freeze({
  unit: 'word',
  style: Object.freeze({
    font: Object.freeze({ size: 30, family: '', weight: 500 }),
    states: Object.freeze({
      normal: Object.freeze({ color: 'currentColor', opacity: 0.6 }),
      active: Object.freeze({ color: 'currentColor', opacity: 1 }),
      played: Object.freeze({ color: 'currentColor', opacity: 0.4 }),
    }),
  }),
  word: WORD_DEFAULT,
})

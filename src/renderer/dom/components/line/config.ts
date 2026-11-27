import type { DeepRequired } from '@root/utils'
import type { WordConfig } from '../word/config'

import { DEFAULT as WORD_DEFAULT } from '../word/config'

export type ContentUnit = 'line' | 'word'

export interface LineStateStyle {
  /**
   * CSS text color for this state, including timed words.
   *
   * @default 'currentColor'
   */
  color?: string
  /**
   * Text opacity from 0 to 1 for both plain text and timed masks.
   */
  opacity?: number
}

export interface ContentStyle {
  /**
   * Shared typography for main and background text.
   */
  font?: {
    /**
     * Main text size in CSS pixels. Background vocals scale with it.
     *
     * @default 30
     */
    size?: number
    /**
     * CSS font family or list of families. An empty string inherits the host's font family.
     *
     * @default ''
     */
    family?: string
    /**
     * Numeric CSS font weight.
     *
     * @default 500
     */
    weight?: number
  }
  /**
   * Each source selects its own state. Omitted fields inherit the matching state's values.
   */
  states?: {
    /**
     * Base appearance for idle or untimed text, with a default opacity of 0.6.
     */
    normal?: LineStateStyle
    /**
     * Appearance while a source is highlighted, with a default opacity of 1.
     */
    active?: LineStateStyle
    /**
     * Appearance after a source finishes, with a default opacity of 0.4.
     * During manual browsing, played text uses the normal style.
     */
    played?: LineStateStyle
  }
}

export interface ContentConfig {
  /**
   * Word display follows source segments, including syllables, and uses whole-line text for vocals without word data.
   *
   * @default 'word'
   */
  unit?: ContentUnit
  /**
   * Typography and playback-state appearance for lyric text.
   */
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

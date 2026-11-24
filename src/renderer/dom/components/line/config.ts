import type { DeepRequired } from '@root/utils'

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

export interface LineConfig {
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
  style?: {
    normal?: LineStateStyle
    active?: LineStateStyle
    played?: LineStateStyle
  }
}

export type LineConfigRequired = DeepRequired<LineConfig>

export const DEFAULT: LineConfigRequired = Object.freeze({
  font: Object.freeze({ size: 30, family: '', weight: 500 }),
  style: Object.freeze({
    normal: Object.freeze({ color: 'currentColor', opacity: 0.6 }),
    active: Object.freeze({ color: 'currentColor', opacity: 1 }),
    played: Object.freeze({ color: 'currentColor', opacity: 0.4 }),
  }),
})

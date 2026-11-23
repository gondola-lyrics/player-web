import type { DeepRequired } from '@root/utils'

export interface WordConfig {
  /**
   * Highlights sung words using their individual time ranges.
   *
   * @default true
   */
  enabled?: boolean
}

export type WordConfigRequired = DeepRequired<WordConfig>

export const DEFAULT: WordConfigRequired = Object.freeze({ enabled: true })

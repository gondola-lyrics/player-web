import type { DeepRequired } from '@root/utils'

export interface ContentConfig {
  words?: {
    /**
     * Highlights sung words using their individual time ranges.
     *
     * @default true
     */
    enabled?: boolean
  }
  font?: {
    /**
     * Original text size in pixels.
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
}

export type ContentConfigRequired = DeepRequired<ContentConfig>

export const DEFAULT: ContentConfigRequired = Object.freeze({
  words: Object.freeze({ enabled: true }),
  font: Object.freeze({ size: 30, family: '', weight: 500 }),
})

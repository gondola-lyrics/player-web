import type { DeepRequired } from '@root/utils'
import type { WordConfig } from '@root/renderer/dom/components/word/config'

import { DEFAULT as WORD_DEFAULT } from '@root/renderer/dom/components/word/config'

export interface LineConfig {
  words?: WordConfig
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

export type LineConfigRequired = DeepRequired<LineConfig>

export const DEFAULT: LineConfigRequired = Object.freeze({
  words: WORD_DEFAULT,
  font: Object.freeze({ size: 30, family: '', weight: 500 }),
})

import type { DeepRequired } from '@root/utils'

interface WordEffectConfig {
  /**
   * Applies this effect to timed segments in word display mode.
   *
   * @default true
   */
  enabled?: boolean
}

export interface WordConfig {
  /**
   * Sweeps the highlight across each timed source segment.
   */
  mask?: WordEffectConfig
  /**
   * Raises the word as its timing progresses.
   */
  float?: WordEffectConfig
  /**
   * Accents the characters of words marked for vocal emphasis.
   */
  emphasis?: WordEffectConfig
}

export type WordEffects = Readonly<Record<keyof WordConfig, boolean>>

export const DEFAULT: DeepRequired<WordConfig> = Object.freeze({
  mask: Object.freeze({ enabled: true }),
  float: Object.freeze({ enabled: true }),
  emphasis: Object.freeze({ enabled: true }),
})

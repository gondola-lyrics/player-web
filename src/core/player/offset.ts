import type { EnrichedLyric } from '@gondola-lyrics/model/enriched'

export class Offset {
  private temporary = 0
  private metadata = 0

  /**
   * Sets the temporary adjustment in milliseconds, treating non-finite input as zero.
   */
  setTemp(value: number) {
    this.temporary = Number.isFinite(value) ? value : 0
  }

  resetTemp() {
    this.temporary = 0
  }

  /**
   * Refreshes the metadata offset, using zero when disabled, absent, or non-finite.
   */
  refreshFromMeta(lyric: EnrichedLyric, enabled: boolean) {
    const value = enabled ? lyric.meta?.offset : undefined
    this.metadata = typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  /**
   * Returns the combined offset in milliseconds, or zero when the sum is non-finite.
   */
  resolve(global: number): number {
    const value = global + this.metadata + this.temporary
    return Number.isFinite(value) ? value : 0
  }
}

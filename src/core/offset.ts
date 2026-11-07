import type { Lyric } from '@gondola-lyrics/model/runtime'

export class Offset {
  private temporary = 0
  private metadata = 0

  /**
   * Treats non-finite input as zero so it cannot invalidate later clock comparisons.
   */
  setTemp(value: number): void {
    this.temporary = Number.isFinite(value) ? value : 0
  }

  /**
   * Clears the per-song adjustment while preserving the loaded metadata offset.
   */
  resetTemp(): void {
    this.temporary = 0
  }

  /**
   * Re-reads the lyric offset when metadata use changes; missing or non-finite values contribute zero.
   */
  refreshFromMeta(lyric: Lyric, enabled: boolean): void {
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

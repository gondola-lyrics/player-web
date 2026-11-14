import type { EnrichedLine } from '@gondola-lyrics/model/enriched'

export class Merger {
  private lines: EnrichedLine[] = []
  private mergedEnd: number[] = []

  private getRawTime(index: number): number {
    const time = this.lines[index]?.time
    if (!time) {
      return 0
    }
    // Keep the display anchored through gaps and after the final cue.
    if (index === this.lines.length - 1) {
      return Infinity
    }
    return Math.max(time.end ?? Infinity, this.lines[index + 1]?.time?.start ?? time.start)
  }

  /**
   * Coalesces nearby display ends so clustered lines deactivate together without changing their original ranges.
   */
  build(lines: EnrichedLine[], mergeWindow: number, mergeLimit: number): void {
    this.lines = lines
    this.mergedEnd = new Array<number>(lines.length)

    const threshold = Math.max(0, mergeWindow)
    const limit = mergeLimit > 0 ? mergeLimit : Infinity

    let nextRaw = Infinity
    let nextMerged = Infinity
    let batchSize = 0

    for (let index = lines.length - 1; index >= 0; index--) {
      const raw = this.getRawTime(index)
      if (threshold > 0 && batchSize < limit && Math.abs(nextRaw - raw) < threshold) {
        nextMerged = Math.max(raw, nextMerged)
        batchSize++
      } else {
        nextMerged = raw
        batchSize = 1
      }
      this.mergedEnd[index] = nextMerged
      nextRaw = raw
    }
  }

  /**
   * Returns milliseconds, with Infinity for an open or final display end and zero for an unavailable index.
   */
  getMergedTime(index: number): number {
    return this.mergedEnd[index] ?? this.getRawTime(index)
  }
}

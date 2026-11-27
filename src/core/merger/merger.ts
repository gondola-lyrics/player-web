import type { EnrichedLine } from '@gondola-lyrics/model/enriched'

export class CoreMerger {
  private lines: EnrichedLine[] = []
  private mergedEnd: number[] = []

  private getRawTime(index: number): number {
    const time = this.lines[index]?.time
    if (!time) {
      return 0
    }
    if (index === this.lines.length - 1) {
      return Infinity
    }
    return Math.max(time.end ?? Infinity, this.lines[index + 1]?.time?.start ?? time.start)
  }

  /**
   * Holds lines through gaps and groups nearby display ends so clustered lines deactivate together.
   *
   * @param lines - Lyric lines ordered by start time.
   * @param mergeWindow - Distance in milliseconds between adjacent display ends, exclusive.
   * @param mergeLimit - Maximum lines per group, with a non-positive value allowing unlimited group sizes.
   */
  build(lines: EnrichedLine[], mergeWindow: number, mergeLimit: number) {
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
   * Returns the display end in lyric milliseconds, or zero for a missing line.
   * An open end or a timed final cue retains `Infinity`.
   */
  getMergedTime(index: number): number {
    return this.mergedEnd[index] ?? this.getRawTime(index)
  }
}

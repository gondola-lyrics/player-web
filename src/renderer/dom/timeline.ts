import type { TimeRange } from '@gondola-lyrics/model/common'

export interface TimeCue {
  /**
   * Start and optional end on the offset-adjusted lyric clock in milliseconds.
   */
  readonly range: TimeRange
  /**
   * Samples at the given lyric time and returns true while frame updates are needed between boundaries.
   */
  update: (lyricTime: number) => boolean
}

export class RenderTimeline {
  private readonly boundaries: { at: number; cue: TimeCue }[] = []
  private readonly updating = new Set<TimeCue>()
  private cursor = 0

  /**
   * Indexes cue boundaries by time and samples every new cue on the next update.
   */
  replace(cues: readonly TimeCue[]) {
    this.boundaries.length = 0
    this.updating.clear()
    this.cursor = 0

    for (const cue of cues) {
      const { start, end } = cue.range
      this.boundaries.push({ at: start, cue })
      if (end !== undefined && end > start) {
        this.boundaries.push({ at: end, cue })
      }
      this.updating.add(cue)
    }

    this.boundaries.sort((a, b) => a.at - b.at)
  }

  /**
   * Repaints crossed boundaries in either direction and returns the next lyric timestamp in milliseconds.
   * Returning `lyricTime` requests a frame during playback, while `Infinity` leaves the timeline idle.
   */
  updateTime(lyricTime: number): number {
    while (this.cursor > 0 && this.boundaries[this.cursor - 1]!.at > lyricTime) {
      this.cursor--
      this.updating.add(this.boundaries[this.cursor]!.cue)
    }

    while (this.cursor < this.boundaries.length && this.boundaries[this.cursor]!.at <= lyricTime) {
      this.updating.add(this.boundaries[this.cursor]!.cue)
      this.cursor++
    }

    for (const cue of this.updating) {
      if (!cue.update(lyricTime)) {
        this.updating.delete(cue)
      }
    }

    return this.updating.size > 0 ? lyricTime : (this.boundaries[this.cursor]?.at ?? Infinity)
  }
}

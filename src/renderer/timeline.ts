import type { TimeRange } from '@gondola-lyrics/model/common'

export interface TimeCue {
  readonly range: TimeRange
  /**
   * Returns true while the appearance changes between boundaries.
   */
  update: (lyricTime: number) => boolean
}

export class RenderTimeline {
  private readonly boundaries: { at: number; cue: TimeCue }[] = []
  private readonly updating = new Set<TimeCue>()
  private cursor = 0

  /**
   * Reindexes mounted content in time order independently of its reading order.
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
   * Repaints crossed boundaries in either direction and returns the next lyric time that needs painting.
   * The current time requests a frame, while infinity leaves the renderer idle.
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

import type { TimeRange } from '@gondola-lyrics/model/common'
import type { TimeCue } from '@root/renderer/dom/timeline'

import { getTimeRangeDuration } from '@gondola-lyrics/model/common'

const FLOAT_LEAD = 400
const FLOAT_DURATION_SCALE = 1.4
const RELEASE_RATE = 4
const RISE = 'cubic-bezier(0.2, 0.4, 0.58, 1)'
const FALL = 'cubic-bezier(0.3, 0, 0.58, 1)'
const FLOAT_EASING = 'cubic-bezier(0.45, 0, 0.55, 1)'
const REST = 'scale3d(1, 1, 1) translate3d(0px, 0px, 0px)'

const round = (value: number) => {
  return Math.round(value * 1000) / 1000
}

const intensity = (ratio: number, scale: number, limit: number) => {
  return Math.min(limit, (ratio > 1 ? Math.sqrt(ratio) : ratio ** 3) * scale)
}

export class WordMotion {
  readonly cues: TimeCue[] = []

  private readonly duration: number
  private readonly stagger: number
  private readonly emphasisEnd: number
  private readonly start: number
  private readonly blockEnd: number
  private float?: Animation
  private raised = false
  private readonly emphasis: Animation[] = []
  private lastTime = NaN

  constructor(
    private readonly word: HTMLElement,
    private readonly chars: readonly HTMLElement[],
    private readonly range: TimeRange,
    block: TimeRange | undefined,
    private readonly background: boolean,
    private readonly floatEnabled: boolean,
  ) {
    this.duration = Math.max(1000, getTimeRangeDuration(range) ?? 0)
    this.stagger = chars.length ? this.duration / 2.5 / chars.length : 0
    const lastDelay = this.stagger * (chars.length - 1)
    this.emphasisEnd = chars.length ? lastDelay + Math.max(this.duration, this.duration * FLOAT_DURATION_SCALE - FLOAT_LEAD) : 0
    this.start = Math.max(block?.start ?? range.start, range.start - (chars.length ? FLOAT_LEAD : 0))
    this.blockEnd = block?.end ?? Infinity

    if (this.blockEnd <= this.start) {
      return
    }

    const entranceEnd = range.start + Math.max(this.duration, this.emphasisEnd)
    this.addCue(this.start, Math.min(this.blockEnd, entranceEnd))
    if (Number.isFinite(this.blockEnd)) {
      const atExit = this.blockEnd - range.start
      // The word returns at normal speed while any unfinished character accents run to completion at four times speed.
      const floatRelease = this.floatEnabled ? Math.min(this.duration, atExit) : 0
      const release = Math.max(floatRelease, (this.emphasisEnd - atExit) / RELEASE_RATE)
      this.addCue(this.blockEnd, this.blockEnd + release)
    }
  }

  private addCue(start: number, end: number) {
    if (end <= start) {
      return
    }

    this.cues.push({
      range: { start, end },
      update: (lyricTime) => {
        if (this.lastTime !== lyricTime) {
          this.lastTime = lyricTime
          this.update(lyricTime)
        }
        return lyricTime >= start && lyricTime < end
      },
    })
  }

  private update(lyricTime: number) {
    const local = lyricTime - this.range.start
    const release = Math.max(0, lyricTime - this.blockEnd)
    const during = Math.min(local, this.blockEnd - this.range.start)

    if (this.floatEnabled) {
      this.updateFloat(lyricTime < this.start ? 0 : Math.min(this.duration, during) - release)
    }
    if (this.chars.length) {
      this.updateEmphasis(lyricTime < this.start ? -FLOAT_LEAD : during + release * RELEASE_RATE)
    }
  }

  private updateFloat(time: number) {
    const raised = time >= this.duration
    if (raised !== this.raised) {
      this.raised = raised
      this.word.style.translate = raised ? '0 -2px' : ''
    }

    if (time <= 0 || raised) {
      this.float?.cancel()
      this.float = undefined
      return
    }

    if (!this.float) {
      this.float = this.word.animate([{ transform: 'translateY(0px)' }, { transform: 'translateY(-2px)' }], {
        duration: this.duration,
        easing: 'ease',
        composite: 'add',
        fill: 'both',
      })
      this.float.pause()
    }

    this.float.currentTime = time
  }

  private createEmphasis() {
    const main = intensity(this.duration / 2000, 0.6, 1.2)
    const glow = intensity(this.duration / 3000, 0.5, 0.8)
    const scale = round(1 + 0.1 * main)
    const radius = round(9 * glow)
    const resetShadow = `0 0 ${radius}px rgba(0, 0, 0, 0)`
    const peakShadow = `0 0 ${radius}px rgba(0, 0, 0, ${round(glow)})`

    for (const [index, char] of this.chars.entries()) {
      const delay = this.stagger * index
      const x = round(-round(main) * (this.chars.length / 2 - index))
      const peak = `scale3d(${scale}, ${scale}, 1) translate3d(${x}px, ${round(-main)}px, 0px)`

      const accent = char.animate(
        [
          { transform: REST, textShadow: resetShadow, easing: RISE },
          { offset: 0.5, transform: peak, textShadow: peakShadow, easing: FALL },
          { transform: REST, textShadow: resetShadow },
        ],
        { delay: FLOAT_LEAD + delay, duration: this.duration, fill: 'both' },
      )

      const lift = char.animate(
        [
          { transform: 'translateY(0px)', easing: FLOAT_EASING },
          { offset: 0.5, transform: `translateY(${this.background ? -4 : -2}px)`, easing: FLOAT_EASING },
          { transform: 'translateY(0px)' },
        ],
        { delay, duration: this.duration * FLOAT_DURATION_SCALE, fill: 'both', composite: 'add' },
      )

      accent.pause()
      lift.pause()
      this.emphasis.push(accent, lift)
    }
  }

  private updateEmphasis(time: number) {
    if (time <= -FLOAT_LEAD || time >= this.emphasisEnd) {
      this.clearEmphasis()
      return
    }

    if (this.emphasis.length === 0) {
      this.createEmphasis()
    }

    for (const animation of this.emphasis) {
      animation.currentTime = time + FLOAT_LEAD
    }
  }

  private clearEmphasis() {
    for (const animation of this.emphasis) {
      animation.cancel()
    }

    this.emphasis.length = 0
  }

  /**
   * Releases the character effects and the word's held lift when its text representation is replaced.
   */
  dispose() {
    this.updateFloat(0)
    this.clearEmphasis()
  }
}

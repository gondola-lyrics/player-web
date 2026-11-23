import type { EnrichedLine, EnrichedLyric } from '@gondola-lyrics/model/enriched'
import type { CorePlayerConfigKeys, CorePlayerConfigManager } from './config'
import type { CorePlayerEventMap } from './events'

import { TimingLevel, isTimeInTimeRange } from '@gondola-lyrics/model/common'
import { EnrichedLyricStatus, makeEnrichedLyric } from '@gondola-lyrics/model/enriched'
import { SCHEMA_VERSION } from '@gondola-lyrics/model/version'
import { major, parse } from 'semver'

import { CoreMerger } from '@root/core/merger/merger'
import { ConfigManager, Event } from '@root/utils'

import { DEFAULT } from './config'
import { Driver } from './driver'
import { Offset } from './offset'

const SUPPORTED_SCHEMA_MAJOR = major(SCHEMA_VERSION)

interface PlaybackClock {
  running: boolean
  position: number
  startedAt: number
}

interface MatchedLines {
  lines: EnrichedLine[]
  indexes: number[]
}

interface LineState {
  display: MatchedLines
  current: MatchedLines
  nextLineIndex: number
}

const makeEmptyMatches = (): MatchedLines => {
  return { lines: [], indexes: [] }
}

const makeEmptyLyric = (): EnrichedLyric => {
  return makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.NONE })
}

export class CorePlayer {
  readonly config: CorePlayerConfigManager = new ConfigManager(DEFAULT)
  readonly event = new Event<CorePlayerEventMap>()

  private isDisposed = false
  private lyric = makeEmptyLyric()

  private clock: PlaybackClock = { running: false, position: 0, startedAt: 0 }
  private pendingSeek: { time: number; previousTime: number } | null = null

  private activeLinesUpdatePending = false
  private activeLinesNeedResync = false

  private display = makeEmptyMatches()
  private timeMatched = makeEmptyMatches()

  private lastEmittedOffset = 0
  private lastEmittedCurrent = makeEmptyMatches()

  private nextLineIndex = 0

  private readonly lineMerger = new CoreMerger()
  private readonly offsetState = new Offset()
  private readonly tickDriver = new Driver()

  constructor() {
    this.config.event.add('update', this.handleConfigUpdate)
  }

  private handleConfigUpdate = (changedKeys: Set<CorePlayerConfigKeys>) => {
    if (this.isDisposed) {
      return
    }

    const metadataUsageChanged = changedKeys.has('offset.useMeta')
    const mergeConfigChanged = changedKeys.has('mergeWindow') || changedKeys.has('mergeLimit')
    const timingConfigChanged = changedKeys.has('offset.global') || changedKeys.has('bridgeActive')

    if (metadataUsageChanged) {
      this.offsetState.refreshFromMeta(this.lyric, this.config.current.offset.useMeta)
    }
    if (mergeConfigChanged) {
      this.rebuildDisplayEndTimes()
    }
    if (metadataUsageChanged || mergeConfigChanged || timingConfigChanged) {
      this.resyncLineState()
    }

    if (changedKeys.has('driver') && this.clock.running) {
      this.tickDriver.schedule(this.config.current.driver, this.handleTick)
    }
  }

  private rebuildDisplayEndTimes() {
    this.lineMerger.build(this.lyric.lines, this.config.current.mergeWindow, this.config.current.mergeLimit)
  }

  private get lyricTime(): number {
    return this.currentTime + this.currentOffset
  }

  private get hasLineTiming(): boolean {
    return this.lyric.timing === TimingLevel.LINE || this.lyric.timing === TimingLevel.WORD
  }

  private bridgeActiveLines(matches: MatchedLines): MatchedLines {
    if (!this.config.current.bridgeActive) {
      return matches
    }

    const { indexes } = matches
    const firstIndex = indexes[0]
    const lastIndex = indexes[indexes.length - 1]
    if (firstIndex === undefined || lastIndex === undefined) {
      return matches
    }

    const hasGaps = lastIndex - firstIndex + 1 !== indexes.length
    if (!hasGaps) {
      return matches
    }

    const bridged = makeEmptyMatches()
    for (let lineIndex = firstIndex; lineIndex <= lastIndex; lineIndex++) {
      const line = this.lyric.lines[lineIndex]
      if (line?.time) {
        bridged.lines.push(line)
        bridged.indexes.push(lineIndex)
      }
    }

    return bridged
  }

  private emitOffsetUpdate() {
    const effectiveOffset = this.currentOffset
    if (this.isDisposed || effectiveOffset === this.lastEmittedOffset) {
      return
    }

    const previousOffset = this.lastEmittedOffset
    this.lastEmittedOffset = effectiveOffset
    this.event.emit('offset-update', effectiveOffset, previousOffset)
  }

  private emitActiveLinesUpdate(needsResync: boolean) {
    const { lines, indexes } = this.bridgeActiveLines(this.display)
    this.event.emit('active-lines-update', lines, indexes, indexes[0] ?? -1, needsResync)
  }

  private emitCurrentLinesUpdate() {
    const { lines, indexes } = this.timeMatched
    const matchesLastEmission =
      lines.length === this.lastEmittedCurrent.lines.length &&
      lines.every((line, index) => {
        return line === this.lastEmittedCurrent.lines[index] && indexes[index] === this.lastEmittedCurrent.indexes[index]
      })

    if (matchesLastEmission) {
      return
    }

    this.lastEmittedCurrent = this.timeMatched
    this.event.emit('current-lines-update', lines, indexes, indexes[0] ?? -1)
  }

  private flushStateEvents() {
    if (this.isDisposed) {
      return
    }

    this.emitOffsetUpdate()
    if (this.isDisposed) {
      return
    }

    this.emitCurrentLinesUpdate()

    // Reentrant listeners flush the latest state; do not retain an earlier line snapshot here.
    if (!this.isDisposed && this.activeLinesUpdatePending) {
      const needsResync = this.activeLinesNeedResync
      this.activeLinesUpdatePending = false
      this.activeLinesNeedResync = false
      this.emitActiveLinesUpdate(needsResync)
    }
  }

  private matchLineState(lyricTime: number): LineState {
    const state: LineState = {
      display: makeEmptyMatches(),
      current: makeEmptyMatches(),
      nextLineIndex: this.lyric.lines.length,
    }

    if (!this.hasLineTiming || !Number.isFinite(lyricTime)) {
      return state
    }

    // Start-sorted input lets the scan stop at the first future line without changing event indexes.
    for (const [lineIndex, line] of this.lyric.lines.entries()) {
      if (!line.time) {
        continue
      }

      if (line.time.start > lyricTime) {
        state.nextLineIndex = lineIndex
        break
      }

      if (lyricTime < this.lineMerger.getMergedTime(lineIndex)) {
        state.display.lines.push(line)
        state.display.indexes.push(lineIndex)
      }

      if (isTimeInTimeRange(line.time, lyricTime)) {
        state.current.lines.push(line)
        state.current.indexes.push(lineIndex)
      }
    }

    return state
  }

  private rebuildLineState(needsResync: boolean) {
    const matches = this.matchLineState(this.lyricTime)
    this.display = matches.display
    this.timeMatched = matches.current
    this.nextLineIndex = matches.nextLineIndex

    this.activeLinesUpdatePending = true
    this.activeLinesNeedResync = needsResync
  }

  private resyncLineState() {
    this.rebuildLineState(true)
    this.flushStateEvents()
  }

  private retainDisplayLines(lyricTime: number): MatchedLines {
    const matches = makeEmptyMatches()

    for (const lineIndex of this.display.indexes) {
      const line = this.lyric.lines[lineIndex]
      if (line && lyricTime < this.lineMerger.getMergedTime(lineIndex)) {
        matches.lines.push(line)
        matches.indexes.push(lineIndex)
      }
    }

    return matches
  }

  private retainCurrentLines(lyricTime: number): MatchedLines {
    const matches = makeEmptyMatches()

    for (const lineIndex of this.timeMatched.indexes) {
      const line = this.lyric.lines[lineIndex]
      if (line && isTimeInTimeRange(line.time, lyricTime)) {
        matches.lines.push(line)
        matches.indexes.push(lineIndex)
      }
    }

    return matches
  }

  private appendStartedLines(lyricTime: number, display: MatchedLines, current: MatchedLines) {
    while (this.nextLineIndex < this.lyric.lines.length) {
      const lineIndex = this.nextLineIndex
      const line = this.lyric.lines[lineIndex]
      if (!line?.time) {
        this.nextLineIndex++
        continue
      }

      if (line.time.start > lyricTime) {
        break
      }

      if (lyricTime < this.lineMerger.getMergedTime(lineIndex)) {
        display.lines.push(line)
        display.indexes.push(lineIndex)
      }

      if (isTimeInTimeRange(line.time, lyricTime)) {
        current.lines.push(line)
        current.indexes.push(lineIndex)
      }

      this.nextLineIndex++
    }
  }

  private advanceLineState(lyricTime: number) {
    if (!this.hasLineTiming || !Number.isFinite(lyricTime)) {
      return
    }

    const display = this.retainDisplayLines(lyricTime)
    const current = this.retainCurrentLines(lyricTime)
    const retainedDisplayCount = display.indexes.length
    const retainedCurrentCount = current.indexes.length

    this.appendStartedLines(lyricTime, display, current)

    const displayChanged = retainedDisplayCount !== this.display.indexes.length || display.indexes.length !== retainedDisplayCount
    const currentChanged = retainedCurrentCount !== this.timeMatched.indexes.length || current.indexes.length !== retainedCurrentCount

    if (displayChanged) {
      this.display = display
      this.activeLinesUpdatePending = true
    }
    if (currentChanged) {
      this.timeMatched = current
    }
  }

  private handleTick = () => {
    if (!this.clock.running || this.isDisposed) {
      return
    }

    // Schedule first so a listener's pause, seek or disposal can cancel or replace the next tick.
    this.tickDriver.schedule(this.config.current.driver, this.handleTick)
    this.advanceLineState(this.lyricTime)
    this.flushStateEvents()
  }

  private pauseClock(): PlaybackClock {
    const previousClock = this.clock
    const pausedClock = { ...previousClock, running: false, position: this.currentTime }
    this.clock = pausedClock
    this.tickDriver.cancel()

    if (previousClock.running) {
      if (!this.isDisposed) {
        this.advanceLineState(this.lyricTime)
      }
      this.event.emit('pause', pausedClock.position)
      this.flushStateEvents()
    }

    return pausedClock
  }

  private moveClock(playbackTime: number): PlaybackClock {
    const notification = { time: playbackTime, previousTime: this.currentTime }
    const positionedClock = { ...this.clock, position: playbackTime, startedAt: performance.now() }
    this.clock = positionedClock
    this.pendingSeek = notification
    this.tickDriver.cancel()
    if (positionedClock.running) {
      this.tickDriver.schedule(this.config.current.driver, this.handleTick)
    }

    this.resyncLineState()
    if (!this.isDisposed && this.pendingSeek === notification) {
      this.pendingSeek = null
      this.event.emit('seek', notification.time, notification.previousTime)
    }

    return positionedClock
  }

  /**
   * Replaces the lyric at playback time zero and leaves the player paused.
   *
   * @param lyric - Supply lines sorted by start time; their objects and indexes are retained.
   *
   * @remarks
   * Invalid parse status, malformed versions or a different schema major load an empty lyric.
   */
  updateLyric(lyric: EnrichedLyric) {
    if (this.isDisposed || !lyric) {
      return
    }

    let nextLyric = lyric
    if (parse(lyric.version)?.major !== SUPPORTED_SCHEMA_MAJOR) {
      console.warn(`[@gondola-lyrics/player] ignored lyric with incompatible version "${lyric.version}", expected major ${SUPPORTED_SCHEMA_MAJOR}`)
      nextLyric = makeEmptyLyric()
    } else if (lyric.status !== EnrichedLyricStatus.VALID) {
      nextLyric = makeEmptyLyric()
    }

    const pausedClock = this.pauseClock()
    if (this.isDisposed || this.clock !== pausedClock) {
      return
    }

    this.pendingSeek = null
    this.lyric = nextLyric
    this.rebuildDisplayEndTimes()
    this.offsetState.refreshFromMeta(nextLyric, this.config.current.offset.useMeta)
    if (this.config.current.offset.resetTempOnLyricChange) {
      this.offsetState.resetTemp()
    }

    this.clock = { ...pausedClock, position: 0 }
    this.rebuildLineState(false)

    this.event.emit('lyric-update', nextLyric)
    this.flushStateEvents()
  }

  /**
   * Starts from the stored position, optionally seeking before playback begins.
   *
   * @param playbackTime - Use playback milliseconds without lyric offset; non-finite values keep the stored position.
   *
   * @remarks
   * Calling play on a running player pauses it before restarting.
   */
  play(playbackTime?: number) {
    if (this.isDisposed) {
      return
    }

    let expectedClock = this.pauseClock()
    if (this.isDisposed || this.clock !== expectedClock) {
      return
    }

    if (typeof playbackTime === 'number' && Number.isFinite(playbackTime)) {
      expectedClock = this.moveClock(playbackTime)
    }

    if (this.isDisposed || this.clock !== expectedClock) {
      return
    }

    const runningClock = { ...expectedClock, running: true, startedAt: performance.now() }
    this.clock = runningClock
    this.handleTick()
    if (!this.isDisposed && this.clock === runningClock) {
      this.event.emit('play', this.currentTime)
    }
  }

  /**
   * Repositions both line sets while preserving whether the clock is running.
   *
   * @param playbackTime - Use playback milliseconds without lyric offset; non-finite values are ignored.
   *
   * @remarks
   * A completed request emits seek even when the target remains within the same line.
   */
  seek(playbackTime: number) {
    if (this.isDisposed || !Number.isFinite(playbackTime)) {
      return
    }

    this.moveClock(playbackTime)
  }

  /**
   * Freezes the clock and synchronizes both line sets to the frozen time.
   * Repeated calls while paused do not emit another pause event.
   */
  pause() {
    if (this.isDisposed) {
      return
    }

    this.pauseClock()
  }

  /**
   * Permanently releases player state; further playback commands have no effect.
   *
   * Emits dispose once after cleanup and before removing player listeners.
   */
  dispose() {
    if (this.isDisposed) {
      return
    }

    this.isDisposed = true
    this.pendingSeek = null
    this.pauseClock()
    this.config.event.remove('update', this.handleConfigUpdate)

    this.display = makeEmptyMatches()
    this.timeMatched = makeEmptyMatches()
    this.lastEmittedCurrent = makeEmptyMatches()
    this.activeLinesUpdatePending = false
    this.activeLinesNeedResync = false

    this.lyric = makeEmptyLyric()
    this.nextLineIndex = 0
    this.clock = { running: false, position: 0, startedAt: 0 }
    this.offsetState.resetTemp()
    this.offsetState.refreshFromMeta(this.lyric, false)
    this.rebuildDisplayEndTimes()

    this.event.emit('dispose')
    this.event.clear()
  }

  /**
   * Applies a temporary adjustment and immediately rematches both line sets, including while paused.
   *
   * @param offset - Add these milliseconds to global and metadata offsets; non-finite values clear the temporary adjustment.
   */
  updateTempOffset(offset: number) {
    if (this.isDisposed) {
      return
    }

    this.offsetState.setTemp(offset)
    this.resyncLineState()
  }

  /**
   * Queries display state without moving the clock or emitting events.
   *
   * @param playbackTime - Use playback milliseconds before the effective offset is applied.
   *
   * @returns The result includes display holds, merging and bridging; untimed lyrics yield empty arrays.
   */
  matchLinesWithTime(playbackTime: number): { lines: EnrichedLine[]; index: number[] } {
    const matches = this.matchLineState(playbackTime + this.currentOffset)
    const { lines, indexes } = this.bridgeActiveLines(matches.display)
    return { lines, index: indexes }
  }

  /**
   * Converts a stored lyric timestamp to a seek target by removing the effective offset.
   *
   * @param contentTime - Use a timestamp from the lyric in milliseconds.
   *
   * @returns The playback timestamp may be negative when a positive offset advances the cue before time zero.
   */
  convertContentTime(contentTime: number): number {
    return contentTime - this.currentOffset
  }

  /**
   * Reflects the lyric clock only; audio playback is controlled by the caller.
   */
  get currentPlaying(): boolean {
    return this.clock.running
  }

  /**
   * Display policies can keep these lines highlighted after their original ranges end.
   */
  get activeLines(): EnrichedLine[] {
    return this.bridgeActiveLines(this.display).lines
  }

  /**
   * Indexes refer to currentInfo.lines, including lines added by display bridging.
   */
  get activeIndexes(): number[] {
    return this.bridgeActiveLines(this.display).indexes
  }

  /**
   * Returns -1 when no display line is active.
   */
  get firstActiveIndex(): number {
    return this.display.indexes[0] ?? -1
  }

  /**
   * Matches original [start, end) ranges at the last synchronization, with the effective offset applied.
   * Unknown ends stay open; display holds, merging and bridging do not affect this set.
   */
  get currentLines(): EnrichedLine[] {
    return this.timeMatched.lines
  }

  /**
   * Indexes refer to currentInfo.lines; overlapping ranges can produce several entries and gaps produce none.
   */
  get currentIndexes(): number[] {
    return this.timeMatched.indexes
  }

  /**
   * Returns -1 when no original range matches, even if a display line remains highlighted.
   */
  get firstCurrentIndex(): number {
    return this.timeMatched.indexes[0] ?? -1
  }

  /**
   * Accepted lyrics retain object identity; call updateLyric after edits to rebuild timing state.
   */
  get currentInfo(): EnrichedLyric {
    return this.lyric
  }

  /**
   * Reports playback milliseconds without lyric offsets; paused clocks retain their position.
   */
  get currentTime(): number {
    const { running, position, startedAt } = this.clock
    return running ? position + performance.now() - startedAt : position
  }

  /**
   * Adds global, metadata and temporary milliseconds; returns zero after disposal or for a non-finite total.
   */
  get currentOffset(): number {
    return this.isDisposed ? 0 : this.offsetState.resolve(this.config.current.offset.global)
  }
}

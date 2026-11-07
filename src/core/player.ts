import type { Line, Lyric } from '@gondola-lyrics/model/runtime'
import type { CorePlayerConfigKeys, CorePlayerConfigManager } from './config'
import type { CorePlayerEventMap } from './events'

import { LyricStatus, Timing, isTimeRangeActive, makeLyric } from '@gondola-lyrics/model/runtime'
import { SCHEMA_VERSION } from '@gondola-lyrics/model/version'
import { major, parse } from 'semver'

import { ConfigManager, Event } from '@root/utils'

import { DEFAULT } from './config'
import { Driver } from './driver'
import { Merger } from './merger'
import { Offset } from './offset'

const SUPPORTED_SCHEMA_MAJOR = major(SCHEMA_VERSION)

interface PlaybackClock {
  running: boolean
  position: number
  startedAt: number
}

const makeEmptyLyric = (): Lyric => {
  return makeLyric({ status: LyricStatus.VALID, timing: Timing.NONE })
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

  private displayLines: Line[] = []
  private displayLineIndexes: number[] = []

  private timeMatchedLines: Line[] = []
  private timeMatchedIndexes: number[] = []

  private lastEmittedOffset = 0
  private lastEmittedCurrentLines: Line[] = []
  private lastEmittedCurrentIndexes: number[] = []

  private nextLineIndex = 0

  private readonly lineMerger = new Merger()
  private readonly offsetState = new Offset()
  private readonly tickDriver = new Driver()

  constructor() {
    this.config.event.add('update', this.handleConfigUpdate)
  }

  private handleConfigUpdate = (changedKeys: Set<CorePlayerConfigKeys>): void => {
    if (this.isDisposed) {
      return
    }
    const metadataUsageChanged = changedKeys.has('offset.useMeta')
    const mergeConfigChanged = changedKeys.has('mergeWindow') || changedKeys.has('mergeLimit')

    if (metadataUsageChanged) {
      this.offsetState.refreshFromMeta(this.lyric, this.config.current.offset.useMeta)
    }
    if (mergeConfigChanged) {
      this.rebuildDisplayEndTimes()
    }
    if (metadataUsageChanged || mergeConfigChanged || changedKeys.has('offset.global') || changedKeys.has('bridgeActive')) {
      this.resyncLineState()
    }
    if (changedKeys.has('driver') && this.clock.running) {
      this.tickDriver.schedule(this.config.current.driver, this.handleTick)
    }
  }

  private rebuildDisplayEndTimes(): void {
    this.lineMerger.build(this.lyric.lines, this.config.current.mergeWindow, this.config.current.mergeLimit)
  }

  private get lyricTime(): number {
    return this.currentTime + this.currentOffset
  }

  private get hasLineTiming(): boolean {
    return this.lyric.timing === Timing.LINE || this.lyric.timing === Timing.WORD
  }

  private bridgeActiveLines(lines: Line[], indexes: number[]): { lines: Line[]; indexes: number[] } {
    const firstIndex = indexes[0]
    const lastIndex = indexes[indexes.length - 1]
    if (!this.config.current.bridgeActive || firstIndex === undefined || lastIndex === undefined || lastIndex - firstIndex + 1 === indexes.length) {
      return { lines, indexes }
    }

    const bridgedLines: Line[] = []
    const bridgedIndexes: number[] = []
    for (let lineIndex = firstIndex; lineIndex <= lastIndex; lineIndex++) {
      const line = this.lyric.lines[lineIndex]
      if (line?.time) {
        bridgedLines.push(line)
        bridgedIndexes.push(lineIndex)
      }
    }
    return { lines: bridgedLines, indexes: bridgedIndexes }
  }

  private emitOffsetUpdate(): void {
    const effectiveOffset = this.currentOffset
    if (this.isDisposed || effectiveOffset === this.lastEmittedOffset) {
      return
    }
    const previousOffset = this.lastEmittedOffset
    this.lastEmittedOffset = effectiveOffset
    this.event.emit('offset-update', effectiveOffset, previousOffset)
  }

  private emitActiveLinesUpdate(needsResync: boolean): void {
    const { lines, indexes } = this.bridgeActiveLines(this.displayLines, this.displayLineIndexes)
    this.event.emit('active-lines-update', lines, indexes, indexes[0] ?? -1, needsResync)
  }

  private emitCurrentLinesUpdate(): void {
    const lines = this.timeMatchedLines
    const indexes = this.timeMatchedIndexes
    const matchesLastEmission =
      lines.length === this.lastEmittedCurrentLines.length &&
      lines.every((line, index) => {
        return line === this.lastEmittedCurrentLines[index] && indexes[index] === this.lastEmittedCurrentIndexes[index]
      })
    if (matchesLastEmission) {
      return
    }

    this.lastEmittedCurrentLines = lines
    this.lastEmittedCurrentIndexes = indexes
    this.event.emit('current-lines-update', lines, indexes, indexes[0] ?? -1)
  }

  private flushStateEvents(): void {
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

  private matchLineState(lyricTime: number): {
    displayLines: Line[]
    displayIndexes: number[]
    currentLines: Line[]
    currentIndexes: number[]
    nextLineIndex: number
  } {
    const displayLines: Line[] = []
    const displayIndexes: number[] = []
    const currentLines: Line[] = []
    const currentIndexes: number[] = []
    let nextLineIndex = this.lyric.lines.length
    if (!this.hasLineTiming || !Number.isFinite(lyricTime)) {
      return { displayLines, displayIndexes, currentLines, currentIndexes, nextLineIndex }
    }

    // Start-sorted input lets the scan stop at the first future line without changing event indexes.
    for (const [lineIndex, line] of this.lyric.lines.entries()) {
      if (!line.time) {
        continue
      }
      if (line.time.start > lyricTime) {
        nextLineIndex = lineIndex
        break
      }
      if (lyricTime < this.lineMerger.getMergedTime(lineIndex)) {
        displayLines.push(line)
        displayIndexes.push(lineIndex)
      }
      if (isTimeRangeActive(line.time, lyricTime)) {
        currentLines.push(line)
        currentIndexes.push(lineIndex)
      }
    }
    return { displayLines, displayIndexes, currentLines, currentIndexes, nextLineIndex }
  }

  private rebuildLineState(needsResync: boolean): void {
    const matches = this.matchLineState(this.lyricTime)
    this.displayLines = matches.displayLines
    this.displayLineIndexes = matches.displayIndexes
    this.timeMatchedLines = matches.currentLines
    this.timeMatchedIndexes = matches.currentIndexes
    this.nextLineIndex = matches.nextLineIndex
    this.activeLinesUpdatePending = true
    this.activeLinesNeedResync = needsResync
  }

  private resyncLineState(): void {
    this.rebuildLineState(true)
    this.flushStateEvents()
  }

  private advanceLineState(lyricTime: number): void {
    if (!this.hasLineTiming || !Number.isFinite(lyricTime)) {
      return
    }

    const displayLines: Line[] = []
    const displayIndexes: number[] = []
    const currentLines: Line[] = []
    const currentIndexes: number[] = []
    let displayChanged = false
    let timeMatchesChanged = false

    for (const lineIndex of this.displayLineIndexes) {
      const line = this.lyric.lines[lineIndex]
      if (line && lyricTime < this.lineMerger.getMergedTime(lineIndex)) {
        displayLines.push(line)
        displayIndexes.push(lineIndex)
      } else {
        displayChanged = true
      }
    }

    for (const lineIndex of this.timeMatchedIndexes) {
      const line = this.lyric.lines[lineIndex]
      if (line && isTimeRangeActive(line.time, lyricTime)) {
        currentLines.push(line)
        currentIndexes.push(lineIndex)
      } else {
        timeMatchesChanged = true
      }
    }

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
        displayLines.push(line)
        displayIndexes.push(lineIndex)
        displayChanged = true
      }
      if (isTimeRangeActive(line.time, lyricTime)) {
        currentLines.push(line)
        currentIndexes.push(lineIndex)
        timeMatchesChanged = true
      }
      this.nextLineIndex++
    }

    if (displayChanged) {
      this.displayLines = displayLines
      this.displayLineIndexes = displayIndexes
      this.activeLinesUpdatePending = true
    }
    if (timeMatchesChanged) {
      this.timeMatchedLines = currentLines
      this.timeMatchedIndexes = currentIndexes
    }
  }

  private handleTick = (): void => {
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
  updateLyric(lyric: Lyric): void {
    if (this.isDisposed || !lyric) {
      return
    }
    let nextLyric = lyric
    if (parse(lyric.version)?.major !== SUPPORTED_SCHEMA_MAJOR) {
      console.warn(`[@gondola-lyrics/player] ignored lyric with incompatible version "${lyric.version}", expected major ${SUPPORTED_SCHEMA_MAJOR}`)
      nextLyric = makeEmptyLyric()
    } else if (lyric.status !== LyricStatus.VALID) {
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
  play(playbackTime?: number): void {
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
  seek(playbackTime: number): void {
    if (this.isDisposed || !Number.isFinite(playbackTime)) {
      return
    }
    this.moveClock(playbackTime)
  }

  /**
   * Freezes the clock and synchronizes both line sets to the frozen time.
   * Repeated calls while paused do not emit another pause event.
   */
  pause(): void {
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
  dispose(): void {
    if (this.isDisposed) {
      return
    }
    this.isDisposed = true
    this.pendingSeek = null
    this.pauseClock()
    this.config.event.remove('update', this.handleConfigUpdate)
    this.displayLines = []
    this.displayLineIndexes = []
    this.timeMatchedLines = []
    this.timeMatchedIndexes = []
    this.lastEmittedCurrentLines = []
    this.lastEmittedCurrentIndexes = []
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
  updateTempOffset(offset: number): void {
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
  matchLinesWithTime(playbackTime: number): { lines: Line[]; index: number[] } {
    const matches = this.matchLineState(playbackTime + this.currentOffset)
    const { lines, indexes } = this.bridgeActiveLines(matches.displayLines, matches.displayIndexes)
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
  get activeLines(): Line[] {
    return this.bridgeActiveLines(this.displayLines, this.displayLineIndexes).lines
  }

  /**
   * Indexes refer to currentInfo.lines, including lines added by display bridging.
   */
  get activeIndexes(): number[] {
    return this.bridgeActiveLines(this.displayLines, this.displayLineIndexes).indexes
  }

  /**
   * Returns -1 when no display line is active.
   */
  get firstActiveIndex(): number {
    return this.displayLineIndexes[0] ?? -1
  }

  /**
   * Matches original [start, end) ranges at the last synchronization, with the effective offset applied.
   * Unknown ends stay open; display holds, merging and bridging do not affect this set.
   */
  get currentLines(): Line[] {
    return this.timeMatchedLines
  }

  /**
   * Indexes refer to currentInfo.lines; overlapping ranges can produce several entries and gaps produce none.
   */
  get currentIndexes(): number[] {
    return this.timeMatchedIndexes
  }

  /**
   * Returns -1 when no original range matches, even if a display line remains highlighted.
   */
  get firstCurrentIndex(): number {
    return this.timeMatchedIndexes[0] ?? -1
  }

  /**
   * Accepted lyrics retain object identity; call updateLyric after edits to rebuild timing state.
   */
  get currentInfo(): Lyric {
    return this.lyric
  }

  /**
   * Reports playback milliseconds without lyric offsets; paused clocks retain their position.
   */
  get currentTime(): number {
    return this.clock.running ? this.clock.position + performance.now() - this.clock.startedAt : this.clock.position
  }

  /**
   * Adds global, metadata and temporary milliseconds; returns zero after disposal or for a non-finite total.
   */
  get currentOffset(): number {
    return this.isDisposed ? 0 : this.offsetState.resolve(this.config.current.offset.global)
  }
}

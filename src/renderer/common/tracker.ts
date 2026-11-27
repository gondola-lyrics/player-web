import type { RenderChanges, RendererSource } from './types'

const RENDER_EVENTS = ['play', 'pause', 'active-lines-update', 'current-lines-update', 'offset-update'] as const

export class ChangeTracker<Key extends string> {
  private lyricChanged = true
  private sizeChanged = false
  private seeked = false
  private configChanges = new Set<Key>()
  private isDisposed = false

  constructor(
    private readonly player: RendererSource,
    private readonly requestUpdate: () => void,
    private readonly onPlayerDispose: () => void,
  ) {
    for (const event of RENDER_EVENTS) {
      player.event.add(event, this.handleUpdate)
    }
    player.event.add('seek', this.handleSeek)
    player.event.add('lyric-update', this.handleLyricUpdate)
    player.event.add('dispose', this.handlePlayerDispose)
  }

  private handleUpdate = () => {
    if (!this.isDisposed) {
      this.requestUpdate()
    }
  }

  private handleSeek = () => {
    this.mark({ seek: true })
    this.handleUpdate()
  }

  private handleLyricUpdate = () => {
    this.mark({ lyric: true })
    this.handleUpdate()
  }

  private handlePlayerDispose = () => {
    if (!this.isDisposed) {
      this.dispose()
      this.onPlayerDispose()
    }
  }

  /**
   * Records changes in the current batch so measurements taken during a flush can join it.
   * The caller schedules updates separately.
   */
  mark(changes: Partial<RenderChanges<Key>>) {
    if (this.isDisposed) {
      return
    }

    this.lyricChanged ||= changes.lyric === true
    this.sizeChanged ||= changes.size === true
    this.seeked ||= changes.seek === true
    for (const key of changes.config ?? []) {
      this.configChanges.add(key)
    }
  }

  /**
   * Returns the current batch and starts a new one for changes that arrive during rendering.
   */
  take(): RenderChanges<Key> {
    const changes: RenderChanges<Key> = {
      lyric: this.lyricChanged,
      size: this.sizeChanged,
      seek: this.seeked,
      config: this.configChanges,
    }

    this.lyricChanged = false
    this.sizeChanged = false
    this.seeked = false
    this.configChanges = new Set()

    return changes
  }

  /**
   * Removes the renderer's player subscriptions and ignores callbacks already captured by an emission.
   */
  dispose() {
    if (this.isDisposed) {
      return
    }

    this.isDisposed = true

    for (const event of RENDER_EVENTS) {
      this.player.event.remove(event, this.handleUpdate)
    }

    this.player.event.remove('seek', this.handleSeek)
    this.player.event.remove('lyric-update', this.handleLyricUpdate)
    this.player.event.remove('dispose', this.handlePlayerDispose)
  }
}

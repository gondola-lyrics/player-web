import type { DomRendererConfig, DomRendererConfigKeys, DomRendererConfigManager } from './config'
import type { RenderChanges, RenderContext, RendererSource } from './context'
import type { DomRendererEventMap } from './events'
import type { RenderMode } from './modes/types'

import { ConfigManager, Event } from '@root/utils'

import { DEFAULT } from './config'
import { Container } from './container'
import { createMode } from './modes'
import { FrameScheduler } from './scheduler'

const RENDER_EVENTS = ['play', 'pause', 'active-lines-update', 'current-lines-update', 'offset-update'] as const

export class DomRenderer {
  readonly config: DomRendererConfigManager
  readonly event = new Event<DomRendererEventMap>()

  private readonly container: Container
  private readonly scheduler: FrameScheduler
  private readonly context: RenderContext
  private mode: RenderMode
  private isDisposed = false

  private lyricChanged = true
  private sizeChanged = false
  private seeked = false
  private configChanges = new Set<DomRendererConfigKeys>()

  /**
   * Renders the current lyric immediately; append element to a host that defines the viewport size.
   * The player stays independently owned and can drive several renderers.
   */
  constructor(
    private readonly player: RendererSource,
    config?: DomRendererConfig,
  ) {
    this.config = new ConfigManager(DEFAULT, config)
    this.scheduler = new FrameScheduler(this.flush)
    this.container = new Container(this.handleResize)
    this.context = {
      document: this.container.element.ownerDocument,
      player,
      config: this.config,
      container: this.container,
    }
    this.mode = this.startMode()

    for (const event of RENDER_EVENTS) {
      player.event.add(event, this.request)
    }
    player.event.add('seek', this.handleSeek)
    player.event.add('lyric-update', this.handleLyricUpdate)
    player.event.add('dispose', this.handlePlayerDispose)
    this.config.event.add('update', this.handleConfigUpdate)

    this.flush()
  }

  private request = (): void => {
    this.scheduler.request()
  }

  private handleResize = (): void => {
    this.sizeChanged = true
    this.request()
  }

  private handleSeek = (): void => {
    this.seeked = true
    this.request()
  }

  private handleLyricUpdate = (): void => {
    this.lyricChanged = true
    this.request()
  }

  private handleConfigUpdate = (keys: Set<DomRendererConfigKeys>): void => {
    // An earlier listener in the same emission may already have disposed this renderer.
    if (this.isDisposed) {
      return
    }
    if (keys.has('mode')) {
      // Creating first keeps the current mode in place when the new one fails to construct.
      const next = this.startMode()
      this.mode.dispose()
      this.mode = next
      this.lyricChanged = true
    }
    for (const key of keys) {
      this.configChanges.add(key)
    }
    this.request()
  }

  private handlePlayerDispose = (): void => {
    this.dispose()
  }

  private startMode(): RenderMode {
    const { mode } = this.config.current
    const instance = createMode(mode, this.context)
    this.container.element.dataset.mode = mode
    return instance
  }

  private flush = (): void => {
    const changes: RenderChanges = {
      lyric: this.lyricChanged,
      size: this.sizeChanged,
      seek: this.seeked,
      config: this.configChanges,
    }
    this.lyricChanged = false
    this.sizeChanged = false
    this.seeked = false
    this.configChanges = new Set()
    this.mode.update(changes)
  }

  /**
   * Returns the owned viewport; moving it between hosts keeps the player connection.
   */
  get element(): HTMLDivElement {
    return this.container.element
  }

  /**
   * Permanently detaches this renderer without pausing or disposing the shared player.
   *
   * Player disposal also triggers this cleanup; repeated calls emit no additional event.
   */
  dispose(): void {
    if (this.isDisposed) {
      return
    }
    this.isDisposed = true
    for (const event of RENDER_EVENTS) {
      this.player.event.remove(event, this.request)
    }
    this.player.event.remove('seek', this.handleSeek)
    this.player.event.remove('lyric-update', this.handleLyricUpdate)
    this.player.event.remove('dispose', this.handlePlayerDispose)
    this.config.event.remove('update', this.handleConfigUpdate)
    this.scheduler.dispose()
    this.mode.dispose()
    this.container.dispose()
    this.event.emit('dispose')
    this.event.clear()
  }
}

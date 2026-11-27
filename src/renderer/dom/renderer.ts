import type { CorePlayer } from '@root/core'
import type { DomRendererConfig, DomRendererConfigKeys, DomRendererConfigManager, DomRendererConfigRequired } from './config'
import type { RenderContext } from './context'
import type { DomRendererEventMap } from './events'
import type { RenderMode } from './modes/types'

import { ConfigManager, Event } from '@root/utils'
import { UpdateScheduler } from '@root/renderer/common/scheduler'
import { ChangeTracker } from '@root/renderer/common/tracker'

import { DEFAULT } from './config'
import { Container } from './container'
import { createMode } from './modes'

export class DomRenderer {
  /**
   * Live settings for the viewport's display mode, content, and layout.
   */
  readonly config: DomRendererConfigManager
  /**
   * Source interaction and disposal notifications for this viewport.
   */
  readonly event = new Event<DomRendererEventMap>()

  private readonly container: Container
  private readonly scheduler: UpdateScheduler
  private readonly tracker: ChangeTracker<DomRendererConfigKeys>
  private readonly context: RenderContext
  private mode: RenderMode
  private isDisposed = false
  private cancelTimeUpdate?: () => void

  constructor(
    private readonly player: CorePlayer,
    config?: DomRendererConfig,
  ) {
    this.config = new ConfigManager<DomRendererConfigRequired, DomRendererConfig>(DEFAULT, config)
    this.scheduler = new UpdateScheduler(this.flush)
    this.container = new Container(this.handleResize)

    const container = this.container
    this.context = {
      get document() {
        return container.element.ownerDocument
      },
      player,
      config: this.config,
      container: this.container,
      requestUpdate: this.request,
      onLineClick: (line, index, event) => {
        this.event.emit('line-click', line, index, event)
      },
      onLineContextMenu: (line, index, event) => {
        this.event.emit('line-context-menu', line, index, event)
      },
    }

    this.mode = this.startMode()

    this.tracker = new ChangeTracker(player, this.request, () => {
      this.dispose()
    })
    this.config.event.add('update', this.handleConfigUpdate)

    this.flush()
  }

  private request = () => {
    if (!this.isDisposed) {
      this.scheduler.request()
    }
  }

  private handleResize = () => {
    this.tracker.mark({ size: true })
    this.request()
  }

  private handleConfigUpdate = (keys: Set<DomRendererConfigKeys>) => {
    // Event dispatch may already have captured this listener when disposal runs.
    if (this.isDisposed) {
      return
    }

    if (keys.has('mode')) {
      // Construct first so a failed switch keeps the current mode mounted.
      const next = this.startMode()
      this.mode.dispose()
      this.mode = next
      this.tracker.mark({ lyric: true })
    }

    this.tracker.mark({ config: keys })
    this.request()
  }

  private startMode(): RenderMode {
    const { mode } = this.config.current
    const instance = createMode(mode, this.context)
    this.container.element.dataset.mode = mode
    return instance
  }

  private flush = () => {
    this.tracker.mark({ size: this.container.sync() })
    this.mode.update(this.tracker.take())
    this.updateTime()
  }

  private updateTime = () => {
    const lyricTime = this.player.currentTime + this.player.currentOffset
    const next = this.mode.updateTime(lyricTime)
    this.cancelTimeUpdate?.()
    this.cancelTimeUpdate = undefined

    const view = this.context.document.defaultView
    const delay = this.player.currentPlaying ? next - lyricTime : Infinity
    if (this.isDisposed || !view || !Number.isFinite(delay)) {
      return
    }

    if (delay <= 0) {
      const frame = view.requestAnimationFrame(this.updateTime)
      this.cancelTimeUpdate = () => {
        view.cancelAnimationFrame(frame)
      }
    } else {
      const timer = view.setTimeout(this.updateTime, Math.min(Math.ceil(delay), 2 ** 31 - 1))
      this.cancelTimeUpdate = () => {
        view.clearTimeout(timer)
      }
    }
  }

  /**
   * Viewport to append to a host that supplies its dimensions.
   * It can move between hosts while connected to the player.
   */
  get element(): HTMLDivElement {
    return this.container.element
  }

  /**
   * Releases the viewport, mode, and player subscriptions.
   * Player disposal also triggers this cleanup, which emits `dispose` once.
   */
  dispose() {
    if (this.isDisposed) {
      return
    }

    this.isDisposed = true
    this.tracker.dispose()
    this.config.event.remove('update', this.handleConfigUpdate)
    this.scheduler.dispose()
    this.cancelTimeUpdate?.()
    this.cancelTimeUpdate = undefined

    this.mode.dispose()
    this.container.dispose()

    this.event.emit('dispose')
    this.event.clear()
  }
}

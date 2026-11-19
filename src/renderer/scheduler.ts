export class UpdateScheduler {
  private pending = false
  private isDisposed = false
  private cancelTimeUpdate?: () => void

  constructor(private readonly callback: () => void) {}

  private flush = () => {
    this.pending = false
    if (this.isDisposed) {
      return
    }
    this.callback()
  }

  /**
   * Reads the latest state once the current event sequence has finished.
   */
  request() {
    if (this.isDisposed || this.pending) {
      return
    }
    this.pending = true
    queueMicrotask(this.flush)
  }

  /**
   * Uses a frame during a sweep and sleeps across gaps, including across document changes.
   */
  scheduleTime(view: Window | null, delay: number, callback: () => void) {
    this.cancelTimeUpdate?.()
    this.cancelTimeUpdate = undefined
    if (this.isDisposed || !view || !Number.isFinite(delay)) {
      return
    }
    if (delay <= 0) {
      const frame = view.requestAnimationFrame(callback)
      this.cancelTimeUpdate = () => {
        view.cancelAnimationFrame(frame)
      }
    } else {
      const timer = view.setTimeout(callback, Math.min(Math.ceil(delay), 2 ** 31 - 1))
      this.cancelTimeUpdate = () => {
        view.clearTimeout(timer)
      }
    }
  }

  /**
   * Ignores queued and later work, so detached nodes are never updated.
   */
  dispose() {
    this.isDisposed = true
    this.cancelTimeUpdate?.()
    this.cancelTimeUpdate = undefined
  }
}

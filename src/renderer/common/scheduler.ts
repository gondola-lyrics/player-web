export class UpdateScheduler {
  private pending = false
  private isDisposed = false

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
   * Ignores queued and later work, so detached nodes are never updated.
   */
  dispose() {
    this.isDisposed = true
  }
}

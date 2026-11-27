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
   * Coalesces synchronous update requests into a single microtask.
   */
  request() {
    if (this.isDisposed || this.pending) {
      return
    }

    this.pending = true
    queueMicrotask(this.flush)
  }

  /**
   * Stops updates, including work already queued in a microtask.
   */
  dispose() {
    this.isDisposed = true
  }
}

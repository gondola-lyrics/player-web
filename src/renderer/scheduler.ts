export class FrameScheduler {
  private frameId: number | null = null
  private isDisposed = false

  /**
   * Defers reading player state until a frame runs, so a burst of events shares the latest state.
   */
  constructor(private readonly callback: () => void) {}

  private flush = (): void => {
    this.frameId = null
    this.callback()
  }

  /**
   * Keeps an already queued frame instead of delaying it for every new event.
   */
  request(): void {
    if (this.isDisposed || this.frameId !== null) {
      return
    }
    this.frameId = requestAnimationFrame(this.flush)
  }

  /**
   * Cancels queued work and ignores later requests, so detached nodes are never updated.
   */
  dispose(): void {
    this.isDisposed = true
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
  }
}

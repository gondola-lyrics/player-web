import type { CorePlayerConfigRequired } from './config'

export class Driver {
  private frameId: number | null = null
  private timerId: ReturnType<typeof globalThis.setTimeout> | null = null

  /**
   * Replaces the pending tick so driver switches cannot leave two clocks running.
   */
  schedule(driver: CorePlayerConfigRequired['driver'], callback: () => void): void {
    this.cancel()
    if (driver === 'animation') {
      this.frameId = globalThis.requestAnimationFrame(() => {
        this.frameId = null
        callback()
      })
    } else {
      this.timerId = globalThis.setTimeout(() => {
        this.timerId = null
        callback()
      }, 16)
    }
  }

  /**
   * Cancels outstanding work regardless of which driver scheduled it.
   */
  cancel(): void {
    if (this.frameId !== null) {
      globalThis.cancelAnimationFrame(this.frameId)
      this.frameId = null
    }
    if (this.timerId !== null) {
      globalThis.clearTimeout(this.timerId)
      this.timerId = null
    }
  }
}

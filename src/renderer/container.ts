export class Container {
  readonly element: HTMLDivElement

  private readonly observer: ResizeObserver
  private dimensions = { width: 0, height: 0 }

  /**
   * Observes its own box, so host layout changes reach the active mode without polling.
   */
  constructor(onResize: () => void) {
    this.element = document.createElement('div')
    this.observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }
      const { width, height } = entry.contentRect
      if (width === this.dimensions.width && height === this.dimensions.height) {
        return
      }
      this.dimensions = { width, height }
      onResize()
    })
    this.observer.observe(this.element)
  }

  /**
   * Stays zero until the host attaches and sizes the element.
   */
  get size(): Readonly<{ width: number; height: number }> {
    return this.dimensions
  }

  /**
   * Stops observing and detaches the element from its host.
   */
  dispose(): void {
    this.observer.disconnect()
    this.element.remove()
  }
}

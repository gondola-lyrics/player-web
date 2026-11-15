import { createStyles } from './styles'

export class Container {
  readonly element: HTMLDivElement

  private readonly observer: ResizeObserver
  private readonly mountObserver: MutationObserver
  private ancestors: Node[] = []
  private root: Document | ShadowRoot | null = null
  private styleDocument: Document | null = null
  private releaseStyles: (() => void) | null = null

  /**
   * Observes size and ancestry so paused renderers remain aligned when hosts move or change documents.
   */
  constructor(private readonly onResize: () => void) {
    this.element = document.createElement('div')
    this.element.className = 'gondola-renderer'
    this.observer = new ResizeObserver(() => {
      this.sync()
      this.onResize()
    })
    this.mountObserver = new MutationObserver((records) => {
      const moved = records.some((record) => {
        return [...record.removedNodes].some((node) => node === this.element || this.ancestors.includes(node))
      })
      if (this.sync() || moved) {
        this.onResize()
      }
    })
    this.observer.observe(this.element)
  }

  /**
   * Rebinds only when the ancestry changes; observing each parent also covers movement across shadow boundaries.
   */
  sync(): boolean {
    const ancestors: Node[] = []
    let parent = this.element.parentNode as Node | null
    while (parent) {
      ancestors.push(parent)
      parent = parent.parentNode ?? (parent.nodeType === 11 && 'host' in parent ? (parent as ShadowRoot).host : null)
    }
    const node = this.element.getRootNode()
    const root = node.nodeType === 9 || (node.nodeType === 11 && 'host' in node) ? (node as Document | ShadowRoot) : null
    const document = root ? this.element.ownerDocument : null
    if (
      root === this.root &&
      document === this.styleDocument &&
      ancestors.length === this.ancestors.length &&
      ancestors.every((ancestor, index) => ancestor === this.ancestors[index])
    ) {
      return false
    }
    this.mountObserver.disconnect()
    this.ancestors = ancestors
    for (const ancestor of ancestors) {
      this.mountObserver.observe(ancestor, { childList: true })
    }
    if (root !== this.root || document !== this.styleDocument) {
      this.releaseStyles?.()
      this.root = root
      this.styleDocument = document
      this.releaseStyles = root ? createStyles(root) : null
    }
    return true
  }

  /**
   * Stops observing and detaches the element from its host.
   */
  dispose() {
    this.observer.disconnect()
    this.mountObserver.disconnect()
    this.releaseStyles?.()
    this.releaseStyles = null
    this.ancestors = []
    this.root = null
    this.styleDocument = null
    this.element.remove()
  }
}

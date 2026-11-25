import { buildClassName } from './css'
import { RuntimeStyles, createStyles } from './styles'

const collectAncestors = (element: HTMLElement): Node[] => {
  const ancestors: Node[] = []
  let parent = element.parentNode
  while (parent) {
    ancestors.push(parent)
    if (parent.parentNode) {
      parent = parent.parentNode
    } else if (parent.nodeType === 11 && 'host' in parent) {
      parent = (parent as ShadowRoot).host
    } else {
      parent = null
    }
  }

  return ancestors
}

const getStyleRoot = (element: HTMLElement): Document | ShadowRoot | null => {
  const root = element.getRootNode()
  if (root.nodeType === 9 || (root.nodeType === 11 && 'host' in root)) {
    return root as Document | ShadowRoot
  }

  return null
}

export class Container {
  readonly element: HTMLDivElement

  private readonly styles: RuntimeStyles
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
    this.element.className = buildClassName('root')
    this.element.dataset.role = 'root'
    const identity = crypto.getRandomValues(new Uint32Array(2))
    this.element.dataset.instanceId = Array.from(identity, (part) => part.toString(16).padStart(8, '0')).join('')
    this.styles = new RuntimeStyles(this.element)

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
    const ancestors = collectAncestors(this.element)
    const root = getStyleRoot(this.element)
    const document = root ? this.element.ownerDocument : null
    const sameAncestors = ancestors.length === this.ancestors.length && ancestors.every((ancestor, index) => ancestor === this.ancestors[index])
    if (root === this.root && document === this.styleDocument && sameAncestors) {
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
   * Replaces the active mode's complete variable set without scheduling another update.
   *
   * Returns added, removed or changed declarations for the mode's layout decisions.
   */
  updateStyle(variables: Readonly<Record<string, string>>): ReadonlySet<string> {
    return this.styles.update(variables)
  }

  /**
   * Stops observing and detaches the element from its host.
   */
  dispose() {
    this.observer.disconnect()
    this.mountObserver.disconnect()
    this.styles.dispose()
    this.releaseStyles?.()
    this.releaseStyles = null
    this.ancestors = []
    this.root = null
    this.styleDocument = null

    this.element.remove()
  }
}

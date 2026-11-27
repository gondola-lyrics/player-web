import { CSS_NAMESPACE, buildClassName } from './css'

import line from './components/line/style.scss?inline'
import list from './modes/list/style.scss?inline'
import renderer from './style.scss?inline'
import word from './components/word/style.scss?inline'

type StyleRoot = Document | ShadowRoot

const STYLES = `@layer ${CSS_NAMESPACE} {\n${[renderer, line, word, list].join('\n')}\n}`

const sheets = new WeakMap<Document, CSSStyleSheet>()
const roots = new WeakMap<StyleRoot, { document: Document; sheet: CSSStyleSheet; users: number }>()

/**
 * Shares a constructable stylesheet per document and returns a callback that releases this root's subscription.
 */
export const createStyles = (root: StyleRoot): (() => void) => {
  const document = root.nodeType === 9 ? (root as Document) : root.ownerDocument!
  let entry = roots.get(root)
  if (entry && entry.document !== document) {
    const previous = entry
    root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet !== previous.sheet)
    roots.delete(root)
    entry = undefined
  }

  if (!entry) {
    let sheet = sheets.get(document)
    if (!sheet) {
      sheet = new document.defaultView!.CSSStyleSheet()
      sheet.replaceSync(STYLES)
      sheets.set(document, sheet)
    }

    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet]
    entry = { document, sheet, users: 0 }
    roots.set(root, entry)
  }

  entry.users++
  let released = false

  return () => {
    if (released) {
      return
    }

    released = true
    entry.users--
    if (entry.users === 0 && roots.get(root) === entry) {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter((sheet) => sheet !== entry.sheet)
      roots.delete(root)
    }
  }
}

export class RuntimeStyles {
  private readonly element: HTMLStyleElement
  private readonly declarations: CSSStyleDeclaration
  private readonly selector: string

  constructor(host: HTMLElement) {
    const document = host.ownerDocument
    this.element = document.createElement('style')
    this.element.dataset.role = 'renderer-style'
    this.declarations = document.createElement('div').style
    this.selector = `.${buildClassName('root')}[data-role="root"][data-instance-id="${host.dataset.instanceId}"]`
    host.appendChild(this.element)
  }

  /**
   * Replaces the full variable set and reports which keys changed after CSS parsing.
   */
  update(variables: Readonly<Record<string, string>>): ReadonlySet<string> {
    const changed = new Set<string>()
    for (const key of Array.from(this.declarations)) {
      if (!Object.hasOwn(variables, key)) {
        this.declarations.removeProperty(key)
        changed.add(key)
      }
    }

    for (const [key, value] of Object.entries(variables)) {
      const previous = this.declarations.getPropertyValue(key)
      if (previous === value) {
        continue
      }

      this.declarations.setProperty(key, value)
      if (this.declarations.getPropertyValue(key) !== previous) {
        changed.add(key)
      }
    }

    if (changed.size > 0) {
      const css = this.declarations.cssText
      this.element.textContent = css ? `@layer ${CSS_NAMESPACE} {\n${this.selector} {\n${css}\n}\n}` : ''
    }

    return changed
  }

  dispose() {
    this.element.remove()
  }
}

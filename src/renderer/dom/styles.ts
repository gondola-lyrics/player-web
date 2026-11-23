import { CSS_NAMESPACE } from './css'

import line from './components/line/style.scss?inline'
import list from './modes/list/style.scss?inline'
import renderer from './style.scss?inline'
import word from './components/word/style.scss?inline'

type StyleRoot = Document | ShadowRoot

const STYLES = `@layer ${CSS_NAMESPACE} {\n${[renderer, line, word, list].join('\n')}\n}`

const sheets = new WeakMap<Document, CSSStyleSheet>()
const roots = new WeakMap<StyleRoot, { document: Document; sheet: CSSStyleSheet; users: number }>()

/**
 * Shares one sheet per document without inline style elements, and releases only this root's final subscription.
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

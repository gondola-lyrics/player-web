import type { LineObject } from '@root/renderer/dom/components/line/line'
import type { ListModeConfigRequired } from './config'

import { buildLineVariableKey, buildRootVariableKey } from '@root/renderer/dom/css'

import { DEFAULT } from './config'

const SCROLL_EASING = buildRootVariableKey('scroll-easing')
const LINE_ANIMATION_DURATION = buildLineVariableKey('line-animation-duration')
const LINE_ANIMATION_DELAY = buildLineVariableKey('line-animation-delay')
const BROWSE_DURATION = 200

interface RowPosition {
  element: HTMLElement
  top: number
  anchor: number
}

interface PositionOptions {
  follow: boolean
  browsing: boolean
  immediate: boolean
}

export class ListLayout {
  private rows: RowPosition[] = []
  private height = 0
  private offset: number | undefined

  constructor(private readonly content: HTMLElement) {}

  /**
   * Accumulates natural row heights independently of their current translations.
   */
  measure(lines: readonly LineObject[], gap: number) {
    let top = 0
    this.rows = lines.map((line) => {
      const { height, anchorY } = line.measure()
      const row = { element: line.element, top, anchor: top + anchorY }
      top += height + gap
      return row
    })
    this.height = Math.max(0, top - gap)
    this.offset = undefined
  }

  /**
   * Applies the shared anchor offset to each row so CSS can retarget from its current pose.
   */
  position(index: number, height: number, config: ListModeConfigRequired['scroll'], options: PositionOptions) {
    const row = this.rows[index]
    if (!row || height <= 0) {
      return
    }

    const anchor = Number.isFinite(config.anchor) ? Math.min(100, Math.max(0, config.anchor)) : DEFAULT.scroll.anchor
    const desired = (height * anchor) / 100 - row.anchor
    const offset = options.follow ? desired : Math.min(0, Math.max(height - this.height, desired))

    const animation = config.animation
    const animate = !options.immediate && animation.enabled && animation.duration > 0
    this.content.toggleAttribute('animatable', animate)
    if (animate) {
      const view = this.content.ownerDocument.defaultView
      const easing = view?.CSS.supports('transition-timing-function', animation.easing) ? animation.easing : DEFAULT.scroll.animation.easing
      this.content.style.setProperty(SCROLL_EASING, easing)
      this.content.style.setProperty(LINE_ANIMATION_DURATION, `${options.browsing ? BROWSE_DURATION : animation.duration}ms`)
      this.content.style.setProperty(LINE_ANIMATION_DELAY, `${options.browsing ? 0 : animation.uniform.delay}ms`)
    }

    if (offset === this.offset) {
      return
    }
    this.offset = offset
    for (const row of this.rows) {
      row.element.style.transform = `translateY(${row.top + offset}px)`
    }
  }

  /**
   * Releases the measured row references when the mode is disposed.
   */
  clear() {
    this.rows = []
    this.height = 0
    this.offset = undefined
  }
}

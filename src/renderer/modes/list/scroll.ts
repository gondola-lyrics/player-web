import type { ListModeConfigRequired } from './config'

import { DEFAULT } from './config'

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '])
const MAX_TIMEOUT = 2 ** 31 - 1

export class ListScroll {
  private config = DEFAULT.scroll
  private enabled = false
  private browsing = false
  private pointerId: number | null = null
  private readonly touches = new Set<number>()
  private document: Document | null = null
  private lastTop = 0
  private viewportHeight = 0
  private contentHeight = 0
  private timer: ReturnType<typeof setTimeout> | null = null
  private resumeAt = 0

  /**
   * Lets native wheel, touch and scrollbar input temporarily take over the viewport.
   */
  constructor(
    private readonly element: HTMLElement,
    private readonly requestUpdate: () => void,
  ) {
    element.addEventListener('scroll', this.handleScroll, { passive: true })
    element.addEventListener('wheel', this.handleWheel, { passive: true })
    element.addEventListener('keydown', this.handleKeyDown)
    element.addEventListener('pointerdown', this.handlePointerDown, { capture: true, passive: true })
    element.addEventListener('touchstart', this.handleTouchStart, { capture: true, passive: true })
    this.syncDocument()
  }

  private syncDocument() {
    const document = this.element.ownerDocument
    if (document === this.document) {
      return
    }
    this.unbindDocument()
    this.pointerId = null
    this.touches.clear()
    this.document = document
    document.addEventListener('pointerup', this.handlePointerUp, { capture: true, passive: true })
    document.addEventListener('pointercancel', this.handlePointerUp, { capture: true, passive: true })
    document.addEventListener('touchend', this.handleTouchEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', this.handleTouchEnd, { capture: true, passive: true })
    document.defaultView?.addEventListener('blur', this.handleBlur)
    if (this.browsing) {
      this.scheduleResume()
    }
  }

  private unbindDocument() {
    this.document?.removeEventListener('pointerup', this.handlePointerUp, true)
    this.document?.removeEventListener('pointercancel', this.handlePointerUp, true)
    this.document?.removeEventListener('touchend', this.handleTouchEnd, true)
    this.document?.removeEventListener('touchcancel', this.handleTouchEnd, true)
    this.document?.defaultView?.removeEventListener('blur', this.handleBlur)
  }

  private handleScroll = () => {
    const top = this.element.scrollTop
    const layoutChanged = this.element.clientHeight !== this.viewportHeight || this.element.scrollHeight !== this.contentHeight
    this.recordDimensions()
    if (top === this.lastTop) {
      return
    }
    this.lastTop = top
    if (layoutChanged && !this.browsing) {
      this.requestUpdate()
      return
    }
    this.browse()
  }

  private recordDimensions() {
    this.viewportHeight = this.element.clientHeight
    this.contentHeight = this.element.scrollHeight
  }

  private handleWheel = (event: WheelEvent) => {
    if (!event.defaultPrevented && event.deltaY !== 0) {
      this.browse()
    }
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (!event.defaultPrevented && SCROLL_KEYS.has(event.key)) {
      this.browse()
    }
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.syncDocument()
    if (event.isPrimary) {
      this.pointerId = event.pointerId
      this.clearTimer()
    }
  }

  private handlePointerUp = (event: PointerEvent) => {
    if (event.pointerId === this.pointerId) {
      this.pointerId = null
      if (this.browsing) {
        this.scheduleResume()
      }
    }
  }

  private handleTouchStart = (event: TouchEvent) => {
    this.syncDocument()
    for (const touch of event.changedTouches) {
      this.touches.add(touch.identifier)
    }
    this.clearTimer()
  }

  private handleTouchEnd = (event: TouchEvent) => {
    let released = false
    for (const touch of event.changedTouches) {
      released = this.touches.delete(touch.identifier) || released
    }
    if (released && this.browsing) {
      this.scheduleResume()
    }
  }

  private handleBlur = () => {
    this.pointerId = null
    this.touches.clear()
    if (this.browsing) {
      this.scheduleResume()
    }
  }

  /**
   * Pauses following until manual input has ended, including touches retained after native pointer cancellation.
   */
  browse() {
    if (!this.enabled) {
      return
    }
    this.browsing = true
    this.element.setAttribute('scrolling', '')
    this.scheduleResume()
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleResume() {
    this.clearTimer()
    if (this.pointerId !== null || this.touches.size > 0 || this.config.resumeDelay === Infinity) {
      return
    }
    const delay = Number.isFinite(this.config.resumeDelay) ? Math.max(0, this.config.resumeDelay) : DEFAULT.scroll.resumeDelay
    this.resumeAt = performance.now() + delay
    this.timer = setTimeout(this.handleResume, Math.min(delay, MAX_TIMEOUT))
  }

  private handleResume = () => {
    this.timer = null
    const remaining = this.resumeAt - performance.now()
    if (remaining > 0) {
      this.timer = setTimeout(this.handleResume, Math.min(remaining, MAX_TIMEOUT))
      return
    }
    this.reset()
    this.requestUpdate()
  }

  /**
   * Untimed lyrics and disabled following retain ordinary native scrolling.
   */
  updateConfig(config: ListModeConfigRequired['scroll'], hasTiming: boolean) {
    this.syncDocument()
    const delayChanged = config.resumeDelay !== this.config.resumeDelay
    this.config = config
    this.enabled = config.follow && hasTiming
    if (!this.enabled) {
      this.reset()
    } else if (this.browsing && delayChanged) {
      this.scheduleResume()
    }
  }

  /**
   * Records the actual clamped position so its scroll event is not mistaken for manual input.
   */
  follow(top: number) {
    this.recordDimensions()
    if (!this.enabled || this.browsing || !Number.isFinite(top)) {
      return
    }
    this.element.scrollTo({ top, behavior: 'instant' })
    this.lastTop = this.element.scrollTop
  }

  /**
   * Explicit positioning and lyric replacement immediately restore following.
   */
  reset() {
    this.clearTimer()
    this.pointerId = null
    this.touches.clear()
    this.browsing = false
    this.lastTop = this.element.scrollTop
    this.recordDimensions()
    this.element.removeAttribute('scrolling')
  }

  /**
   * Clears the recovery timer and every input subscription owned by this viewport.
   */
  dispose() {
    this.reset()
    this.element.removeEventListener('scroll', this.handleScroll)
    this.element.removeEventListener('wheel', this.handleWheel)
    this.element.removeEventListener('keydown', this.handleKeyDown)
    this.element.removeEventListener('pointerdown', this.handlePointerDown, true)
    this.element.removeEventListener('touchstart', this.handleTouchStart, true)
    this.unbindDocument()
    this.document = null
  }
}

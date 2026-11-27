import { DEFAULT } from './config'

const MAX_TIMEOUT = 2 ** 31 - 1
const TOUCH_STEP = 48

export class ListScroll {
  private readonly touches = new Set<number>()
  private document: Document | null = null
  private pointerId: number | null = null
  private touchY: number | undefined
  private timer: ReturnType<typeof setTimeout> | null = null
  private resumeAt = 0
  private resume = DEFAULT.scroll.resume
  private canFollow = false
  private lineCount = 0
  private anchorIndex = 0
  private browsing = false

  constructor(
    private readonly element: HTMLElement,
    private readonly requestUpdate: () => void,
  ) {
    element.addEventListener('wheel', this.handleWheel, { passive: false })
    element.addEventListener('pointerdown', this.handlePointerDown, { capture: true, passive: true })
    element.addEventListener('touchstart', this.handleTouchStart, { capture: true, passive: true })
    element.addEventListener('touchmove', this.handleTouchMove, { passive: false })

    this.syncDocument()
  }

  private syncDocument() {
    const document = this.element.ownerDocument
    if (document === this.document) {
      return
    }

    this.unbindDocument()
    this.clearInput()
    this.document = document

    document.addEventListener('pointerup', this.handlePointerUp, { capture: true, passive: true })
    document.addEventListener('pointercancel', this.handlePointerUp, { capture: true, passive: true })
    document.addEventListener('touchend', this.handleTouchEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', this.handleTouchEnd, { capture: true, passive: true })
    document.defaultView?.addEventListener('blur', this.handleBlur)

    this.scheduleResume()
  }

  private unbindDocument() {
    this.document?.removeEventListener('pointerup', this.handlePointerUp, true)
    this.document?.removeEventListener('pointercancel', this.handlePointerUp, true)
    this.document?.removeEventListener('touchend', this.handleTouchEnd, true)
    this.document?.removeEventListener('touchcancel', this.handleTouchEnd, true)
    this.document?.defaultView?.removeEventListener('blur', this.handleBlur)
  }

  private handleWheel = (event: WheelEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.deltaY === 0 || this.lineCount === 0) {
      return
    }

    event.preventDefault()
    this.browse(this.anchorIndex + Math.sign(event.deltaY))
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
      this.scheduleResume()
    }
  }

  private handleTouchStart = (event: TouchEvent) => {
    this.syncDocument()
    for (const touch of event.changedTouches) {
      this.touches.add(touch.identifier)
    }

    this.touchY = event.touches.length === 1 ? event.touches[0]?.clientY : undefined
    this.clearTimer()
  }

  private handleTouchMove = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (event.defaultPrevented || event.touches.length !== 1 || !touch || !this.touches.has(touch.identifier) || this.touchY === undefined) {
      return
    }

    const steps = Math.trunc((this.touchY - touch.clientY) / TOUCH_STEP)
    if (steps === 0 || this.lineCount === 0) {
      return
    }

    event.preventDefault()
    this.touchY -= steps * TOUCH_STEP
    this.browse(this.anchorIndex + steps)
  }

  private handleTouchEnd = (event: TouchEvent) => {
    let released = false
    for (const touch of event.changedTouches) {
      released = this.touches.delete(touch.identifier) || released
    }

    if (released) {
      this.touchY = undefined
      this.scheduleResume()
    }
  }

  private handleBlur = () => {
    this.clearInput()
    this.scheduleResume()
  }

  private clearInput() {
    this.pointerId = null
    this.touches.clear()
    this.touchY = undefined
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private scheduleResume() {
    this.clearTimer()
    if (!this.canFollow || !this.browsing || this.pointerId !== null || this.touches.size > 0 || !this.resume.enabled) {
      return
    }

    const delay = Number.isFinite(this.resume.delay) ? Math.max(0, this.resume.delay) : DEFAULT.scroll.resume.delay
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

  private clamp(index: number): number {
    return Math.max(0, Math.min(index, this.lineCount - 1))
  }

  /**
   * Keeps the manual anchor during browsing and follows the active index otherwise.
   * An undefined active index suspends automatic following.
   */
  update(activeIndex: number | undefined, lineCount: number, resume: typeof DEFAULT.scroll.resume) {
    this.syncDocument()
    const canFollow = activeIndex !== undefined
    const resumeChanged = canFollow !== this.canFollow || resume !== this.resume
    if (canFollow && !this.canFollow) {
      this.reset()
    }

    this.canFollow = canFollow
    this.lineCount = lineCount
    this.resume = resume
    this.anchorIndex = this.clamp(this.browsing ? this.anchorIndex : (activeIndex ?? this.anchorIndex))
    if (this.browsing && resumeChanged) {
      this.scheduleResume()
    }
  }

  private browse(index: number) {
    const next = this.clamp(index)
    if (next !== this.anchorIndex) {
      this.anchorIndex = next
      this.browsing = true
      this.element.setAttribute('scrolling', '')
      this.requestUpdate()
    }

    if (this.browsing) {
      this.scheduleResume()
    }
  }

  /**
   * Zero-based row used as the viewport anchor.
   */
  get index(): number {
    return this.anchorIndex
  }

  get isBrowsing(): boolean {
    return this.browsing
  }

  /**
   * Ends manual browsing and cancels its resume timer.
   * The default index is the current anchor.
   */
  reset(index = this.anchorIndex) {
    this.clearTimer()
    this.clearInput()
    this.anchorIndex = index
    this.browsing = false
    this.element.removeAttribute('scrolling')
  }

  dispose() {
    this.reset()

    this.element.removeEventListener('wheel', this.handleWheel)
    this.element.removeEventListener('pointerdown', this.handlePointerDown, true)
    this.element.removeEventListener('touchstart', this.handleTouchStart, true)
    this.element.removeEventListener('touchmove', this.handleTouchMove)

    this.unbindDocument()
    this.document = null
  }
}

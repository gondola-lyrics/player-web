export class Event<M extends { [K in keyof M]: (...args: never[]) => void }> {
  private listeners: { [K in keyof M]?: M[K][] } = {}

  /**
   * Registers another subscription even when the same callback is already present.
   */
  add<K extends keyof M>(event: K, listener: M[K]): void {
    const callbacks = this.listeners[event] ?? (this.listeners[event] = [])
    callbacks.push(listener)
  }

  /**
   * Removes only the first matching subscription; duplicates require separate removals.
   */
  remove<K extends keyof M>(event: K, listener: M[K]): void {
    const callbacks = this.listeners[event]
    if (!callbacks) {
      return
    }

    const index = callbacks.indexOf(listener)
    if (index !== -1) {
      callbacks.splice(index, 1)
    }
  }

  /**
   * Listener errors are logged and do not stop later callbacks.
   * Subscription changes during dispatch affect subsequent emissions.
   */
  emit<K extends keyof M>(event: K, ...args: Parameters<M[K]>): void {
    const callbacks = this.listeners[event]
    if (!callbacks) {
      return
    }

    for (const callback of [...callbacks]) {
      try {
        const listener = callback as (...values: Parameters<M[K]>) => void
        listener(...args)
      } catch (error) {
        console.error(error)
      }
    }
  }

  /**
   * Removes all subscriptions; listeners in an ongoing emission's snapshot still run.
   */
  clear(): void {
    this.listeners = {}
  }
}

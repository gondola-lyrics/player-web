/**
 * Dispatches typed events synchronously to registered listeners.
 */
export class Event<M extends { [K in keyof M]: (...args: never[]) => void }> {
  private listeners: { [K in keyof M]?: M[K][] } = {}

  /**
   * Registers a subscription each time, including repeated registrations of the same listener.
   */
  add<K extends keyof M>(event: K, listener: M[K]) {
    const callbacks = this.listeners[event] ?? (this.listeners[event] = [])
    callbacks.push(listener)
  }

  /**
   * Removes the first matching subscription, so duplicates require separate removals.
   */
  remove<K extends keyof M>(event: K, listener: M[K]) {
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
   * Calls a snapshot of registered listeners in order and logs errors before continuing dispatch.
   */
  emit<K extends keyof M>(event: K, ...args: Parameters<M[K]>) {
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
   * Clears all subscriptions for future emissions.
   */
  clear() {
    this.listeners = {}
  }
}

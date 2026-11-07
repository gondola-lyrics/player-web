import type { NestedKeys } from './types'

import { Event } from './event'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const merge = (current: unknown, patch: unknown): unknown => {
  if (patch === undefined) {
    return current
  }
  if (Array.isArray(current) && Array.isArray(patch)) {
    const result = [...current]
    patch.forEach((value, index) => {
      result[index] = merge(current[index], value)
    })
    return result
  }
  if (!isRecord(current) || !isRecord(patch)) {
    return structuredClone(patch)
  }

  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).map(([key, value]) => {
        return [key, merge(Object.hasOwn(current, key) ? current[key] : undefined, value)]
      }),
    ),
  }
}

const compare = (previous: unknown, current: unknown, path: string, changes: Set<string>): boolean => {
  if (Object.is(previous, current)) {
    return false
  }
  if (Array.isArray(previous) && Array.isArray(current)) {
    const same = previous.length === current.length && previous.every((value, index) => !compare(value, current[index], '', new Set()))
    if (same) {
      return false
    }
  } else if (isRecord(previous) && isRecord(current)) {
    let changed = false
    for (const key of new Set([...Object.keys(previous), ...Object.keys(current)])) {
      const childPath = path ? `${path}.${key}` : key
      if (Object.hasOwn(previous, key) !== Object.hasOwn(current, key)) {
        changes.add(childPath)
        changed = true
      } else if (compare(previous[key], current[key], childPath, changes)) {
        changed = true
      }
    }
    if (!changed) {
      return false
    }
  }

  if (path) {
    changes.add(path)
  }
  return true
}

export interface ConfigManagerEventMap<Full, Keys> {
  /**
   * Emitted only when values change; keys include changed descendants and their parent paths.
   */
  update: (keys: Set<Keys>, config: Full) => void
  /**
   * Emitted after any reset update, including when defaults were already in effect.
   */
  reset: (config: Full) => void
}

export class ConfigManager<Full extends object, Init extends object, Keys extends string = NestedKeys<Full>> {
  readonly event = new Event<ConfigManagerEventMap<Full, Keys>>()

  private readonly defaults: Full
  private value: Full

  /**
   * Takes independent copies of defaults and the initial patch without emitting notifications.
   */
  constructor(defaults: Full, initial?: Init) {
    this.defaults = structuredClone(defaults)
    this.value = merge(structuredClone(defaults), initial) as Full
  }

  private update(value: Full): void {
    const changes = new Set<string>()
    compare(this.value, value, '', changes)
    this.value = value
    if (changes.size > 0) {
      this.event.emit('update', changes as Set<Keys>, value)
    }
  }

  /**
   * Undefined fields retain their previous values; arrays merge by index.
   * Only changed values produce an update event.
   */
  merge(patch: Init): void {
    this.update(merge(structuredClone(this.value), patch) as Full)
  }

  /**
   * Commits an edited copy only after the callback succeeds, so a failed edit leaves state and listeners untouched.
   */
  modify(edit: (config: Full) => void): void {
    const value = structuredClone(this.value)
    edit(value)
    this.update(value)
  }

  /**
   * Restores the saved defaults and always emits reset.
   * A value change also emits update first.
   */
  reset(): void {
    this.update(structuredClone(this.defaults))
    this.event.emit('reset', this.value)
  }

  /**
   * Exposes the live stored object; use merge or modify to publish edits to subscribers.
   */
  get current(): Full {
    return this.value
  }
}

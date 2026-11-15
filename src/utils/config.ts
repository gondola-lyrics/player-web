import type { DeepReadonly, NestedKeys } from './types'

import { Event } from './event'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const merge = (current: unknown, patch: unknown, validate: (path: string, value: unknown) => boolean, path = ''): unknown => {
  if (patch === undefined || patch === null) {
    return current
  }
  if (isRecord(current)) {
    if (!isRecord(patch)) {
      return current
    }
    return Object.fromEntries(
      Object.entries(current).map(([key, value]) => {
        const childPath = path ? `${path}.${key}` : key
        return [key, Object.hasOwn(patch, key) ? merge(value, patch[key], validate, childPath) : value]
      }),
    )
  }
  if (typeof current !== typeof patch || Array.isArray(current) !== Array.isArray(patch) || !validate(path, patch)) {
    return current
  }
  return structuredClone(patch)
}

const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) {
      freeze(child)
    }
    Object.freeze(value)
  }
  return value
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
  readonly event = new Event<ConfigManagerEventMap<DeepReadonly<Full>, Keys>>()

  private readonly defaults: Full
  private value: Full

  /**
   * Keeps the defaults' shape and accepts only valid initial fields without emitting notifications.
   */
  constructor(
    defaults: Full,
    initial?: Init,
    private readonly validate?: (path: Keys, value: unknown) => boolean,
  ) {
    this.defaults = freeze(structuredClone(defaults))
    this.value = freeze(this.apply(this.defaults, initial))
  }

  private apply(current: Full, patch: unknown): Full {
    return merge(current, patch, (path, value) => {
      return this.validate?.(path as Keys, value) ?? true
    }) as Full
  }

  private update(value: Full) {
    const changes = new Set<string>()
    compare(this.value, value, '', changes)
    if (changes.size > 0) {
      this.value = freeze(value)
      this.event.emit('update', changes as Set<Keys>, value)
    }
  }

  /**
   * Null, undefined, unknown keys and fields of the wrong type retain their previous values; arrays replace as a whole.
   * Only changed values produce an update event.
   */
  merge(patch: Init) {
    this.update(this.apply(this.value, patch))
  }

  /**
   * Commits an edited copy only after the callback succeeds, so a failed edit leaves state and listeners untouched.
   */
  modify(edit: (config: Full) => void) {
    const value = structuredClone(this.value)
    edit(value)
    this.update(this.apply(this.value, value))
  }

  /**
   * Restores the saved defaults and always emits reset.
   * A value change also emits update first.
   */
  reset() {
    this.update(structuredClone(this.defaults))
    this.event.emit('reset', this.value)
  }

  /**
   * Returns a frozen snapshot; use merge or modify to publish edits to subscribers.
   */
  get current(): DeepReadonly<Full> {
    return this.value as DeepReadonly<Full>
  }
}

import type { DeepReadonly, NestedKeys, NestedObjectKeys, PathValue } from './types'

import { Event } from './event'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const isEqual = (previous: unknown, current: unknown): boolean => {
  if (Object.is(previous, current)) {
    return true
  }

  if (Array.isArray(previous) && Array.isArray(current)) {
    if (previous.length !== current.length) {
      return false
    }

    for (let index = 0; index < previous.length; index++) {
      if (!isEqual(previous[index], current[index])) {
        return false
      }
    }
    return true
  }

  if (isRecord(previous) && isRecord(current)) {
    const keys = Object.keys(previous)
    if (keys.length !== Object.keys(current).length) {
      return false
    }

    for (const key of keys) {
      if (!Object.hasOwn(current, key) || !isEqual(previous[key], current[key])) {
        return false
      }
    }
    return true
  }

  return false
}

const merge = (current: unknown, patch: unknown, changes: Set<string>, path: string): unknown => {
  if (patch === undefined || patch === null) {
    return current
  }

  if (isRecord(current)) {
    if (current === patch || !isRecord(patch)) {
      return current
    }

    let result = current
    for (const [key, value] of Object.entries(patch)) {
      if (!Object.hasOwn(current, key)) {
        continue
      }

      const childPath = path ? `${path}.${key}` : key
      const next = merge(current[key], value, changes, childPath)
      if (Object.is(next, current[key])) {
        continue
      }

      if (result === current) {
        result = { ...current }
      }
      result[key] = next
    }

    if (result !== current && path) {
      changes.add(path)
    }
    return result
  }

  if (typeof current !== typeof patch || Array.isArray(current) !== Array.isArray(patch)) {
    return current
  }

  if (isEqual(current, patch)) {
    return current
  }

  changes.add(path)
  return typeof patch === 'object' || typeof patch === 'function' ? structuredClone(patch) : patch
}

const mergeAtPath = (current: unknown, patch: unknown, parts: readonly string[], changes: Set<string>, path = '', depth = 0): unknown => {
  const key = parts[depth]
  if (key === undefined) {
    return merge(current, patch, changes, path)
  }

  if (!isRecord(current) || !Object.hasOwn(current, key)) {
    return current
  }

  const childPath = path ? `${path}.${key}` : key
  const next = mergeAtPath(current[key], patch, parts, changes, childPath, depth + 1)
  if (Object.is(next, current[key])) {
    return current
  }

  if (path) {
    changes.add(path)
  }
  return { ...current, [key]: next }
}

const readPath = (value: unknown, parts: readonly string[]): unknown => {
  let current = value
  for (const key of parts) {
    if (!isRecord(current) || !Object.hasOwn(current, key)) {
      return undefined
    }
    current = current[key]
  }

  return current
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

const isThenable = (value: unknown): boolean => {
  return value !== null && (typeof value === 'object' || typeof value === 'function') && 'then' in value && typeof value.then === 'function'
}

export interface ConfigManagerEventMap<Full, Keys> {
  /**
   * Emitted only when values change; keys include changed descendants and their parent paths.
   */
  update: (keys: Set<Keys>, config: Full) => void
  /**
   * The optional path identifies a partial reset; this event also fires when no values change.
   */
  reset: (config: Full, path?: Keys) => void
}

export class ConfigScope<
  Full extends object,
  Init extends object,
  Path extends Keys & NestedObjectKeys<Full>,
  Keys extends string = NestedKeys<Full>,
> {
  private readonly parts: readonly string[]

  constructor(
    private readonly manager: ConfigManager<Full, Init, Keys>,
    private readonly path: Path,
  ) {
    this.parts = path.split('.')
  }

  /**
   * Merges known fields into this section while preserving omitted values.
   */
  merge(patch: PathValue<Init, Path>): void
  /**
   * Resolves the field relative to this section and uses the root merge rules.
   */
  merge<Relative extends NestedKeys<PathValue<Full, Path>>>(relative: Relative, patch: PathValue<PathValue<Init, Path>, NoInfer<Relative>>): void
  merge(pathOrPatch: string | PathValue<Init, Path>, patch?: unknown) {
    const path = typeof pathOrPatch === 'string' ? `${this.path}.${pathOrPatch}` : this.path
    const value = typeof pathOrPatch === 'string' ? patch : pathOrPatch
    this.manager.merge(path as Keys, value as PathValue<Init, Keys>)
  }

  /**
   * Edits a synchronous copy of this section; a failed callback publishes nothing.
   */
  modify(edit: (config: PathValue<Full, Path>) => void): void
  /**
   * Copies only the relative object section before publishing the edit.
   */
  modify<Relative extends NestedObjectKeys<PathValue<Full, Path>>>(
    relative: Relative,
    edit: (config: PathValue<PathValue<Full, Path>, NoInfer<Relative>>) => void,
  ): void
  modify(pathOrEdit: string | ((config: never) => void), edit?: (config: never) => void) {
    const path = typeof pathOrEdit === 'string' ? `${this.path}.${pathOrEdit}` : this.path
    const callback = typeof pathOrEdit === 'function' ? pathOrEdit : edit
    if (callback) {
      this.manager.modify(path as Keys & NestedObjectKeys<Full>, callback as (config: PathValue<Full, Keys & NestedObjectKeys<Full>>) => void)
    }
  }

  /**
   * Restores this section or a relative field to library defaults while preserving sibling sections.
   */
  reset(relative?: NestedKeys<PathValue<Full, Path>>) {
    const path = relative === undefined ? this.path : `${this.path}.${relative}`
    this.manager.reset(path as Keys)
  }

  /**
   * Binds a deeper object section using a path relative to this one.
   */
  scope<Relative extends NestedObjectKeys<PathValue<Full, Path>>>(relative: Relative) {
    const path = `${this.path}.${relative}` as Extract<`${Path}.${Relative}`, Keys & NestedObjectKeys<Full>>
    return this.manager.scope(path)
  }

  /**
   * Reads the latest frozen section; previously read snapshots remain unchanged.
   */
  get current(): DeepReadonly<PathValue<Full, Path>> {
    return readPath(this.manager.current, this.parts) as DeepReadonly<PathValue<Full, Path>>
  }
}

export class ConfigManager<Full extends object, Init extends object, Keys extends string = NestedKeys<Full>> {
  readonly event = new Event<ConfigManagerEventMap<DeepReadonly<Full>, Keys>>()

  private readonly defaults: Full
  private readonly paths = new Map<string, readonly string[]>()
  private value: Full

  constructor(defaults: Full, initial?: Init) {
    this.defaults = freeze(structuredClone(defaults))
    this.value = freeze(this.apply(this.defaults, initial).value)
  }

  private resolvePath(path: string): readonly string[] | undefined {
    const cached = this.paths.get(path)
    if (cached) {
      return cached
    }

    const parts = path.split('.')
    if (readPath(this.defaults, parts) === undefined) {
      return undefined
    }

    // The shape is fixed; caching only valid paths bounds storage to the configuration's fields.
    this.paths.set(path, parts)
    return parts
  }

  private apply(current: Full, patch: unknown, parts: readonly string[] = []) {
    const changes = new Set<string>()
    const value = mergeAtPath(current, patch, parts, changes) as Full

    return { value, changes: changes as Set<Keys> }
  }

  private update(patch: unknown, parts: readonly string[] = []) {
    const { value, changes } = this.apply(this.value, patch, parts)

    if (changes.size > 0) {
      this.value = freeze(value)
      this.event.emit('update', changes, this.current)
    }
  }

  /**
   * Applies known fields with matching runtime types; null and undefined preserve their previous values.
   * Objects merge recursively, arrays replace as a whole, and equal updates emit nothing.
   */
  merge(patch: Init): void
  /**
   * Applies the merge rules directly to a field, preserving omitted fields in object patches.
   */
  merge<Path extends Keys>(path: Path, patch: PathValue<Init, NoInfer<Path>>): void
  merge(pathOrPatch: string | Init, patch?: unknown) {
    if (typeof pathOrPatch === 'string') {
      const parts = this.resolvePath(pathOrPatch)
      if (parts) {
        this.update(patch, parts)
      }
    } else {
      this.update(pathOrPatch)
    }
  }

  /**
   * Publishes an edited copy after the synchronous callback succeeds.
   * Throwing or returning a promise leaves state and listeners untouched.
   */
  modify(edit: (config: Full) => void): void
  /**
   * Copies only the object at the path before publishing the edit.
   */
  modify<Path extends Keys & NestedObjectKeys<Full>>(path: Path, edit: (config: PathValue<Full, NoInfer<Path>>) => void): void
  modify(pathOrEdit: string | ((config: never) => void), edit?: (config: never) => void) {
    const parts = typeof pathOrEdit === 'string' ? this.resolvePath(pathOrEdit) : []
    const callback = typeof pathOrEdit === 'function' ? pathOrEdit : edit
    if (!parts || !callback) {
      return
    }

    const current = readPath(this.value, parts)
    if (!isRecord(current)) {
      return
    }

    const value = structuredClone(current)
    if (isThenable(callback(value as never))) {
      throw new TypeError('Configuration edits must be synchronous')
    }
    this.update(value, parts)
  }

  /**
   * Restores library defaults for the whole tree or one field; constructor overrides are not reset targets.
   * Emits update first when values change, then reset even when already at defaults.
   */
  reset(path?: Keys) {
    const parts = path === undefined ? [] : this.resolvePath(path)
    if (!parts) {
      return
    }

    const value = readPath(this.defaults, parts)
    if (value === undefined) {
      return
    }

    this.update(value, parts)
    this.event.emit('reset', this.current, path)
  }

  /**
   * Creates an object-section handle with a fixed path and no independent state or subscriptions.
   */
  scope<Path extends Keys & NestedObjectKeys<Full>>(path: Path): ConfigScope<Full, Init, Path, Keys> {
    const parts = this.resolvePath(path)
    if (!parts || !isRecord(readPath(this.value, parts))) {
      throw new TypeError('Configuration scopes require an object path')
    }

    return new ConfigScope(this, path)
  }

  /**
   * Returns a frozen snapshot; use merge or modify to publish edits to subscribers.
   */
  get current(): DeepReadonly<Full> {
    return this.value as DeepReadonly<Full>
  }
}

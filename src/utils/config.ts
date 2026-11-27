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

const markChanges = (value: unknown, changes: Set<string>, path: string) => {
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      markChanges(child, changes, path ? `${path}.${key}` : key)
    }
  }

  if (path) {
    changes.add(path)
  }
}

const isSafeKey = (key: string): boolean => {
  return key !== '__proto__' && key !== 'constructor' && key !== 'prototype'
}

const merge = (current: unknown, patch: unknown, defaults: unknown, changes: Set<string>, path: string, replace = false): unknown => {
  if (replace && patch === undefined) {
    if (current !== undefined) {
      markChanges(current, changes, path)
    }
    return undefined
  }

  if (patch === undefined || patch === null) {
    return current
  }

  if (isRecord(patch)) {
    if (defaults !== undefined && !isRecord(defaults)) {
      return current
    }
    if (current === patch) {
      return current
    }

    const template = isRecord(defaults) ? defaults : {}
    const open = Object.keys(template).length === 0
    const previous = isRecord(current) ? current : {}
    let result = previous
    // A reset also visits existing keys so it can clear fields absent from the defaults.
    const keys = replace ? new Set([...Object.keys(previous), ...Object.keys(template)]) : Object.keys(patch)
    for (const key of keys) {
      if (!isSafeKey(key) || (!open && !Object.hasOwn(template, key))) {
        continue
      }

      const childPath = path ? `${path}.${key}` : key
      const next = merge(previous[key], patch[key], template[key], changes, childPath, replace)
      if (Object.is(next, previous[key])) {
        continue
      }

      if (result === previous) {
        result = { ...previous }
      }
      if (next === undefined) {
        delete result[key]
      } else {
        result[key] = next
      }
    }

    if (result !== previous && path) {
      changes.add(path)
    }
    return result === previous ? current : result
  }

  if (defaults !== undefined && (typeof defaults !== typeof patch || Array.isArray(defaults) !== Array.isArray(patch))) {
    return current
  }

  if (isEqual(current, patch)) {
    return current
  }

  changes.add(path)
  return typeof patch === 'object' || typeof patch === 'function' ? structuredClone(patch) : patch
}

const mergeAtPath = (
  current: unknown,
  patch: unknown,
  defaults: unknown,
  parts: readonly string[],
  changes: Set<string>,
  replace = false,
  path = '',
  depth = 0,
): unknown => {
  const key = parts[depth]
  if (key === undefined) {
    return merge(current, patch, defaults, changes, path, replace)
  }

  if (!isSafeKey(key) || (defaults !== undefined && (!isRecord(defaults) || (Object.keys(defaults).length > 0 && !Object.hasOwn(defaults, key))))) {
    return current
  }

  const previous = isRecord(current) ? current : {}
  const childPath = path ? `${path}.${key}` : key
  const next = mergeAtPath(previous[key], patch, isRecord(defaults) ? defaults[key] : undefined, parts, changes, replace, childPath, depth + 1)
  if (Object.is(next, previous[key])) {
    return current
  }

  if (path) {
    changes.add(path)
  }

  const result = { ...previous }
  if (next === undefined) {
    delete result[key]
  } else {
    result[key] = next
  }
  return result
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
   * Reports changed field paths and their ancestors with the updated snapshot.
   */
  update: (keys: Set<Keys>, config: Full) => void
  /**
   * Reports every valid reset, including partial resets and resets with no changed values.
   */
  reset: (config: Full, path?: Keys) => void
}

/**
 * Provides relative access to a nested section of the shared configuration.
 */
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
   * Merges supplied values into this section while retaining omitted fields.
   */
  merge(patch: PathValue<Init, Path>): void
  /**
   * Merges a patch at a path relative to this section.
   */
  merge<Relative extends NestedKeys<PathValue<Full, Path>>>(relative: Relative, patch: PathValue<PathValue<Init, Path>, NoInfer<Relative>>): void
  merge(pathOrPatch: string | PathValue<Init, Path>, patch?: unknown) {
    const path = typeof pathOrPatch === 'string' ? `${this.path}.${pathOrPatch}` : this.path
    const value = typeof pathOrPatch === 'string' ? patch : pathOrPatch
    this.manager.merge(path as Keys, value as PathValue<Init, Keys>)
  }

  /**
   * Passes a copy of this section to a synchronous edit callback and merges the result on success.
   */
  modify(edit: (config: NonNullable<PathValue<Full, Path>>) => void): void
  /**
   * Applies a synchronous edit to a copy of the object at the relative path.
   */
  modify<Relative extends NestedObjectKeys<PathValue<Full, Path>>>(
    relative: Relative,
    edit: (config: NonNullable<PathValue<PathValue<Full, Path>, NoInfer<Relative>>>) => void,
  ): void
  modify(pathOrEdit: string | ((config: never) => void), edit?: (config: never) => void) {
    const path = typeof pathOrEdit === 'string' ? `${this.path}.${pathOrEdit}` : this.path
    const callback = typeof pathOrEdit === 'function' ? pathOrEdit : edit
    if (callback) {
      this.manager.modify(
        path as Keys & NestedObjectKeys<Full>,
        callback as (config: NonNullable<PathValue<Full, Keys & NestedObjectKeys<Full>>>) => void,
      )
    }
  }

  /**
   * Restores defaults for this section or a relative path, clearing fields without defaults.
   */
  reset(relative?: NestedKeys<PathValue<Full, Path>>) {
    const path = relative === undefined ? this.path : `${this.path}.${relative}`
    this.manager.reset(path as Keys)
  }

  /**
   * Opens a child object section with a path relative to this one.
   */
  scope<Relative extends NestedObjectKeys<PathValue<Full, Path>>>(relative: Relative) {
    const path = `${this.path}.${relative}` as Extract<`${Path}.${Relative}`, Keys & NestedObjectKeys<Full>>
    return this.manager.scope(path)
  }

  /**
   * Latest frozen snapshot of this section, or `undefined` for an omitted optional section.
   */
  get current(): DeepReadonly<PathValue<Full, Path>> {
    return readPath(this.manager.current, this.parts) as DeepReadonly<PathValue<Full, Path>>
  }
}

/**
 * Applies configuration patches against defaults and publishes frozen snapshots.
 */
export class ConfigManager<Full extends object, Init extends object, Keys extends string = NestedKeys<Full>> {
  /**
   * Subscriptions for settings changes and resets.
   */
  readonly event = new Event<ConfigManagerEventMap<DeepReadonly<Full>, Keys>>()

  private readonly defaults: Full
  private readonly paths = new Map<string, readonly string[]>()
  private value: Full

  constructor(defaults: Full, initial?: Init) {
    this.defaults = freeze(structuredClone(defaults))
    this.value = freeze(mergeAtPath(this.defaults, initial, this.defaults, [], new Set()) as Full)
  }

  private resolvePath(path: string): readonly string[] | undefined {
    const cached = this.paths.get(path)
    if (cached) {
      return cached
    }

    const parts = path.split('.')
    let current: unknown = this.defaults
    for (const key of parts) {
      if (!isSafeKey(key)) {
        return undefined
      }
      if (current === undefined) {
        continue
      }
      if (!isRecord(current) || (Object.keys(current).length > 0 && !Object.hasOwn(current, key))) {
        return undefined
      }
      current = current[key]
    }

    this.paths.set(path, parts)
    return parts
  }

  private update(patch: unknown, parts: readonly string[] = [], replace = false) {
    const changes = new Set<string>()
    const value = mergeAtPath(this.value, patch, this.defaults, parts, changes, replace) as Full

    if (changes.size > 0) {
      this.value = freeze(value)
      this.event.emit('update', changes as Set<Keys>, this.current)
    }
  }

  /**
   * Recursively merges objects, replaces arrays, and retains values for nullish fields.
   *
   * Populated default objects constrain keys and value types. Empty default objects accept optional keys.
   * Changes are published only when values differ.
   */
  merge(patch: Init): void
  /**
   * Applies the same merge rules to the value at the given path.
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
   * Merges an edited copy after the synchronous callback succeeds.
   * A thrown error or a returned promise discards the draft.
   */
  modify(edit: (config: Full) => void): void
  /**
   * Applies a synchronous edit to a copy of the object at the given path.
   */
  modify<Path extends Keys & NestedObjectKeys<Full>>(path: Path, edit: (config: NonNullable<PathValue<Full, NoInfer<Path>>>) => void): void
  modify(pathOrEdit: string | ((config: never) => void), edit?: (config: never) => void) {
    const parts = typeof pathOrEdit === 'string' ? this.resolvePath(pathOrEdit) : []
    const callback = typeof pathOrEdit === 'function' ? pathOrEdit : edit
    if (!parts || !callback) {
      return
    }

    const defaults = readPath(this.defaults, parts)
    if (defaults !== undefined && !isRecord(defaults)) {
      return
    }

    const current = readPath(this.value, parts)
    const value = structuredClone(isRecord(current) ? current : {})
    if (isThenable(callback(value as never))) {
      throw new TypeError('Configuration edits must be synchronous')
    }
    this.update(value, parts)
  }

  /**
   * Restores the baseline defaults and clears fields absent from them.
   * Emits `update` for changed values before emitting `reset`.
   */
  reset(path?: Keys) {
    const parts = path === undefined ? [] : this.resolvePath(path)
    if (!parts) {
      return
    }

    const value = readPath(this.defaults, parts)
    this.update(value, parts, true)
    this.event.emit('reset', this.current, path)
  }

  /**
   * Opens an object section backed by this configuration, including omitted optional sections.
   */
  scope<Path extends Keys & NestedObjectKeys<Full>>(path: Path): ConfigScope<Full, Init, Path, Keys> {
    const parts = this.resolvePath(path)
    const defaults = parts ? readPath(this.defaults, parts) : undefined
    if (!parts || (defaults !== undefined && !isRecord(defaults))) {
      throw new TypeError('Configuration scopes require an object path')
    }

    return new ConfigScope(this, path)
  }

  /**
   * Reads the first non-nullish value in path order, or `undefined` when every candidate is absent.
   */
  resolve<const Paths extends readonly [Keys, ...Keys[]]>(
    ...paths: Paths
  ): DeepReadonly<
    | NonNullable<PathValue<Full, Paths[number]>>
    | (Paths extends readonly [...Keys[], infer Last extends Keys]
        ? Extract<PathValue<Full, Last>, null | undefined> extends never
          ? never
          : undefined
        : undefined)
  >
  resolve(...paths: Keys[]): unknown {
    for (const path of paths) {
      const parts = this.resolvePath(path)
      const value = parts ? readPath(this.value, parts) : undefined
      if (value !== undefined && value !== null) {
        return value
      }
    }
  }

  /**
   * Current frozen snapshot, retained independently of later edits.
   */
  get current(): DeepReadonly<Full> {
    return this.value as DeepReadonly<Full>
  }
}

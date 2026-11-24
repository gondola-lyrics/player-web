/**
 * Models the resolved configuration produced by applying defaults.
 */
export type DeepRequired<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends object ? DeepRequired<NonNullable<T[K]>> : NonNullable<T[K]>
}

/**
 * Prevents edits to published configuration snapshots, including nested values.
 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K]
}

/**
 * Includes parent paths so subscribers can watch an entire configuration section.
 * Arrays remain leaf values.
 */
export type NestedKeys<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends readonly unknown[]
    ? K
    : NonNullable<T[K]> extends object
      ? K | `${K}.${NestedKeys<NonNullable<T[K]>>}`
      : K
}[keyof T & string]

/**
 * Excludes leaves and arrays from paths that can expose an editable configuration section.
 */
export type NestedObjectKeys<T> = {
  [K in keyof T & string]: NonNullable<T[K]> extends readonly unknown[]
    ? never
    : NonNullable<T[K]> extends object
      ? K | `${K}.${NestedObjectKeys<NonNullable<T[K]>>}`
      : never
}[keyof T & string]

/**
 * Resolves a path through optional sections while preserving the target field's input type.
 */
export type PathValue<T, Path extends string> = Path extends `${infer Key}.${infer Rest}`
  ? Key extends keyof NonNullable<T>
    ? PathValue<NonNullable<T>[Key], Rest>
    : never
  : Path extends keyof NonNullable<T>
    ? NonNullable<T>[Path]
    : never

/**
 * Models the resolved configuration produced by applying defaults.
 */
export type DeepRequired<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends object ? DeepRequired<NonNullable<T[K]>> : NonNullable<T[K]>
}

/**
 * Types published configuration snapshots as read-only at every depth.
 */
export type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T

/**
 * Includes parent paths so subscribers can watch an entire configuration section.
 * Arrays remain leaf values.
 */
export type NestedKeys<T> = {
  [K in keyof NonNullable<T> & string]: NonNullable<NonNullable<T>[K]> extends readonly unknown[]
    ? K
    : NonNullable<NonNullable<T>[K]> extends object
      ? K | `${K}.${NestedKeys<NonNullable<T>[K]>}`
      : K
}[keyof NonNullable<T> & string]

/**
 * Excludes leaves and arrays from paths that can expose an editable configuration section.
 */
export type NestedObjectKeys<T> = {
  [K in keyof NonNullable<T> & string]: NonNullable<NonNullable<T>[K]> extends readonly unknown[]
    ? never
    : NonNullable<NonNullable<T>[K]> extends object
      ? K | `${K}.${NestedObjectKeys<NonNullable<T>[K]>}`
      : never
}[keyof NonNullable<T> & string]

/**
 * Resolves a path through optional sections while preserving the target field's declared type.
 */
export type PathValue<T, Path extends string> = Path extends `${infer Key}.${infer Rest}`
  ? Key extends keyof NonNullable<T>
    ? PathValue<NonNullable<T>[Key], Rest>
    : never
  : Path extends keyof NonNullable<T>
    ? NonNullable<T>[Path]
    : never

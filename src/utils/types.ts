/**
 * Models the resolved configuration produced by applying defaults.
 */
export type DeepRequired<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends object ? DeepRequired<NonNullable<T[K]>> : NonNullable<T[K]>
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

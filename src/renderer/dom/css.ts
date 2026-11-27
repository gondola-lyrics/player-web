export const CSS_NAMESPACE = 'gondola-lyrics-player'

export const buildClassName = (target: string) => {
  return `${CSS_NAMESPACE}-${target}`
}

export const buildRootVariableKey = (target: string) => {
  return `--${CSS_NAMESPACE}-${target}`
}

/**
 * Pass the `line-` segment as part of `target`.
 */
export const buildLineVariableKey = (target: string) => {
  return buildRootVariableKey(target)
}

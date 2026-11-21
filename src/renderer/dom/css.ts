export const CSS_NAMESPACE = 'gondola-lyrics-player'

/**
 * Names generated nodes consistently with the renderer's SCSS selectors.
 */
export const buildClassName = (target: string) => {
  return `${CSS_NAMESPACE}-${target}`
}

/**
 * Accepts a variable name without the shared player prefix.
 */
export const buildRootVariableKey = (target: string) => {
  return `--${CSS_NAMESPACE}-${target}`
}

/**
 * Accepts the complete line variable name, including its line- segment.
 */
export const buildLineVariableKey = (target: string) => {
  return buildRootVariableKey(target)
}

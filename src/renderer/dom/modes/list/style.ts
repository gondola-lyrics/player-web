import type { DomRendererConfigManager } from '@root/renderer/dom/config'

import { DEFAULT } from '@root/renderer/dom/components/line/config'
import { buildLineVariableKey } from '@root/renderer/dom/css'

const FONT_SIZE = buildLineVariableKey('line-normal-base-font-size')
const FONT_FAMILY = buildLineVariableKey('line-normal-base-font-family')
const FONT_WEIGHT = buildLineVariableKey('line-normal-base-font-weight')
const STYLE_STATES = ['normal', 'active', 'played'] as const
const STYLE_VARIABLES = {
  normal: {
    color: buildLineVariableKey('line-normal-main-syllable-color'),
    opacity: buildLineVariableKey('line-normal-main-syllable-opacity'),
  },
  active: {
    color: buildLineVariableKey('line-normal-main-syllable-active-color'),
    opacity: buildLineVariableKey('line-normal-main-syllable-active-opacity'),
  },
  played: {
    color: buildLineVariableKey('line-normal-main-syllable-played-color'),
    opacity: buildLineVariableKey('line-normal-main-syllable-played-opacity'),
  },
}

export const LAYOUT_STYLE_KEYS = [FONT_SIZE, FONT_FAMILY, FONT_WEIGHT] as const

/**
 * Resolves sparse list overrides into the complete inherited row style before measurement.
 */
export const buildListStyle = (config: DomRendererConfigManager): Record<string, string> => {
  const size = config.resolve('modes.list.line.font.size', 'common.line.font.size')
  const family = config.resolve('modes.list.line.font.family', 'common.line.font.family')
  const weight = config.resolve('modes.list.line.font.weight', 'common.line.font.weight')
  const variables: Record<string, string> = {
    [FONT_SIZE]: `${Number.isFinite(size) && size > 0 ? size : DEFAULT.font.size}px`,
    [FONT_FAMILY]: family || 'inherit',
    [FONT_WEIGHT]: String(Number.isFinite(weight) ? weight : DEFAULT.font.weight),
  }

  for (const state of STYLE_STATES) {
    const color = config.resolve(`modes.list.line.style.${state}.color`, `common.line.style.${state}.color`)
    const opacity = config.resolve(`modes.list.line.style.${state}.opacity`, `common.line.style.${state}.opacity`)
    variables[STYLE_VARIABLES[state].color] = color
    variables[STYLE_VARIABLES[state].opacity] = String(opacity)
  }

  return variables
}

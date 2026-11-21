import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'
import type { LineConfig } from './components/line/config'
import type { ListModeConfig } from './modes/list/config'

import { DEFAULT as LINE_DEFAULT } from './components/line/config'
import { DEFAULT as LIST_DEFAULT } from './modes/list/config'

export type DomRendererMode = 'list'

export interface DomRendererConfig {
  /**
   * Switching disposes the current mode and syncs the new one with the player's latest state.
   *
   * @default 'list'
   */
  mode?: DomRendererMode
  line?: LineConfig
  modes?: {
    list?: ListModeConfig
  }
}

export type DomRendererConfigRequired = DeepRequired<DomRendererConfig>
export type DomRendererConfigKeys = NestedKeys<DomRendererConfig>
export type DomRendererConfigManager = ConfigManager<DomRendererConfigRequired, DomRendererConfig>

export const DEFAULT: DomRendererConfigRequired = Object.freeze({
  mode: 'list',
  line: LINE_DEFAULT,
  modes: Object.freeze({ list: LIST_DEFAULT }),
})

/**
 * Rejects unsupported choices before they reach the renderer or its stored configuration.
 */
export const validateConfig = (path: DomRendererConfigKeys, value: unknown): boolean => {
  if (path === 'mode') {
    return value === 'list'
  }
  if (path === 'modes.list.align') {
    return value === 'left' || value === 'center' || value === 'right'
  }
  if (path === 'modes.list.scroll.animation.mode') {
    return value === 'uniform'
  }
  if (path === 'modes.list.scroll.animation.duration' || path === 'modes.list.scroll.animation.uniform.delay') {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
  }
  return true
}

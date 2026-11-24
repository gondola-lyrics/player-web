import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'
import type { ListModeConfig } from './modes/list/config'

import { DEFAULT as LIST_DEFAULT } from './modes/list/config'

export type DomRendererMode = 'list'

export interface DomRendererConfig {
  /**
   * Switching disposes the current mode and syncs the new one with the player's latest state.
   *
   * @default 'list'
   */
  mode?: DomRendererMode
  modes?: {
    list?: ListModeConfig
  }
}

export type DomRendererConfigRequired = DeepRequired<DomRendererConfig>
export type DomRendererConfigKeys = NestedKeys<DomRendererConfig>
export type DomRendererConfigManager = ConfigManager<DomRendererConfigRequired, DomRendererConfig>

export const DEFAULT: DomRendererConfigRequired = Object.freeze({
  mode: 'list',
  modes: Object.freeze({ list: LIST_DEFAULT }),
})

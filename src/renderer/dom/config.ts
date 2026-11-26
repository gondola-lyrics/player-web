import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'
import type { ContentConfig } from './components/line/config'
import type { ListModeConfig } from './modes/list/config'

import { DEFAULT as CONTENT_DEFAULT } from './components/line/config'
import { DEFAULT as LIST_DEFAULT } from './modes/list/config'

export type DomRendererMode = 'list'

export interface DomRendererConfig {
  /**
   * Switching disposes the current mode and syncs the new one with the player's latest state.
   *
   * @default 'list'
   */
  mode?: DomRendererMode
  /**
   * Modes inherit these values unless they explicitly override the corresponding field.
   */
  common?: {
    content?: ContentConfig
  }
  modes?: {
    list?: ListModeConfig
  }
}

export type DomRendererConfigRequired = DeepRequired<Omit<DomRendererConfig, 'modes'>> & { modes: { list: typeof LIST_DEFAULT } }

export type DomRendererConfigKeys = NestedKeys<DomRendererConfig>
export type DomRendererConfigManager = ConfigManager<DomRendererConfigRequired, DomRendererConfig>

export const DEFAULT: DomRendererConfigRequired = Object.freeze({
  mode: 'list',
  common: Object.freeze({ content: CONTENT_DEFAULT }),
  modes: Object.freeze({ list: LIST_DEFAULT }),
})

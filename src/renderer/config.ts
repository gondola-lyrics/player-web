import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'

export type DomRendererMode = 'list'

export interface DomRendererConfig {
  /**
   * Switching disposes the current mode and syncs the new one with the player's latest state.
   *
   * @default 'list'
   */
  mode?: DomRendererMode
}

export type DomRendererConfigRequired = DeepRequired<DomRendererConfig>
export type DomRendererConfigKeys = NestedKeys<DomRendererConfig>
export type DomRendererConfigManager = ConfigManager<DomRendererConfigRequired, DomRendererConfig>

export const DEFAULT: DomRendererConfigRequired = Object.freeze({
  mode: 'list',
})

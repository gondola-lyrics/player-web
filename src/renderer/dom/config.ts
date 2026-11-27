import type { ConfigManager, DeepRequired, NestedKeys } from '@root/utils'
import type { ContentConfig } from './components/line/config'
import type { ListModeConfig } from './modes/list/config'

import { DEFAULT as CONTENT_DEFAULT } from './components/line/config'
import { DEFAULT as LIST_DEFAULT } from './modes/list/config'

export type DomRendererMode = 'list'

export interface DomRendererConfig {
  /**
   * Selects the display mode. A switch replaces the mode and renders the current lyric.
   *
   * @default 'list'
   */
  mode?: DomRendererMode
  /**
   * Fallback settings shared by all display modes.
   */
  common?: {
    /**
     * Default text representation, appearance, and word effects for each mode.
     */
    content?: ContentConfig
  }
  /**
   * Overrides organized by display mode.
   */
  modes?: {
    /**
     * List layout, scrolling, and overrides for the shared content settings.
     */
    list?: ListModeConfig
  }
}

export type DomRendererConfigRequired = DeepRequired<Omit<DomRendererConfig, 'modes'>> & {
  /**
   * Mode settings with layout and scrolling defaults applied.
   */
  modes: {
    /**
     * List settings whose content overrides still inherit from `common.content` field by field.
     */
    list: typeof LIST_DEFAULT
  }
}

/**
 * Dot-separated paths to renderer settings, including whole branches.
 */
export type DomRendererConfigKeys = NestedKeys<DomRendererConfig>
export type DomRendererConfigManager = ConfigManager<DomRendererConfigRequired, DomRendererConfig>

export const DEFAULT: DomRendererConfigRequired = Object.freeze({
  mode: 'list',
  common: Object.freeze({ content: CONTENT_DEFAULT }),
  modes: Object.freeze({ list: LIST_DEFAULT }),
})

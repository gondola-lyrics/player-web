import type { CorePlayerConfig } from '@gondola-lyrics/player/core'
import type { DomRendererConfig } from '@gondola-lyrics/player/renderer'
import type { usePlayer } from './usePlayer'

import { onScopeDispose, ref, shallowRef } from 'vue'

import { readRecord, readStorage, writeStorage } from '../lib/storage'

export const RENDERER_PRESET: DomRendererConfig = {
  line: { font: { size: 38, weight: 500 } },
  modes: { list: { gap: 24 } },
}

const SETTINGS_KEY = 'gondola-player-settings-v1'
const DEFAULT_RESUME_DELAY = 3000

const pickOverrides = (current: object, defaults: object): Record<string, unknown> => {
  const baseline = defaults as Record<string, unknown>
  const entries: [string, unknown][] = []

  for (const [key, value] of Object.entries(current)) {
    const defaultValue = baseline[key]
    if (value !== null && typeof value === 'object' && defaultValue !== null && typeof defaultValue === 'object') {
      const children = pickOverrides(value, defaultValue)
      if (Object.keys(children).length > 0) {
        entries.push([key, children])
      }
    } else if (!Object.is(value, defaultValue)) {
      entries.push([key, value])
    }
  }

  return Object.fromEntries(entries)
}

/**
 * Publishes resolved configuration snapshots and persists ordinary nested patches without mutating them.
 */
export const useSettings = (player: ReturnType<typeof usePlayer>) => {
  const { core, renderer } = player

  renderer.config.merge(RENDERER_PRESET)
  const coreDefaults = core.config.current
  const rendererDefaults = renderer.config.current

  const saved = readRecord(readStorage(SETTINGS_KEY))
  const savedCore = readRecord(saved.core)

  core.config.merge({
    ...savedCore,
    driver: savedCore.driver === 'animation' || savedCore.driver === 'timer' ? savedCore.driver : undefined,
  } as CorePlayerConfig)
  renderer.config.merge(readRecord(saved.renderer) as DomRendererConfig)
  if (saved.autoResume === false) {
    renderer.config.merge({ modes: { list: { scroll: { resumeDelay: Infinity } } } })
  }

  const coreConfig = shallowRef(core.config.current)
  const rendererConfig = shallowRef(renderer.config.current)
  const storageAvailable = ref(true)
  const temporaryOffset = ref(0)

  const serializeRenderer = () => {
    const config = renderer.config.current
    const scroll = config.modes.list.scroll
    const autoResume = scroll.resumeDelay !== Infinity
    const serialized = {
      ...config,
      modes: {
        ...config.modes,
        list: {
          ...config.modes.list,
          scroll: { ...scroll, resumeDelay: autoResume ? scroll.resumeDelay : DEFAULT_RESUME_DELAY },
        },
      },
    }

    return { config: serialized, autoResume }
  }

  const persist = () => {
    const serialized = serializeRenderer()
    const settings = {
      core: pickOverrides(core.config.current, coreDefaults),
      renderer: pickOverrides(serialized.config, rendererDefaults),
      autoResume: serialized.autoResume,
    }
    const stored = writeStorage(SETTINGS_KEY, settings)

    storageAvailable.value = stored && storageAvailable.value
  }

  const handleCore: Parameters<typeof core.config.event.add<'update'>>[1] = () => {
    coreConfig.value = core.config.current
    persist()
  }

  const handleRenderer: Parameters<typeof renderer.config.event.add<'update'>>[1] = () => {
    rendererConfig.value = renderer.config.current
    persist()
  }

  const handleLyric = () => {
    if (core.config.current.offset.resetTempOnLyricChange) {
      temporaryOffset.value = 0
    }
  }

  /**
   * Resets the chosen scope in place and reapplies the playground's renderer preset.
   */
  const reset = (scope: 'core' | 'renderer') => {
    if (scope === 'core') {
      core.config.reset()
      core.updateTempOffset(0)
      temporaryOffset.value = 0
    } else {
      renderer.config.reset()
      renderer.config.merge(RENDERER_PRESET)
    }

    persist()
  }

  /**
   * Keeps song-specific offset controls consistent with the player's reset policy.
   */
  const setTemporaryOffset = (value: number) => {
    temporaryOffset.value = value
    core.updateTempOffset(value)
  }

  core.config.event.add('update', handleCore)
  renderer.config.event.add('update', handleRenderer)
  core.event.add('lyric-update', handleLyric)

  onScopeDispose(() => {
    core.config.event.remove('update', handleCore)
    renderer.config.event.remove('update', handleRenderer)
    core.event.remove('lyric-update', handleLyric)
  })

  return { coreConfig, rendererConfig, storageAvailable, temporaryOffset, reset, setTemporaryOffset }
}

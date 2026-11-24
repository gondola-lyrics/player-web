import type { CorePlayerConfig } from '@gondola-lyrics/player/core'
import type { DomRendererConfig } from '@gondola-lyrics/player/renderer'
import type { usePlayer } from './usePlayer'

import { onScopeDispose, ref, shallowRef } from 'vue'

import { readRecord, readStorage, writeStorage } from '../lib/storage'

export const RENDERER_PRESET: DomRendererConfig = {
  common: { line: { font: { size: 38, weight: 500 } } },
}

const SETTINGS_KEY = 'gondola-player-settings-v1'
const DEFAULT_RESUME_DELAY = 3000

const readRendererConfig = (value: unknown): DomRendererConfig => {
  const saved = readRecord(value)
  const modes = readRecord(saved.modes)
  const list = readRecord(modes.list)
  const line = readRecord(list.line)
  if (!Object.hasOwn(saved, 'line') && !Object.hasOwn(line, 'words')) {
    return saved as DomRendererConfig
  }

  const { line: legacy, ...renderer } = saved
  const legacyLine = readRecord(legacy)
  const { words: legacyWord, ...lineAppearance } = legacyLine
  const { words: previousWord, ...modeLine } = line
  const migratedLine = {
    ...lineAppearance,
    ...modeLine,
    font: { ...readRecord(legacyLine.font), ...readRecord(line.font) },
  }
  const migratedWord = {
    ...readRecord(legacyWord),
    ...readRecord(previousWord),
    ...readRecord(list.word),
  }

  return {
    ...renderer,
    modes: {
      ...modes,
      list: {
        ...list,
        line: migratedLine,
        word: migratedWord,
      },
    },
  } as DomRendererConfig
}

const pickOverrides = (current: object, defaults: object): Record<string, unknown> => {
  if (current === defaults) {
    return {}
  }

  const baseline = defaults as Record<string, unknown>
  const entries: [string, unknown][] = []

  for (const [key, value] of Object.entries(current)) {
    const defaultValue = baseline[key]
    if (Object.is(value, defaultValue)) {
      continue
    }
    if (value !== null && typeof value === 'object' && defaultValue !== null && typeof defaultValue === 'object') {
      const children = pickOverrides(value, defaultValue)
      if (Object.keys(children).length > 0) {
        entries.push([key, children])
      }
    } else {
      entries.push([key, value])
    }
  }

  return Object.fromEntries(entries)
}

/**
 * Persists configuration overrides separately from inherited appearance so reloads preserve mode preferences.
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
  renderer.config.merge(readRendererConfig(saved.renderer))
  if (saved.autoResume === false) {
    renderer.config.merge('modes.list.scroll.resumeDelay', Infinity)
  }

  const coreConfig = shallowRef(core.config.current)
  const rendererConfig = shallowRef(renderer.config.current)
  const storageAvailable = ref(true)
  const temporaryOffset = ref(0)

  const serializeRenderer = () => {
    const config = renderer.config.current
    const scroll = config.modes.list.scroll
    const autoResume = scroll.resumeDelay !== Infinity
    if (autoResume) {
      return { config, autoResume }
    }

    const serialized = {
      ...config,
      modes: {
        ...config.modes,
        list: {
          ...config.modes.list,
          scroll: { ...scroll, resumeDelay: DEFAULT_RESUME_DELAY },
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

import type { CorePlayerConfig } from '@gondola-lyrics/player/core'
import type { DomRenderer, DomRendererConfig } from '@gondola-lyrics/player/renderer'
import type { usePlayer } from './usePlayer'

import { onScopeDispose, ref, shallowRef } from 'vue'

import { readRecord, readStorage, writeStorage } from '../lib/storage'

export const RENDERER_PRESET: DomRendererConfig = {
  common: { content: { style: { font: { size: 38, weight: 500 } } } },
}

const SETTINGS_KEY = 'gondola-player-settings-v1'

const readLegacyContent = (line: unknown, word?: unknown) => {
  const appearance = readRecord(line)
  const enabled = readRecord(word).enabled ?? readRecord(appearance.words).enabled
  const unit = enabled ? 'word' : 'line'
  return {
    unit: typeof enabled === 'boolean' ? unit : undefined,
    style: { font: readRecord(appearance.font), states: readRecord(appearance.style) },
  } as const
}

const restoreRendererConfig = (config: DomRenderer['config'], saved: Record<string, unknown>) => {
  const renderer = readRecord(saved.renderer)
  const common = readRecord(renderer.common)
  const list = readRecord(readRecord(renderer.modes).list)
  const { resumeDelay } = readRecord(list.scroll)
  const { align, gap } = list

  // Earlier playgrounds kept list preferences at the root, before the separate mode and common overrides.
  config.merge('modes.list.content', readLegacyContent(renderer.line))
  config.merge({
    common: { content: readLegacyContent(common.line, common.word) },
    modes: {
      list: {
        content: readLegacyContent(list.line, list.word),
        layout: {
          gap: typeof gap === 'number' ? gap : undefined,
          align: align === 'left' || align === 'center' || align === 'right' ? align : undefined,
        },
        scroll: {
          resume: {
            enabled: saved.autoResume === false || resumeDelay === Infinity ? false : undefined,
            delay: typeof resumeDelay === 'number' && Number.isFinite(resumeDelay) ? resumeDelay : undefined,
          },
        },
      },
    },
  })
  config.merge(renderer as DomRendererConfig)
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
  restoreRendererConfig(renderer.config, saved)

  const coreConfig = shallowRef(core.config.current)
  const rendererConfig = shallowRef(renderer.config.current)
  const storageAvailable = ref(true)
  const temporaryOffset = ref(0)

  const persist = () => {
    const settings = {
      core: pickOverrides(core.config.current, coreDefaults),
      renderer: pickOverrides(renderer.config.current, rendererDefaults),
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

import type { Diagnostic } from '@gondola-lyrics/model/common'
import type { EnrichedLyric } from '@gondola-lyrics/model/enriched'
import type { LyricSource } from '../lib/parser'
import type { MessageKey } from '../locales/en-us'

import { TimingLevel } from '@gondola-lyrics/model/common'
import { EnrichedLyricStatus, makeEnrichedLyric } from '@gondola-lyrics/model/enriched'
import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'

import { CorePlayer } from '@gondola-lyrics/player/core'
import { DomRenderer } from '@gondola-lyrics/player/renderer'

import { parseSource, readLyricSource, readParserOptions } from '../lib/parser'
import { readRecord, readStorage, writeStorage } from '../lib/storage'
import { useAudio } from './useAudio'

const SOURCE_KEY = 'gondola-player-source-v1'

/**
 * Coordinates the lyric clock with actual media events while retaining the last successfully parsed source.
 */
export const usePlayer = () => {
  const media = useAudio()
  const core = new CorePlayer()
  const renderer = new DomRenderer(core)

  const saved = readRecord(readStorage(SOURCE_KEY))
  const savedSource = readLyricSource(saved.source)
  const source = shallowRef<LyricSource | null>(null)
  const lyric = shallowRef<EnrichedLyric>(core.currentInfo)
  const options = reactive(readParserOptions(saved.options))
  const diagnostics = shallowRef<Diagnostic[]>([])
  const error = ref<MessageKey | ''>('')
  const errorDetail = ref('')
  const storageAvailable = ref(true)
  const previewTime = ref<number | null>(null)
  const currentTime = computed(() => previewTime.value ?? media.state.currentTime)
  const draft = reactive(readLyricSource())

  let previewRevision = -1
  let revision = 0
  let disposed = false

  const synchronize = () => {
    if (disposed) {
      return
    }

    if (previewTime.value !== null) {
      core.pause()
      core.seek(previewTime.value)
    } else if (media.state.playing && !media.state.waiting && !media.state.seeking) {
      core.play(media.state.currentTime)
    } else {
      core.pause()
      core.seek(media.state.currentTime)
    }
  }

  const handleMediaTime = (time: number) => {
    if (previewTime.value !== null || disposed) {
      return
    }

    if (!core.currentPlaying || Math.abs(core.currentTime - time) > 120) {
      core.seek(time)
    }
  }

  const persist = () => {
    const preferences = { source: source.value, options: readParserOptions(options) }
    const stored = writeStorage(SOURCE_KEY, preferences)

    storageAvailable.value = stored && storageAvailable.value
  }

  /**
   * Leaves the active lyric untouched when parsing fails and resynchronizes successful changes to audio time.
   */
  const applySource = (input: LyricSource, save = true): boolean => {
    if (disposed) {
      return false
    }

    error.value = ''
    errorDetail.value = ''

    try {
      const normalized = readLyricSource(input)
      const parserOptions = readParserOptions(options)
      const parsed = parseSource(normalized, parserOptions)

      diagnostics.value = parsed.diagnostics
      if (parsed.lyric.status !== EnrichedLyricStatus.VALID) {
        error.value = 'lyric.error'
        return false
      }

      revision++
      previewTime.value = null
      if (input !== source.value) {
        source.value = normalized
      }

      core.updateLyric(parsed.lyric)
      lyric.value = core.currentInfo
      synchronize()
      if (save) {
        persist()
      }

      return true
    } catch (cause) {
      error.value = 'lyric.error'
      errorDetail.value = cause instanceof Error ? cause.message : String(cause)
      return false
    }
  }

  /**
   * Starts a preview transaction tied to the current audio and lyric revisions.
   */
  const beginPreview = () => {
    if (!disposed && media.state.hasAudio) {
      previewRevision = revision
      previewTime.value = media.state.currentTime
      core.pause()
    }
  }

  /**
   * Positions the paused lyric clock without seeking the audio during a drag.
   */
  const preview = (milliseconds: number) => {
    if (previewTime.value !== null && previewRevision === revision && Number.isFinite(milliseconds)) {
      previewTime.value = Math.min(media.state.duration, Math.max(0, milliseconds))
      core.seek(previewTime.value)
    }
  }

  /**
   * Cancels a drag without applying its position to media, including when the window loses its input stream.
   */
  const cancelPreview = () => {
    previewTime.value = null
    previewRevision = -1
    synchronize()
  }

  /**
   * Commits only a still-current preview; an unmounted slider cannot seek a replacement source.
   */
  const commitPreview = () => {
    if (disposed || previewTime.value === null || previewRevision !== revision) {
      return
    }

    const time = previewTime.value
    previewTime.value = null
    previewRevision = -1

    media.seek(time)
    synchronize()
  }

  /**
   * Commits keyboard or line-click positioning immediately while preserving the media's playback state.
   */
  const seek = (milliseconds: number) => {
    previewTime.value = null
    previewRevision = -1

    media.seek(milliseconds)
    synchronize()
  }

  /**
   * Supersedes a pending slider drag before switching audio resources.
   */
  const setAudioFile = async (file: File): Promise<boolean> => {
    revision++
    cancelPreview()

    return await media.setFile(file, file.name)
  }

  /**
   * Clears stored audio and ends any lyric preview of the removed file.
   */
  const clearAudio = () => {
    revision++
    cancelPreview()

    media.clear()
    synchronize()
  }

  /**
   * Retains audio playback while clearing the lyric and its persisted source.
   */
  const clearLyric = () => {
    revision++
    cancelPreview()

    source.value = null
    Object.assign(draft, readLyricSource())
    diagnostics.value = []
    error.value = ''
    errorDetail.value = ''

    const empty = makeEnrichedLyric({ status: EnrichedLyricStatus.VALID, timing: TimingLevel.NONE })
    core.updateLyric(empty)
    lyric.value = core.currentInfo
    synchronize()
    persist()
  }

  const handleLineClick: Parameters<typeof renderer.event.add<'line-click'>>[1] = (line) => {
    if (line.time && media.state.hasAudio) {
      seek(core.convertContentTime(line.time.start))
    }
  }

  watch(() => [media.state.playing, media.state.waiting, media.state.seeking, media.element.value], synchronize)
  watch(() => media.state.currentTime, handleMediaTime)
  watch(source, (value) => {
    Object.assign(draft, readLyricSource(value))
  })

  renderer.event.add('line-click', handleLineClick)
  watch(
    options,
    () => {
      if (source.value) {
        applySource(source.value)
      } else {
        persist()
      }
    },
    { deep: true },
  )

  if (savedSource.text.trim()) {
    applySource(savedSource, false)
  }
  Object.assign(draft, readLyricSource(source.value))

  window.addEventListener('blur', cancelPreview)
  window.addEventListener('touchcancel', cancelPreview, true)

  onScopeDispose(() => {
    disposed = true
    previewTime.value = null
    window.removeEventListener('blur', cancelPreview)
    window.removeEventListener('touchcancel', cancelPreview, true)
    renderer.event.remove('line-click', handleLineClick)
    renderer.dispose()
    core.dispose()
  })

  return {
    core,
    renderer,
    media,
    source,
    draft,
    lyric,
    options,
    diagnostics,
    error,
    errorDetail,
    storageAvailable,
    currentTime,
    previewTime,
    applySource,
    beginPreview,
    preview,
    commitPreview,
    cancelPreview,
    seek,
    setAudioFile,
    clearAudio,
    clearLyric,
  }
}

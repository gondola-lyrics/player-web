import type { MessageKey } from '../locales/en-us'

import { onMounted, onScopeDispose, reactive, shallowRef } from 'vue'

import { loadAudio, readRecord, readStorage, saveAudio, writeStorage } from '../lib/storage'

const VOLUME_KEY = 'gondola-player-volume-v1'
const LOAD_TIMEOUT = 20000

/**
 * Owns media resources and publishes actual audio state instead of assuming a play request succeeds.
 */
export const useAudio = () => {
  const saved = readRecord(readStorage(VOLUME_KEY))
  const element = shallowRef(new Audio())
  const state = reactive({
    name: '',
    hasAudio: false,
    loading: false,
    restoring: false,
    playing: false,
    waiting: false,
    seeking: false,
    currentTime: 0,
    duration: 0,
    volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 0.8,
    muted: saved.muted === true,
    error: '' as MessageKey | '',
    storageAvailable: true,
  })

  let objectUrl = ''
  let frame: number | null = null
  let revision = 0
  let playRevision = 0
  let disposed = false
  let cancelLoad: (() => void) | null = null
  let mediaWrites = Promise.resolve()

  element.value.volume = state.volume
  element.value.muted = state.muted

  const updateTime = () => {
    state.currentTime = Number.isFinite(element.value.currentTime) ? element.value.currentTime * 1000 : 0
  }

  const stopFrame = () => {
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
  }

  const tick = () => {
    frame = null
    if (disposed || !state.playing || state.waiting) {
      return
    }

    updateTime()
    frame = requestAnimationFrame(tick)
  }

  const handlePlaying = () => {
    state.playing = true
    state.waiting = false
    state.error = ''

    updateTime()
    stopFrame()
    tick()
  }

  const handlePause = () => {
    state.playing = false
    state.waiting = false

    updateTime()
    stopFrame()
  }

  const handleWaiting = () => {
    state.waiting = !element.value.paused
    updateTime()
    stopFrame()
  }

  const handleSeeking = () => {
    state.seeking = true
    updateTime()
  }

  const handleSeeked = () => {
    state.seeking = false
    updateTime()

    if (!element.value.paused && element.value.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA && !element.value.error) {
      handlePlaying()
    }
  }

  const handleDuration = () => {
    state.duration = Number.isFinite(element.value.duration) ? Math.max(0, element.value.duration * 1000) : 0
  }

  const handleError = () => {
    if (state.hasAudio) {
      state.error = 'audio.loadError'
      handlePause()
    }
  }

  const handleCanPlay = () => {
    if (state.waiting && !element.value.paused && !element.value.seeking && !element.value.error) {
      handlePlaying()
    }
  }

  const listeners = {
    playing: handlePlaying,
    pause: handlePause,
    ended: handlePause,
    waiting: handleWaiting,
    canplay: handleCanPlay,
    seeking: handleSeeking,
    seeked: handleSeeked,
    timeupdate: updateTime,
    durationchange: handleDuration,
    error: handleError,
  }

  const bind = (audio: HTMLAudioElement, add: boolean) => {
    for (const [event, listener] of Object.entries(listeners)) {
      if (add) {
        audio.addEventListener(event, listener)
      } else {
        audio.removeEventListener(event, listener)
      }
    }
  }

  const release = (audio: HTMLAudioElement, url: string) => {
    audio.pause()
    audio.removeAttribute('src')
    audio.load()

    if (url) {
      URL.revokeObjectURL(url)
    }
  }

  const queueSave = (audio: Parameters<typeof saveAudio>[0]) => {
    mediaWrites = mediaWrites.then(async () => {
      try {
        await saveAudio(audio)
      } catch {
        if (!disposed) {
          state.storageAvailable = false
        }
      }
    })
  }

  const persistVolume = () => {
    const preferences = { volume: state.volume, muted: state.muted }
    const stored = writeStorage(VOLUME_KEY, preferences)

    state.storageAvailable = stored && state.storageAvailable
  }

  const waitForMetadata = (audio: HTMLAudioElement, url: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const finish = (success: boolean) => {
        clearTimeout(timer)
        audio.removeEventListener('loadedmetadata', loaded)
        audio.removeEventListener('error', failed)

        if (cancelLoad === cancel) {
          cancelLoad = null
        }
        if (!success) {
          release(audio, url)
        }

        resolve(success)
      }

      const loaded = () => {
        finish(Number.isFinite(audio.duration) && audio.duration > 0)
      }

      const failed = () => {
        finish(false)
      }

      const cancel = () => {
        finish(false)
      }

      const timer = setTimeout(failed, LOAD_TIMEOUT)
      cancelLoad = cancel
      audio.addEventListener('loadedmetadata', loaded)
      audio.addEventListener('error', failed)
      audio.src = url
      audio.load()
    })
  }

  const commitAudio = (audio: HTMLAudioElement, url: string, name: string) => {
    playRevision++
    stopFrame()
    bind(element.value, false)
    release(element.value, objectUrl)

    audio.volume = state.volume
    audio.muted = state.muted
    element.value = audio
    objectUrl = url

    state.name = name
    state.hasAudio = true
    state.playing = false
    state.waiting = false
    state.seeking = false
    state.currentTime = 0

    handleDuration()
    bind(audio, true)
  }

  /**
   * Keeps the current media intact until replacement metadata is readable, and discards superseded loads.
   */
  const setFile = async (file: Blob, name: string, persist = true): Promise<boolean> => {
    if (disposed) {
      return false
    }

    cancelLoad?.()
    const expected = ++revision
    state.loading = true
    state.error = ''

    const audio = new Audio()
    const url = URL.createObjectURL(file)
    audio.preload = 'auto'
    audio.volume = state.volume
    audio.muted = state.muted
    const readable = await waitForMetadata(audio, url)

    if (disposed || expected !== revision) {
      if (readable) {
        release(audio, url)
      }
      return false
    }

    state.loading = false
    if (!readable) {
      state.error = 'audio.loadError'
      return false
    }

    commitAudio(audio, url, name)
    if (persist) {
      queueSave({ file, name })
    }

    return true
  }

  /**
   * Resolves autoplay rejection without starting a lyric clock ahead of the media.
   */
  const play = async () => {
    if (disposed || !state.hasAudio || state.loading) {
      return
    }

    const expected = ++playRevision
    const audio = element.value
    state.error = ''

    try {
      await audio.play()
    } catch {
      if (!disposed && expected === playRevision && audio === element.value) {
        state.error = 'audio.playError'
        handlePause()
      }
    }
  }

  /**
   * Invalidates a pending play request when the user pauses before it settles.
   */
  const pause = () => {
    playRevision++
    element.value.pause()
    handlePause()
  }

  /**
   * Uses milliseconds at the public boundary and lets media seek events confirm the new position.
   */
  const seek = (milliseconds: number) => {
    if (disposed || !state.hasAudio || !Number.isFinite(milliseconds)) {
      return
    }

    element.value.currentTime = Math.min(state.duration, Math.max(0, milliseconds)) / 1000
    updateTime()
  }

  /**
   * Saves only finite volume preferences; muting retains the previous audible level.
   */
  const setVolume = (value: number) => {
    if (disposed || !Number.isFinite(value)) {
      return
    }

    state.volume = Math.min(1, Math.max(0, value))
    state.muted = state.volume === 0
    element.value.volume = state.volume
    element.value.muted = state.muted

    persistVolume()
  }

  /**
   * Restores an audible level even when the volume was explicitly reduced to zero.
   */
  const toggleMute = () => {
    if (disposed) {
      return
    }

    state.muted = !state.muted
    if (!state.muted && state.volume === 0) {
      state.volume = 0.8
    }

    element.value.volume = state.volume
    element.value.muted = state.muted

    persistVolume()
  }

  /**
   * Removes the active file and supersedes pending restoration or replacement work.
   */
  const clear = () => {
    if (disposed) {
      return
    }

    revision++
    cancelLoad?.()
    pause()
    bind(element.value, false)
    release(element.value, objectUrl)

    objectUrl = ''
    state.name = ''
    state.hasAudio = false
    state.loading = false
    state.duration = 0
    state.currentTime = 0
    state.waiting = false
    state.seeking = false
    state.error = ''

    queueSave(null)
  }

  bind(element.value, true)

  onMounted(async () => {
    const expected = revision
    state.restoring = true

    try {
      const audio = await loadAudio()
      if (!disposed && expected === revision && audio) {
        await setFile(audio.file, audio.name, false)
      }
    } catch {
      if (!disposed) {
        state.storageAvailable = false
      }
    } finally {
      if (!disposed) {
        state.restoring = false
      }
    }
  })

  onScopeDispose(() => {
    disposed = true
    revision++
    playRevision++
    cancelLoad?.()
    stopFrame()
    bind(element.value, false)
    release(element.value, objectUrl)
  })

  return { element, state, setFile, play, pause, seek, setVolume, toggleMute, clear }
}

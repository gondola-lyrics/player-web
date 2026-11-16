<script setup lang="ts">
import type { useI18n } from '../composables/useI18n'
import type { usePlayer } from '../composables/usePlayer'

import { NButton, NSlider, NTooltip } from 'naive-ui'
import { computed, onScopeDispose, ref } from 'vue'

import { formatTime } from '../lib/format'

const props = defineProps<{ player: ReturnType<typeof usePlayer>; i18n: ReturnType<typeof useI18n>; panelOpen: boolean }>()
defineEmits<{ togglePanel: [] }>()
const progress = computed(() => props.player.currentTime.value)
const label = computed(() => props.i18n.t(props.player.media.state.playing ? 'controls.pause' : 'controls.play'))
const dragging = ref(false)
const beginDrag = () => {
  dragging.value = true
  props.player.beginPreview()
}
const endDrag = () => {
  dragging.value = false
  props.player.commitPreview()
}
const cancelDrag = () => {
  props.player.cancelPreview()
}
window.addEventListener('blur', cancelDrag)
window.addEventListener('touchcancel', cancelDrag, true)
onScopeDispose(() => {
  cancelDrag()
  window.removeEventListener('blur', cancelDrag)
  window.removeEventListener('touchcancel', cancelDrag, true)
})
const toggle = () => {
  if (props.player.media.state.playing) {
    props.player.media.pause()
  } else {
    void props.player.media.play()
  }
}
const updateProgress = (value: number) => {
  if (dragging.value) {
    props.player.preview(value)
  } else {
    props.player.seek(value)
  }
}
</script>

<template>
  <footer class="playback-controls">
    <NButton
      text
      :type="panelOpen ? 'primary' : 'default'"
      circle
      size="small"
      data-testid="open-panel"
      class="panel-toggle"
      :aria-label="i18n.t('app.panel')"
      :aria-expanded="panelOpen"
      aria-controls="player-sidebar"
      @click="$emit('togglePanel')"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </NButton>
    <NTooltip>
      <template #trigger>
        <NButton
          text
          type="primary"
          circle
          size="small"
          class="play-button"
          data-testid="play"
          :aria-label="label"
          :disabled="!player.media.state.hasAudio || player.media.state.loading"
          @click="toggle"
        >
          <svg v-if="!player.media.state.playing" viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        </NButton>
      </template>
      {{ label }}
    </NTooltip>
    <div class="progress-row">
      <NSlider
        class="progress-slider"
        data-testid="progress"
        :value="progress"
        :min="0"
        :max="player.media.state.duration || 1"
        :step="100"
        :disabled="!player.media.state.hasAudio || player.media.state.loading"
        :format-tooltip="formatTime"
        :aria-label="i18n.t('controls.progress')"
        @dragstart="beginDrag"
        @dragend="endDrag"
        @update:value="updateProgress"
      />
    </div>
    <span class="time-display">{{ formatTime(progress) }} / {{ formatTime(player.media.state.duration) }}</span>
    <div class="volume-controls">
      <span v-if="player.media.state.waiting" class="buffering">{{ i18n.t('controls.waiting') }}</span>
      <NButton
        quaternary
        circle
        :aria-label="i18n.t(player.media.state.muted ? 'controls.unmute' : 'controls.mute')"
        @click="player.media.toggleMute"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4z" />
          <path v-if="!player.media.state.muted" d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
          <path v-else d="m16 9 5 6m0-6-5 6" />
        </svg>
      </NButton>
      <NSlider
        class="volume-slider"
        :value="player.media.state.muted ? 0 : player.media.state.volume * 100"
        :min="0"
        :max="100"
        :step="1"
        :aria-label="i18n.t('controls.volume')"
        @update:value="player.media.setVolume($event / 100)"
      />
    </div>
  </footer>
</template>

<style scoped lang="scss">
.playback-controls {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
}

.panel-toggle,
.play-button {
  width: 28px;
  height: 28px;
}

.progress-row,
.volume-controls {
  display: flex;
  align-items: center;
}

.progress-row {
  flex: 1;
  min-width: 0;
  gap: 10px;
}

.progress-slider {
  flex: 1;
  min-width: 0;
}

.time-display {
  min-width: 32px;
  color: var(--muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.volume-controls {
  flex: none;
  gap: 8px;
}

.volume-slider {
  width: 96px;
}

.buffering {
  color: var(--muted);
  font-size: 10px;
}

@media (max-width: 640px) {
  .playback-controls {
    gap: 8px;
    padding: 0 12px;
  }

  .volume-slider,
  .time-display,
  .buffering {
    display: none;
  }
}
</style>

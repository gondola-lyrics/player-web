<script setup lang="ts">
import type { UploadOnChange } from 'naive-ui'
import type { useI18n } from '../../composables/useI18n'
import type { usePlayer } from '../../composables/usePlayer'

import { NAlert, NButton, NSpin, NUpload, NUploadDragger } from 'naive-ui'

import { formatTime } from '../../lib/format'

const props = defineProps<{ player: ReturnType<typeof usePlayer>; i18n: ReturnType<typeof useI18n> }>()

const handleFile: UploadOnChange = ({ file }) => {
  if (file.status === 'pending' && file.file) {
    void props.player.setAudioFile(file.file)
  }
}
</script>

<template>
  <section>
    <div class="panel-stack">
      <NUpload
        accept="audio/*"
        :default-upload="false"
        :file-list="[]"
        :show-file-list="false"
        :multiple="false"
        data-testid="audio-file"
        @change="handleFile"
      >
        <NUploadDragger>
          <div>{{ i18n.t('audio.drop') }}</div>
        </NUploadDragger>
      </NUpload>
      <NSpin v-if="player.media.state.loading || player.media.state.restoring" size="small">
        <p class="panel-hint">{{ i18n.t(player.media.state.restoring ? 'audio.restore' : 'audio.loading') }}</p>
      </NSpin>
      <NAlert v-if="player.media.state.error" type="error" :show-icon="false">
        {{ i18n.t(player.media.state.error) }}
      </NAlert>
      <NAlert v-if="!player.media.state.storageAvailable" type="warning" :show-icon="false">
        {{ i18n.t('audio.saveError') }}
      </NAlert>
      <div v-if="player.media.state.hasAudio" class="loaded-file">
        <strong :title="player.media.state.name">{{ player.media.state.name }}</strong>
        <span>{{ i18n.t('audio.duration') }} · {{ formatTime(player.media.state.duration) }}</span>
        <NButton size="small" secondary @click="player.clearAudio">{{ i18n.t('audio.remove') }}</NButton>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.loaded-file {
  display: flex;
  flex-direction: column;
  align-items: start;
  gap: 10px;
  padding: 8px 0;

  strong {
    max-width: 100%;
    overflow: hidden;
    font-size: 13px;
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    color: var(--muted, #6b8396);
    font-size: 12px;
  }
}
</style>

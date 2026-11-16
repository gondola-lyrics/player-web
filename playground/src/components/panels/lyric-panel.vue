<script setup lang="ts">
import type { LyricFormat } from '@gondola-lyrics/kit/parser'
import type { UploadOnChange } from 'naive-ui'
import type { useI18n } from '../../composables/useI18n'
import type { usePlayer } from '../../composables/usePlayer'

import { detectFormat } from '@gondola-lyrics/kit/parser'
import { NAlert, NButton, NCollapse, NCollapseItem, NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch, NUpload, useMessage } from 'naive-ui'
import { computed, onScopeDispose, ref, toRefs } from 'vue'

import { LYRIC_FORMATS, hasAnnotationTracks } from '../../lib/parser'

const props = defineProps<{ player: ReturnType<typeof usePlayer>; i18n: ReturnType<typeof useI18n> }>()
const message = useMessage()
const { format, text, name, translations, romans } = toRefs(props.player.draft)
const annotationTracks = computed(() => hasAnnotationTracks(format.value))
const fileError = ref(false)
let readRevision = 0
onScopeDispose(() => {
  readRevision++
})
const formatOptions = LYRIC_FORMATS.map((format) => ({ label: format.toUpperCase(), value: format }))
const selectFormat = (value: LyricFormat) => {
  format.value = value
}
const handleFile: UploadOnChange = ({ file }) => {
  if (file.status !== 'pending' || !file.file) {
    return
  }
  const expected = ++readRevision
  fileError.value = false
  void file.file
    .text()
    .then((content) => {
      if (expected !== readRevision) {
        return
      }
      const extension = file.name.split('.').at(-1)?.toLowerCase()
      format.value = LYRIC_FORMATS.find((format) => format === extension) ?? detectFormat(content) ?? format.value
      text.value = content
      name.value = file.name
    })
    .catch(() => {
      if (expected === readRevision) {
        fileError.value = true
      }
    })
}
const apply = () => {
  readRevision++
  if (props.player.applySource({ ...props.player.draft })) {
    message.success(props.i18n.t('lyric.applied'))
  }
}
const clear = () => {
  readRevision++
  fileError.value = false
  props.player.clearLyric()
}
const updateIntro = (value: number | null) => {
  if (value !== null && Number.isSafeInteger(value)) {
    props.player.options.instrumental.minIntroDuration = value
  }
}
const updateGap = (value: number | null) => {
  if (value !== null && Number.isSafeInteger(value)) {
    props.player.options.instrumental.minDuration = value
  }
}
</script>

<template>
  <section class="lyric-panel">
    <NForm label-placement="top" size="small">
      <NFormItem :label="i18n.t('lyric.format')">
        <NSelect :value="format" :options="formatOptions" data-testid="lyric-format" @update:value="selectFormat" />
      </NFormItem>
      <NFormItem :label="i18n.t('lyric.source')">
        <NInput
          v-model:value="text"
          type="textarea"
          :autosize="{ minRows: 9, maxRows: 15 }"
          placeholder=""
          :input-props="{ spellcheck: false, 'aria-label': i18n.t('lyric.source') }"
          data-testid="lyric-source"
          class="source-editor"
        />
      </NFormItem>
      <div v-if="annotationTracks" class="annotation-tracks">
        <NFormItem :label="i18n.t('lyric.translations')">
          <NInput
            v-model:value="translations"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder=""
            :input-props="{ spellcheck: false, 'aria-label': i18n.t('lyric.translations') }"
            data-testid="lyric-translations"
            class="source-editor"
          />
        </NFormItem>
        <NFormItem :label="i18n.t('lyric.romans')">
          <NInput
            v-model:value="romans"
            type="textarea"
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder=""
            :input-props="{ spellcheck: false, 'aria-label': i18n.t('lyric.romans') }"
            data-testid="lyric-romans"
            class="source-editor"
          />
        </NFormItem>
      </div>
    </NForm>
    <div class="panel-stack">
      <div class="panel-row">
        <NUpload
          :default-upload="false"
          :file-list="[]"
          :show-file-list="false"
          :multiple="false"
          accept=".lrc,.qrc,.yrc,.krc,.kwrc,.ttml,.xml,.txt"
          data-testid="lyric-file"
          @change="handleFile"
        >
          <NButton size="small" secondary>{{ i18n.t('lyric.file') }}</NButton>
        </NUpload>
        <span class="source-name" :title="name">{{ name }}</span>
      </div>
      <NAlert v-if="fileError" type="error" :show-icon="false">{{ i18n.t('lyric.fileError') }}</NAlert>
      <NAlert v-if="player.error.value" type="error" :show-icon="false">
        {{ i18n.t(player.error.value) }}
        <div v-if="player.errorDetail.value" class="field-hint">{{ player.errorDetail.value }}</div>
      </NAlert>
      <NAlert v-if="player.diagnostics.value.length" type="warning" :show-icon="false">
        {{ i18n.t('lyric.diagnostics', { count: player.diagnostics.value.length }) }}
        <NCollapse class="diagnostic-list">
          <NCollapseItem :title="'Diagnostics'" name="diagnostics">
            <div v-for="(diagnostic, index) in player.diagnostics.value" :key="index">
              <code>{{ diagnostic.path }} · {{ diagnostic.code }}</code>
            </div>
          </NCollapseItem>
        </NCollapse>
      </NAlert>
      <div class="panel-row">
        <NButton size="small" secondary data-testid="clear-lyric" @click="clear">{{ i18n.t('lyric.clear') }}</NButton>
        <NButton size="small" type="primary" data-testid="apply-lyric" @click="apply">{{ i18n.t('lyric.apply') }}</NButton>
      </div>
    </div>
    <section class="panel-section">
      <h2 class="panel-heading">{{ i18n.t('parser.title') }}</h2>
      <NForm label-placement="left" label-width="auto" size="small">
        <NFormItem v-if="format === 'ttml'" :label="i18n.t('parser.language')">
          <div>
            <NInput :value="player.options.language" placeholder="en" @update:value="player.options.language = $event" />
            <div class="field-hint">{{ i18n.t('parser.languageHint') }}</div>
          </div>
        </NFormItem>
        <NFormItem :label="i18n.t('parser.background')"
          ><NSwitch :value="player.options.extractBackgrounds" @update:value="player.options.extractBackgrounds = $event"
        /></NFormItem>
        <NFormItem :label="i18n.t('parser.brackets')"
          ><NSwitch :value="player.options.stripBrackets" @update:value="player.options.stripBrackets = $event"
        /></NFormItem>
        <NFormItem :label="i18n.t('parser.spaces')"
          ><NSwitch :value="player.options.insertSpaces" @update:value="player.options.insertSpaces = $event"
        /></NFormItem>
        <NFormItem :label="i18n.t('parser.instrumental')"
          ><NSwitch :value="player.options.instrumental.enabled" @update:value="player.options.instrumental.enabled = $event"
        /></NFormItem>
        <template v-if="player.options.instrumental.enabled">
          <NFormItem :label="i18n.t('parser.intro')"
            ><NInputNumber
              :value="player.options.instrumental.minIntroDuration"
              :min="0"
              :max="2147483647"
              :step="500"
              :precision="0"
              @update:value="updateIntro"
          /></NFormItem>
          <NFormItem :label="i18n.t('parser.gap')"
            ><NInputNumber
              :value="player.options.instrumental.minDuration"
              :min="0"
              :max="2147483647"
              :step="500"
              :precision="0"
              @update:value="updateGap"
          /></NFormItem>
        </template>
      </NForm>
    </section>
  </section>
</template>

<style scoped lang="scss">
.lyric-panel {
  container-type: inline-size;
}

.annotation-tracks {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0 14px;
}

@container (min-width: 480px) {
  .annotation-tracks {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.source-editor :deep(textarea) {
  font-family: 'MiSans', sans-serif;
  font-size: 12px;
  line-height: 1.8;
}

.source-name {
  max-width: 140px;
  overflow: hidden;
  color: var(--muted, #6b8396);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diagnostic-list {
  margin-top: 8px;

  code {
    overflow-wrap: anywhere;
    font-size: 10px;
  }
}
</style>

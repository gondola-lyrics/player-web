<script setup lang="ts">
import type { useI18n } from '../../composables/useI18n'
import type { usePlayer } from '../../composables/usePlayer'
import type { useSettings } from '../../composables/useSettings'

import { NButton, NCollapse, NCollapseItem, NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{
  player: ReturnType<typeof usePlayer>
  settings: ReturnType<typeof useSettings>
  i18n: ReturnType<typeof useI18n>
}>()
const core = computed(() => props.settings.coreConfig.value)
const list = computed(() => props.settings.rendererConfig.value.modes.list)
const autoResume = computed(() => list.value.scroll.resumeDelay !== Infinity)
const listConfig = computed(() => props.player.renderer.config.scope('modes.list'))
const lineConfig = computed(() => listConfig.value.scope('line'))
const scrollConfig = computed(() => listConfig.value.scope('scroll'))

const drivers = computed(() => {
  return [
    { value: 'animation', label: props.i18n.t('settings.animation') },
    { value: 'timer', label: props.i18n.t('settings.timer') },
  ]
})

const aligns = computed(() => {
  return [
    { value: 'left', label: props.i18n.t('settings.left') },
    { value: 'center', label: props.i18n.t('settings.center') },
    { value: 'right', label: props.i18n.t('settings.right') },
  ]
})

const isFiniteNumber = (value: number | null): value is number => {
  return value !== null && Number.isFinite(value)
}

const updateDriver = (value: unknown) => {
  if (value === 'animation' || value === 'timer') {
    props.player.core.config.merge('driver', value)
  }
}

const updateBridge = (value: boolean) => {
  props.player.core.config.merge('bridgeActive', value)
}

const updateMergeWindow = (value: number | null) => {
  if (isFiniteNumber(value)) {
    props.player.core.config.merge('mergeWindow', value)
  }
}

const updateMergeLimit = (value: number | null) => {
  if (isFiniteNumber(value)) {
    props.player.core.config.merge('mergeLimit', value)
  }
}

const updateGlobalOffset = (value: number | null) => {
  if (isFiniteNumber(value)) {
    props.player.core.config.merge('offset.global', value)
  }
}

const updateMetadataOffset = (value: boolean) => {
  props.player.core.config.merge('offset.useMeta', value)
}

const updateResetTemporaryOffset = (value: boolean) => {
  props.player.core.config.merge('offset.resetTempOnLyricChange', value)
}

const updateTemporaryOffset = (value: number | null) => {
  if (isFiniteNumber(value)) {
    props.settings.setTemporaryOffset(value)
  }
}

const updateFontSize = (value: number | null) => {
  if (isFiniteNumber(value)) {
    lineConfig.value.merge('font.size', value)
  }
}

const updateFontWeight = (value: number | null) => {
  if (isFiniteNumber(value)) {
    lineConfig.value.merge('font.weight', value)
  }
}

const updateFontFamily = (value: string) => {
  lineConfig.value.merge('font.family', value)
}

const updateWordHighlight = (value: boolean) => {
  listConfig.value.merge('word.enabled', value)
}

const updateGap = (value: number | null) => {
  if (isFiniteNumber(value)) {
    listConfig.value.merge('gap', value)
  }
}

const updateAlignment = (value: unknown) => {
  if (value === 'left' || value === 'center' || value === 'right') {
    listConfig.value.merge('align', value)
  }
}

const updateFollow = (value: boolean) => {
  scrollConfig.value.merge('follow', value)
}

const updateAnchor = (value: number | null) => {
  if (isFiniteNumber(value)) {
    scrollConfig.value.merge('anchor', value)
  }
}

const updateAutoResume = (value: boolean) => {
  const resumeDelay = value ? 3000 : Infinity

  scrollConfig.value.merge('resumeDelay', resumeDelay)
}

const updateResumeDelay = (value: number | null) => {
  if (isFiniteNumber(value)) {
    scrollConfig.value.merge('resumeDelay', value)
  }
}
</script>

<template>
  <NCollapse :default-expanded-names="['core', 'renderer']">
    <NCollapseItem name="core" :title="i18n.t('settings.core')">
      <NForm label-placement="top" size="small">
        <NFormItem :label="i18n.t('settings.driver')">
          <NSelect :value="core.driver" :options="drivers" @update:value="updateDriver" />
        </NFormItem>
        <NFormItem :label="i18n.t('settings.bridge')">
          <NSwitch :value="core.bridgeActive" @update:value="updateBridge" />
        </NFormItem>
        <div class="field-pair">
          <NFormItem :label="i18n.t('settings.mergeWindow')">
            <NInputNumber :value="core.mergeWindow" :min="0" :step="50" @update:value="updateMergeWindow" />
          </NFormItem>
          <NFormItem :label="i18n.t('settings.mergeLimit')">
            <NInputNumber :value="core.mergeLimit" :min="0" :precision="0" @update:value="updateMergeLimit" />
          </NFormItem>
        </div>
        <NFormItem :label="i18n.t('settings.offset')">
          <div class="full-width">
            <NInputNumber :value="core.offset.global" :step="50" :precision="0" @update:value="updateGlobalOffset" />
            <div class="field-hint">{{ i18n.t('settings.offsetHint') }}</div>
          </div>
        </NFormItem>
        <NFormItem :label="i18n.t('settings.meta')">
          <NSwitch :value="core.offset.useMeta" @update:value="updateMetadataOffset" />
        </NFormItem>
        <NFormItem :label="i18n.t('settings.resetTemp')">
          <NSwitch :value="core.offset.resetTempOnLyricChange" @update:value="updateResetTemporaryOffset" />
        </NFormItem>
        <NFormItem :label="i18n.t('settings.temp')">
          <NInputNumber :value="settings.temporaryOffset.value" :step="50" :precision="0" @update:value="updateTemporaryOffset" />
        </NFormItem>
        <NButton size="small" secondary data-testid="reset-core" @click="settings.reset('core')">
          {{ i18n.t('settings.reset') }}
        </NButton>
      </NForm>
    </NCollapseItem>
    <NCollapseItem name="renderer" :title="i18n.t('settings.renderer')">
      <NForm label-placement="top" size="small">
        <div class="field-pair">
          <NFormItem :label="i18n.t('settings.fontSize')">
            <NInputNumber :value="list.line.font.size" :min="1" :max="160" data-testid="font-size" @update:value="updateFontSize" />
          </NFormItem>
          <NFormItem :label="i18n.t('settings.fontWeight')">
            <NInputNumber :value="list.line.font.weight" :min="1" :max="1000" :step="100" @update:value="updateFontWeight" />
          </NFormItem>
        </div>
        <NFormItem :label="i18n.t('settings.fontFamily')">
          <NInput :value="list.line.font.family" :placeholder="i18n.t('settings.fontFamilyHint')" @update:value="updateFontFamily" />
        </NFormItem>
        <NFormItem :label="i18n.t('settings.wordHighlight')">
          <NSwitch :value="list.word.enabled" :aria-label="i18n.t('settings.wordHighlight')" @update:value="updateWordHighlight" />
        </NFormItem>
        <div class="field-pair">
          <NFormItem :label="i18n.t('settings.gap')">
            <NInputNumber :value="list.gap" :min="0" :max="300" @update:value="updateGap" />
          </NFormItem>
          <NFormItem :label="i18n.t('settings.align')">
            <NSelect :value="list.align" :options="aligns" @update:value="updateAlignment" />
          </NFormItem>
        </div>
        <NFormItem :label="i18n.t('settings.follow')">
          <NSwitch :value="list.scroll.follow" @update:value="updateFollow" />
        </NFormItem>
        <NFormItem :label="i18n.t('settings.anchor')">
          <NInputNumber :value="list.scroll.anchor" :min="0" :max="100" @update:value="updateAnchor" />
        </NFormItem>
        <NFormItem :label="i18n.t('settings.autoResume')">
          <NSwitch :value="autoResume" @update:value="updateAutoResume" />
        </NFormItem>
        <NFormItem v-if="autoResume" :label="i18n.t('settings.resumeDelay')">
          <NInputNumber :value="list.scroll.resumeDelay" :min="0" :step="250" @update:value="updateResumeDelay" />
        </NFormItem>
        <div class="field-hint reset-hint">{{ i18n.t('settings.resumeHint') }}</div>
        <NButton size="small" secondary data-testid="reset-renderer" @click="settings.reset('renderer')">
          {{ i18n.t('settings.reset') }}
        </NButton>
      </NForm>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped lang="scss">
.field-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.full-width {
  width: 100%;
}

.reset-hint {
  margin: 0 0 14px;
}
</style>

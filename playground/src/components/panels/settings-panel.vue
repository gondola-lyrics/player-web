<script setup lang="ts">
import type { CorePlayerConfig } from '@gondola-lyrics/player/core'
import type { DomRendererConfig } from '@gondola-lyrics/player/renderer'
import type { useI18n } from '../../composables/useI18n'
import type { usePlayer } from '../../composables/usePlayer'
import type { useSettings } from '../../composables/useSettings'

import { NButton, NCollapse, NCollapseItem, NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ player: ReturnType<typeof usePlayer>; settings: ReturnType<typeof useSettings>; i18n: ReturnType<typeof useI18n> }>()
const core = computed(() => props.settings.coreConfig.value)
const renderer = computed(() => props.settings.rendererConfig.value)
const drivers = computed(() => [
  { value: 'animation', label: props.i18n.t('settings.animation') },
  { value: 'timer', label: props.i18n.t('settings.timer') },
])
const aligns = computed(() => [
  { value: 'left', label: props.i18n.t('settings.left') },
  { value: 'center', label: props.i18n.t('settings.center') },
  { value: 'right', label: props.i18n.t('settings.right') },
])
const corePatch = (value: CorePlayerConfig) => {
  props.player.core.config.merge(value)
}
const rendererPatch = (value: DomRendererConfig) => {
  props.player.renderer.config.merge(value)
}
const number = (value: number | null, apply: (value: number) => void) => {
  if (value !== null && Number.isFinite(value)) {
    apply(value)
  }
}
</script>

<template>
  <NCollapse :default-expanded-names="['core', 'renderer']">
    <NCollapseItem name="core" :title="i18n.t('settings.core')">
      <NForm label-placement="top" size="small">
        <NFormItem :label="i18n.t('settings.driver')"
          ><NSelect :value="core.driver" :options="drivers" @update:value="corePatch({ driver: $event as CorePlayerConfig['driver'] })"
        /></NFormItem>
        <NFormItem :label="i18n.t('settings.bridge')"
          ><NSwitch :value="core.bridgeActive" @update:value="corePatch({ bridgeActive: $event })"
        /></NFormItem>
        <div class="field-pair">
          <NFormItem :label="i18n.t('settings.mergeWindow')"
            ><NInputNumber :value="core.mergeWindow" :min="0" :step="50" @update:value="number($event, (value) => corePatch({ mergeWindow: value }))"
          /></NFormItem>
          <NFormItem :label="i18n.t('settings.mergeLimit')"
            ><NInputNumber
              :value="core.mergeLimit"
              :min="0"
              :precision="0"
              @update:value="number($event, (value) => corePatch({ mergeLimit: value }))"
          /></NFormItem>
        </div>
        <NFormItem :label="i18n.t('settings.offset')">
          <div class="full-width">
            <NInputNumber
              :value="core.offset.global"
              :step="50"
              :precision="0"
              @update:value="number($event, (value) => corePatch({ offset: { global: value } }))"
            />
            <div class="field-hint">{{ i18n.t('settings.offsetHint') }}</div>
          </div>
        </NFormItem>
        <NFormItem :label="i18n.t('settings.meta')"
          ><NSwitch :value="core.offset.useMeta" @update:value="corePatch({ offset: { useMeta: $event } })"
        /></NFormItem>
        <NFormItem :label="i18n.t('settings.resetTemp')"
          ><NSwitch :value="core.offset.resetTempOnLyricChange" @update:value="corePatch({ offset: { resetTempOnLyricChange: $event } })"
        /></NFormItem>
        <NFormItem :label="i18n.t('settings.temp')"
          ><NInputNumber
            :value="settings.temporaryOffset.value"
            :step="50"
            :precision="0"
            @update:value="number($event, settings.setTemporaryOffset)"
        /></NFormItem>
        <NButton size="small" secondary data-testid="reset-core" @click="settings.reset('core')">{{ i18n.t('settings.reset') }}</NButton>
      </NForm>
    </NCollapseItem>
    <NCollapseItem name="renderer" :title="i18n.t('settings.renderer')">
      <NForm label-placement="top" size="small">
        <div class="field-pair">
          <NFormItem :label="i18n.t('settings.fontSize')"
            ><NInputNumber
              :value="renderer.line.font.size"
              :min="1"
              :max="160"
              data-testid="font-size"
              @update:value="number($event, (value) => rendererPatch({ line: { font: { size: value } } }))"
          /></NFormItem>
          <NFormItem :label="i18n.t('settings.fontWeight')"
            ><NInputNumber
              :value="renderer.line.font.weight"
              :min="1"
              :max="1000"
              :step="100"
              @update:value="number($event, (value) => rendererPatch({ line: { font: { weight: value } } }))"
          /></NFormItem>
        </div>
        <NFormItem :label="i18n.t('settings.fontFamily')"
          ><NInput
            :value="renderer.line.font.family"
            :placeholder="i18n.t('settings.fontFamilyHint')"
            @update:value="rendererPatch({ line: { font: { family: $event } } })"
        /></NFormItem>
        <div class="field-pair">
          <NFormItem :label="i18n.t('settings.gap')"
            ><NInputNumber
              :value="renderer.modes.list.gap"
              :min="0"
              :max="300"
              @update:value="number($event, (value) => rendererPatch({ modes: { list: { gap: value } } }))"
          /></NFormItem>
          <NFormItem :label="i18n.t('settings.align')"
            ><NSelect
              :value="renderer.modes.list.align"
              :options="aligns"
              @update:value="rendererPatch({ modes: { list: { align: $event as 'left' | 'center' | 'right' } } })"
          /></NFormItem>
        </div>
        <NFormItem :label="i18n.t('settings.follow')"
          ><NSwitch :value="renderer.modes.list.scroll.follow" @update:value="rendererPatch({ modes: { list: { scroll: { follow: $event } } } })"
        /></NFormItem>
        <NFormItem :label="i18n.t('settings.anchor')"
          ><NInputNumber
            :value="renderer.modes.list.scroll.anchor"
            :min="0"
            :max="100"
            @update:value="number($event, (value) => rendererPatch({ modes: { list: { scroll: { anchor: value } } } }))"
        /></NFormItem>
        <NFormItem :label="i18n.t('settings.autoResume')"
          ><NSwitch
            :value="renderer.modes.list.scroll.resumeDelay !== Infinity"
            @update:value="rendererPatch({ modes: { list: { scroll: { resumeDelay: $event ? 3000 : Infinity } } } })"
        /></NFormItem>
        <NFormItem v-if="renderer.modes.list.scroll.resumeDelay !== Infinity" :label="i18n.t('settings.resumeDelay')"
          ><NInputNumber
            :value="renderer.modes.list.scroll.resumeDelay"
            :min="0"
            :step="250"
            @update:value="number($event, (value) => rendererPatch({ modes: { list: { scroll: { resumeDelay: value } } } }))"
        /></NFormItem>
        <div class="field-hint reset-hint">{{ i18n.t('settings.resumeHint') }}</div>
        <NButton size="small" secondary data-testid="reset-renderer" @click="settings.reset('renderer')">{{ i18n.t('settings.reset') }}</NButton>
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

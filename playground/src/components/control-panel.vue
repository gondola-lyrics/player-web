<script setup lang="ts">
import type { useI18n } from '../composables/useI18n'
import type { usePlayer } from '../composables/usePlayer'
import type { useSettings } from '../composables/useSettings'

import { NTabPane, NTabs } from 'naive-ui'
import { nextTick } from 'vue'

import AudioPanel from './panels/audio-panel.vue'
import LyricPanel from './panels/lyric-panel.vue'
import SettingsPanel from './panels/settings-panel.vue'

defineProps<{ player: ReturnType<typeof usePlayer>; settings: ReturnType<typeof useSettings>; i18n: ReturnType<typeof useI18n> }>()
const tab = defineModel<string>('tab', { required: true })
const TABS = ['audio', 'lyric', 'settings'] as const
type PanelTab = (typeof TABS)[number]
const navigate = async (event: KeyboardEvent, name: PanelTab) => {
  let target = TABS.indexOf(name)
  switch (event.key) {
    case 'ArrowRight':
      target = (target + 1) % TABS.length
      break
    case 'ArrowLeft':
      target = (target + TABS.length - 1) % TABS.length
      break
    case 'Home':
      target = 0
      break
    case 'End':
      target = TABS.length - 1
      break
    case 'Enter':
    case ' ':
      break
    default:
      return
  }
  event.preventDefault()
  tab.value = TABS[target]!
  await nextTick()
  document.getElementById(`panel-tab-${tab.value}`)?.focus()
}
const tabProps = (name: PanelTab) => {
  return {
    id: `panel-tab-${name}`,
    role: 'tab',
    tabindex: tab.value === name ? 0 : -1,
    'aria-selected': tab.value === name,
    'aria-controls': `panel-content-${name}`,
    onKeydown: (event: KeyboardEvent) => {
      void navigate(event, name)
    },
  }
}
</script>

<template>
  <div class="control-panel">
    <NTabs
      :value="tab"
      type="segment"
      size="small"
      role="tablist"
      :aria-label="i18n.t('app.panel')"
      justify-content="space-evenly"
      pane-wrapper-class="panel-body"
      pane-class="panel-content"
      pane-style="padding: 18px 18px 24px"
      @update:value="tab = $event"
    >
      <NTabPane
        id="panel-content-audio"
        name="audio"
        :tab="i18n.t('tabs.audio')"
        :tab-props="tabProps('audio')"
        role="tabpanel"
        aria-labelledby="panel-tab-audio"
        display-directive="show"
        ><AudioPanel :player="player" :i18n="i18n"
      /></NTabPane>
      <NTabPane
        id="panel-content-lyric"
        name="lyric"
        :tab="i18n.t('tabs.lyric')"
        :tab-props="tabProps('lyric')"
        role="tabpanel"
        aria-labelledby="panel-tab-lyric"
        display-directive="show"
        ><LyricPanel :player="player" :i18n="i18n"
      /></NTabPane>
      <NTabPane
        id="panel-content-settings"
        name="settings"
        :tab="i18n.t('tabs.settings')"
        :tab-props="tabProps('settings')"
        role="tabpanel"
        aria-labelledby="panel-tab-settings"
        display-directive="show"
        ><SettingsPanel :player="player" :settings="settings" :i18n="i18n"
      /></NTabPane>
    </NTabs>
  </div>
</template>

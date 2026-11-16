<script setup lang="ts">
import { NAlert, NButton, NConfigProvider, NGlobalStyle, NMessageProvider, NText, enUS, zhCN } from 'naive-ui'
import { computed, onScopeDispose, ref } from 'vue'

import ControlPanel from './components/control-panel.vue'
import Controls from './components/controls.vue'
import LyricArea from './components/lyric-area.vue'
import { useI18n } from './composables/useI18n'
import { usePlayer } from './composables/usePlayer'
import { useSettings } from './composables/useSettings'
import { THEME_OVERRIDES } from './lib/theme'

const player = usePlayer()
const settings = useSettings(player)
const i18n = useI18n()
const { t, locale } = i18n
const orientation = window.matchMedia('(orientation: landscape)')
const panelOpen = ref(orientation.matches)
const activeTab = ref('audio')
const handleOrientation = () => {
  panelOpen.value = orientation.matches
}
orientation.addEventListener('change', handleOrientation)
onScopeDispose(() => {
  orientation.removeEventListener('change', handleOrientation)
})
const toggleLocale = () => {
  locale.value = locale.value === 'zh-CN' ? 'en-US' : 'zh-CN'
}
const togglePanel = () => {
  panelOpen.value = !panelOpen.value
}
const storageAvailable = computed(() => player.storageAvailable.value && player.media.state.storageAvailable && settings.storageAvailable.value)
</script>

<template>
  <NConfigProvider :locale="locale === 'zh-CN' ? zhCN : enUS" :theme-overrides="THEME_OVERRIDES" class="playground">
    <NGlobalStyle />
    <NMessageProvider>
      <div class="app-shell">
        <div class="sidebar-region" :class="{ expanded: panelOpen }" :inert="!panelOpen" :aria-hidden="!panelOpen">
          <aside id="player-sidebar" class="sidebar" :aria-label="t('app.panel')">
            <header class="sidebar-header">
              <NText strong class="wordmark">{{ t('app.title') }}</NText>
              <div class="sidebar-actions">
                <NButton quaternary size="small" :aria-label="t('app.language')" class="locale-toggle" @click="toggleLocale">
                  <span :class="{ selected: locale === 'zh-CN' }">CN</span>
                  <span class="locale-separator" aria-hidden="true">/</span>
                  <span :class="{ selected: locale === 'en-US' }">EN</span>
                </NButton>
                <NButton quaternary circle size="small" :aria-label="t('app.closePanel')" @click="panelOpen = false">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path d="m6 6 12 12M18 6 6 18" />
                  </svg>
                </NButton>
              </div>
            </header>
            <ControlPanel v-model:tab="activeTab" :player="player" :settings="settings" :i18n="i18n" />
          </aside>
        </div>
        <main class="app-main">
          <NAlert v-if="!storageAvailable" type="warning" :show-icon="false" class="storage-alert">{{ t('app.storage') }}</NAlert>
          <LyricArea :player="player" :i18n="i18n" />
          <Controls :player="player" :i18n="i18n" :panel-open="panelOpen" @toggle-panel="togglePanel" />
        </main>
      </div>
    </NMessageProvider>
  </NConfigProvider>
</template>

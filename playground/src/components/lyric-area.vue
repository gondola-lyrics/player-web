<script setup lang="ts">
import type { useI18n } from '../composables/useI18n'
import type { usePlayer } from '../composables/usePlayer'

import { NEmpty } from 'naive-ui'
import { onMounted, useTemplateRef } from 'vue'

const props = defineProps<{ player: ReturnType<typeof usePlayer>; i18n: ReturnType<typeof useI18n> }>()
const host = useTemplateRef<HTMLDivElement>('host')
onMounted(() => {
  host.value?.appendChild(props.player.renderer.element)
})
</script>

<template>
  <section class="lyric-stage">
    <div ref="host" class="lyric-host" data-testid="lyric-host"></div>
    <div v-if="player.lyric.value.lines.length === 0" class="lyric-empty">
      <NEmpty :description="i18n.t('lyric.empty')" />
    </div>
  </section>
</template>

<style scoped lang="scss">
.lyric-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.lyric-host,
.lyric-empty {
  position: absolute;
  inset: 0;
}

.lyric-host {
  padding: 0;

  :deep([data-role='container']) {
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
  }
}

.lyric-empty {
  display: grid;
  place-items: center;
  background: var(--surface);
}
</style>

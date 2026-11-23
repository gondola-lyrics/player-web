import type { MessageKey } from '../locales/en-us'

import { ref, watch } from 'vue'

import { readStorage, writeStorage } from '../lib/storage'
import { EN } from '../locales/en-us'
import { ZH } from '../locales/zh-cn'

export type Locale = 'zh-CN' | 'en-US'

/**
 * Shares one locale between the playground copy and Naive UI's own translations.
 */
export const useI18n = () => {
  const saved = readStorage('gondola-player-locale-v1')
  const locale = ref<Locale>(saved === 'en-US' ? 'en-US' : 'zh-CN')

  const t = (key: MessageKey, parameters?: Record<string, string | number>): string => {
    const message = (locale.value === 'zh-CN' ? ZH : EN)[key]

    return message.replace(/\{(\w+)\}/g, (_, name: string) => {
      return String(parameters?.[name] ?? '')
    })
  }

  watch(
    locale,
    (value) => {
      document.documentElement.lang = value
      writeStorage('gondola-player-locale-v1', value)
    },
    { immediate: true },
  )

  return { locale, t }
}

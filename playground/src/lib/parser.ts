import type { LyricFormat, ParseResult } from '@gondola-lyrics/kit/parser'

import { EnrichedLyricStatus, validateEnrichedLyric } from '@gondola-lyrics/model/enriched'
import {
  extractBackgroundLines,
  insertInstrumentalLines,
  insertSpacesInLines,
  parseKrc,
  parseKwrc,
  parseLrc,
  parseQrc,
  parseTtml,
  parseYrc,
  stripBackgroundBrackets,
} from '@gondola-lyrics/kit/parser'

import { readRecord } from './storage'

export interface LyricSource {
  format: LyricFormat
  text: string
  /**
   * Display name of the imported file, or an empty string for pasted text.
   */
  name: string
  /**
   * Separate translation track text for formats that support it.
   */
  translations: string
  /**
   * Separate romanization track text for formats that support it.
   */
  romans: string
}

export const LYRIC_FORMATS: readonly LyricFormat[] = ['lrc', 'qrc', 'yrc', 'krc', 'kwrc', 'ttml']

/**
 * Restores saved input, defaulting missing tracks to empty strings and unknown formats to LRC.
 */
export const readLyricSource = (value?: unknown): LyricSource => {
  const saved = readRecord(value)
  return {
    format: LYRIC_FORMATS.find((format) => format === saved.format) ?? 'lrc',
    text: typeof saved.text === 'string' ? saved.text : '',
    name: typeof saved.name === 'string' ? saved.name : '',
    translations: typeof saved.translations === 'string' ? saved.translations : '',
    romans: typeof saved.romans === 'string' ? saved.romans : '',
  }
}

/**
 * Returns whether the format accepts separate translation and romanization tracks.
 */
export const hasAnnotationTracks = (format: LyricFormat): boolean => {
  return format === 'lrc' || format === 'qrc' || format === 'yrc'
}

export interface ParserOptions {
  /**
   * Fallback TTML language when the document omits `xml:lang`.
   */
  language: string
  /**
   * Extracts background vocals from bracketed lyric text.
   */
  extractBackgrounds: boolean
  /**
   * Removes brackets around background vocals after any extraction.
   */
  stripBrackets: boolean
  /**
   * Fills missing spaces in lyric text while preserving the annotation tracks.
   */
  insertSpaces: boolean
  /**
   * Controls insertion of instrumental lines into timed gaps.
   */
  instrumental: {
    enabled: boolean
    /**
     * Minimum introductory gap in milliseconds.
     */
    minIntroDuration: number
    /**
     * Minimum gap between lyric lines in milliseconds.
     */
    minDuration: number
  }
}

/**
 * Restores parser preferences, using defaults for missing or invalid values.
 */
export const readParserOptions = (value?: unknown): ParserOptions => {
  const saved = readRecord(value)
  const instrumental = readRecord(saved.instrumental)
  const milliseconds = (value: unknown, fallback: number) => {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : fallback
  }

  return {
    language: typeof saved.language === 'string' ? saved.language : '',
    extractBackgrounds: saved.extractBackgrounds === true,
    stripBrackets: saved.stripBrackets === true,
    insertSpaces: saved.insertSpaces === true,
    instrumental: {
      enabled: instrumental.enabled === true,
      minIntroDuration: milliseconds(instrumental.minIntroDuration, 5000),
      minDuration: milliseconds(instrumental.minDuration, 10000),
    },
  }
}

const parseOriginal = (source: LyricSource, options: ParserOptions): ParseResult => {
  const tracks = {
    original: source.text,
    translations: source.translations.trim() ? source.translations : undefined,
    romans: source.romans.trim() ? source.romans : undefined,
  }

  switch (source.format) {
    case 'lrc':
      return parseLrc(tracks)
    case 'qrc':
      return parseQrc(tracks)
    case 'yrc':
      return parseYrc(tracks)
    case 'krc':
      return parseKrc(source.text)
    case 'kwrc':
      return parseKwrc(source.text)
    case 'ttml':
      return parseTtml(source.text, { language: options.language.trim() || undefined })
  }
}

/**
 * Rebuilds lyrics from the original input so processing changes apply to a fresh parse.
 */
export const parseSource = (source: LyricSource, options: ParserOptions): ParseResult => {
  const result = parseOriginal(source, options)
  if (result.lyric.status !== EnrichedLyricStatus.VALID) {
    return result
  }

  let lyric = result.lyric
  if (options.extractBackgrounds) {
    lyric = extractBackgroundLines(lyric)
  }
  if (options.stripBrackets) {
    lyric = stripBackgroundBrackets(lyric)
  }
  if (options.insertSpaces) {
    lyric = insertSpacesInLines(lyric, { annotations: false })
  }
  if (options.instrumental.enabled) {
    lyric = insertInstrumentalLines(lyric, options.instrumental)
  }

  return { lyric, diagnostics: lyric === result.lyric ? result.diagnostics : validateEnrichedLyric(lyric) }
}

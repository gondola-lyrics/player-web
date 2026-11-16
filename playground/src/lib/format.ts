/**
 * Formats the millisecond clock shared by the controls and lyric player.
 */
export const formatTime = (milliseconds: number): string => {
  const seconds = Math.floor(Math.max(0, Number.isFinite(milliseconds) ? milliseconds : 0) / 1000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

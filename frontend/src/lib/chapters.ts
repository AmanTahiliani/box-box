import type { Chapter } from '../types'

export function chapterKindLabel(kind: string): string {
  switch (kind) {
    case 'start':
      return 'GO'
    case 'safety_car':
      return 'SC'
    case 'virtual_safety_car':
      return 'VSC'
    case 'red_flag':
      return 'RF'
    case 'pit_phase':
      return 'PIT'
    case 'decisive_swing':
      return '▲'
    case 'finish':
      return 'FIN'
    default:
      return kind.slice(0, 3).toUpperCase()
  }
}

export function chapterLapRange(chapter: Chapter): string {
  if (chapter.start_lap === chapter.end_lap) {
    return `L${chapter.start_lap}`
  }
  return `L${chapter.start_lap}–L${chapter.end_lap}`
}

/** Normalized scrub position (0–1) for a chapter's start time on the chart axis. */
export function chapterStartScrub(
  chapter: Chapter,
  tMin: number,
  tRange: number,
): number | null {
  if (!chapter.start_time || tRange <= 0) return null
  const ms = new Date(chapter.start_time).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.min(1, (ms - tMin) / tRange))
}

/** Normalized scrub position (0–1) for a chapter's end time on the chart axis. */
export function chapterEndScrub(
  chapter: Chapter,
  tMin: number,
  tRange: number,
): number | null {
  const raw = chapter.end_time ?? chapter.start_time
  if (!raw || tRange <= 0) return null
  const ms = new Date(raw).getTime()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.min(1, (ms - tMin) / tRange))
}

/** Index of the chapter containing the current scrub position, if any. */
export function activeChapterIndex(
  chapters: Chapter[],
  scrubTime: number | null,
  tMin: number,
  tRange: number,
): number | null {
  if (scrubTime === null || chapters.length === 0 || tRange <= 0) return null
  const chartMs = tMin + scrubTime * tRange
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    const startMs = ch.start_time ? new Date(ch.start_time).getTime() : NaN
    const endRaw = ch.end_time ?? ch.start_time
    const endMs = endRaw ? new Date(endRaw).getTime() : NaN
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && chartMs >= startMs && chartMs <= endMs) {
      return i
    }
  }
  return null
}

/** Duration in ms each chapter should play during a ~90s tour. */
export function chapterTourDurations(chapters: Chapter[], totalMs = 90_000): number[] {
  if (chapters.length === 0) return []
  const perChapter = totalMs / chapters.length
  return chapters.map(() => perChapter)
}

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

/** Decimated position axis labels, e.g. P1, P5, P10, P15, P20. */
export function decimatedPositionLabels(maxPos: number): number[] {
  if (maxPos <= 1) return [1]
  const labels = new Set<number>([1])
  for (let pos = 5; pos < maxPos; pos += 5) {
    labels.add(pos)
  }
  labels.add(maxPos)
  return [...labels].sort((a, b) => a - b)
}

/** Subtle background fill for chapter time-bands on the position graph. */
export function chapterBandFill(kind: string): string {
  switch (kind) {
    case 'safety_car':
      return 'rgba(255, 153, 0, 0.14)'
    case 'virtual_safety_car':
      return 'rgba(255, 204, 0, 0.12)'
    case 'red_flag':
      return 'rgba(230, 36, 41, 0.12)'
    case 'pit_phase':
      return 'rgba(96, 165, 250, 0.08)'
    case 'decisive_swing':
      return 'rgba(34, 197, 94, 0.08)'
    case 'finish':
      return 'rgba(255, 204, 0, 0.06)'
    default:
      return 'rgba(255, 255, 255, 0.03)'
  }
}

/** Minimum vertical spacing between colliding labels (SVG units). */
export function deCollideYPositions(
  items: ReadonlyArray<{ key: string | number; y: number }>,
  minGap = 12,
): Map<string | number, number> {
  if (items.length === 0) return new Map()
  const sorted = [...items].sort((a, b) => a.y - b.y)
  const adjusted = sorted.map((item) => ({ ...item }))
  for (let i = 1; i < adjusted.length; i++) {
    const prev = adjusted[i - 1]
    const curr = adjusted[i]
    if (curr.y - prev.y < minGap) {
      curr.y = prev.y + minGap
    }
  }
  return new Map(adjusted.map((item) => [item.key, item.y]))
}

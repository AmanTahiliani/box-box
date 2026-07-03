import type { DatasetInfo, Weekend, WeekendSession } from '../types'

export const RACE_HUB_DATASETS = [
  'meeting',
  'session',
  'drivers',
  'results',
  'starting_grid',
  'stints',
  'pit_stops',
  'positions',
  'race_control',
  'weather',
  'laps',
] as const

export type RaceHubDatasetKey = (typeof RACE_HUB_DATASETS)[number]

export function countRaceHubDatasets(datasets: Record<string, DatasetInfo>): { available: number; total: number } {
  const total = RACE_HUB_DATASETS.length
  const available = RACE_HUB_DATASETS.filter((key) => {
    const status = datasets[key]?.status
    return status === 'available' || status === 'skipped'
  }).length
  return { available, total }
}

export function formatCoverageHint(datasets: Record<string, DatasetInfo>): string {
  const { available, total } = countRaceHubDatasets(datasets)
  return `${available}/${total}`
}

export function isSessionComplete(datasets: Record<string, DatasetInfo>): boolean {
  const { available, total } = countRaceHubDatasets(datasets)
  return available === total
}

export function sessionTypeAbbrev(sessionType: string, sessionName: string): string {
  const type = sessionType.toLowerCase()
  const name = sessionName.toLowerCase()
  if (type.includes('race') || name === 'race') return 'R'
  if (type.includes('qualifying') || name.startsWith('q')) return 'Q'
  if (type.includes('sprint')) return 'S'
  if (name.includes('fp1') || name.includes('practice 1')) return 'FP1'
  if (name.includes('fp2') || name.includes('practice 2')) return 'FP2'
  if (name.includes('fp3') || name.includes('practice 3')) return 'FP3'
  return sessionName.slice(0, 3).toUpperCase()
}

export function countWeekendStats(weekends: (Weekend | undefined)[]) {
  let full = 0
  let partial = 0
  let missing = 0
  let cancelled = 0

  for (const weekend of weekends) {
    if (!weekend || weekend.sessions.length === 0) {
      missing++
      continue
    }
    switch (weekend.source) {
      case 'local':
        full++
        break
      case 'partial':
        partial++
        break
      case 'cancelled':
        cancelled++
        break
      default:
        missing++
    }
  }

  return { full, partial, cancelled, missing, total: weekends.length }
}

export function sessionIconClass(session: WeekendSession): string {
  if (session.source === 'cancelled') return 'si-cancelled'
  if (session.source === 'none') return 'si-missing'
  if (isSessionComplete(session.datasets)) return 'si-full'
  return 'si-partial'
}

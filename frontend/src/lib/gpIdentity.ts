import type { Meeting } from '../types'

const COUNTRY_ACCENTS: Record<string, string> = {
  ITA: '#1f7a4d',
  GBR: '#3a6cf5',
  USA: '#d62828',
  MON: '#d61a3e',
  ESP: '#e7a90b',
  FRA: '#2353d6',
  GER: '#cdc7c2',
  DEU: '#cdc7c2',
  BEL: '#e0a01b',
  NLD: '#ef7c1a',
  HUN: '#3f8a4b',
  AUT: '#c61f1f',
  AZE: '#1f7eaf',
  CAN: '#c8202c',
  AUS: '#1b6b86',
  JPN: '#c8202c',
  SGP: '#c8202c',
  BRA: '#2fa84f',
  BHR: '#a8132b',
  SAU: '#0a7a3b',
  ARE: '#4d6b2a',
  QAT: '#7a1e3e',
  CHN: '#c8202c',
  MEX: '#1f7a4d',
}

const DEFAULT_ACCENT = '#9aa0a6'

export function countryAccent(meeting: Meeting | undefined | null): string {
  if (!meeting) return DEFAULT_ACCENT
  const code = meeting.country_code?.toUpperCase()
  if (code && COUNTRY_ACCENTS[code]) return COUNTRY_ACCENTS[code]
  return DEFAULT_ACCENT
}

export function countryDecal(meeting: Meeting | undefined | null): string {
  const code = meeting?.country_code?.toUpperCase()
  if (code && code.length >= 2) return code.slice(0, 3)
  const name = meeting?.country_name ?? ''
  return name.slice(0, 3).toUpperCase() || '—'
}

export function formatGpDateRange(meeting: Meeting | undefined | null): string {
  if (!meeting) return ''
  const start = meeting.date_start?.slice(0, 10)
  const end = meeting.date_end?.slice(0, 10)
  if (!start && !end) return ''
  const fmt = (iso: string): string => {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  if (start && end && start !== end) {
    const left = fmt(start)
    const right = fmt(end)
    const year = end.slice(0, 4)
    return `${left} – ${right} ${year}`
  }
  if (start) {
    return `${fmt(start)} ${start.slice(0, 4)}`
  }
  return end ? `${fmt(end)} ${end.slice(0, 4)}` : ''
}

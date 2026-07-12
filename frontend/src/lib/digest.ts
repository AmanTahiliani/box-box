import { meetingEndTime, meetingStartTime, mostRecentPastMeeting, nextUpcomingMeeting } from './schedule'
import type { ChampHubDriver, ChampHubTeam, Meeting, NewsItem } from '../types'

export interface GPWindow {
  meeting_key: number
  meeting_name: string
  /** Inclusive lower bound: end of previous GP, or open for season opener. */
  start: Date | null
  /** Exclusive upper bound: start of next GP, or open after the final round. */
  end: Date | null
}

export interface DigestTag {
  kind: 'driver' | 'team'
  key: string
  label: string
  colour: string
}

export type TaggedNewsItem = NewsItem & { tags: DigestTag[] }

export const RECENT_BUCKET_KEY = '__recent__'

interface MatchCandidate {
  start: number
  end: number
  tag: DigestTag
}

interface TagPattern {
  pattern: string
  tag: DigestTag
}

function sortMeetings(meetings: Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => {
    const left = meetingStartTime(a)?.getTime() ?? 0
    const right = meetingStartTime(b)?.getTime() ?? 0
    if (left !== right) return left - right
    return a.meeting_name.localeCompare(b.meeting_name)
  })
}

/** Derive inter-race windows [prev GP end → next GP start] for each round. */
export function gpWindows(meetings: Meeting[], _now: Date): GPWindow[] {
  const sorted = sortMeetings(meetings)
  return sorted.map((meeting, index) => ({
    meeting_key: meeting.meeting_key,
    meeting_name: meeting.meeting_name,
    start: index > 0 ? meetingEndTime(sorted[index - 1]) : null,
    end: index < sorted.length - 1 ? meetingStartTime(sorted[index + 1]) : null,
  }))
}

function itemPublishedAt(item: NewsItem): Date | null {
  if (!item.published_at) return null
  const parsed = Date.parse(item.published_at)
  return Number.isNaN(parsed) ? null : new Date(parsed)
}

function itemInWindow(published: Date, window: GPWindow): boolean {
  if (window.start && published < window.start) return false
  if (window.end && published >= window.end) return false
  return true
}

export function windowForDate(windows: GPWindow[], published: Date): GPWindow | null {
  const matches = windows.filter((window) => itemInWindow(published, window))
  if (matches.length === 0) return null
  return matches.reduce((best, window) => {
    const bestStart = best.start?.getTime() ?? Number.NEGATIVE_INFINITY
    const windowStart = window.start?.getTime() ?? Number.NEGATIVE_INFINITY
    return windowStart >= bestStart ? window : best
  })
}

export interface GroupedDigest {
  windows: Array<{ window: GPWindow; items: NewsItem[] }>
  recent: NewsItem[]
}

/** Bucket news items into GP windows; undated items land in `recent`. */
export function groupByWindow(items: NewsItem[], windows: GPWindow[]): GroupedDigest {
  const buckets = new Map<number, NewsItem[]>()
  const recent: NewsItem[] = []

  for (const item of items) {
    const published = itemPublishedAt(item)
    if (!published) {
      recent.push(item)
      continue
    }
    const match = windowForDate(windows, published)
    if (!match) {
      recent.push(item)
      continue
    }
    const list = buckets.get(match.meeting_key) ?? []
    list.push(item)
    buckets.set(match.meeting_key, list)
  }

  const grouped = windows
    .map((window) => ({
      window,
      items: buckets.get(window.meeting_key) ?? [],
    }))
    .filter((entry) => entry.items.length > 0)

  return { windows: grouped, recent }
}

function driverLastName(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return parts[parts.length - 1] ?? null
}

function buildTagPatterns(drivers: ChampHubDriver[], teams: ChampHubTeam[]): TagPattern[] {
  const patterns: TagPattern[] = []

  for (const team of teams) {
    if (!team.team_name.trim()) continue
    patterns.push({
      pattern: team.team_name.toLowerCase(),
      tag: {
        kind: 'team',
        key: `team:${team.team_name}`,
        label: team.team_name,
        colour: team.team_colour,
      },
    })
  }

  for (const driver of drivers) {
    const colour = driver.team_colour
    const base = {
      kind: 'driver' as const,
      colour,
    }
    if (driver.full_name.trim()) {
      patterns.push({
        pattern: driver.full_name.toLowerCase(),
        tag: {
          ...base,
          key: `driver:${driver.name_acronym}`,
          label: driver.name_acronym,
        },
      })
      const lastName = driverLastName(driver.full_name)
      if (lastName) {
        patterns.push({
          pattern: lastName.toLowerCase(),
          tag: {
            ...base,
            key: `driver:${driver.name_acronym}`,
            label: driver.name_acronym,
          },
        })
      }
    }
    if (driver.name_acronym.trim()) {
      patterns.push({
        pattern: driver.name_acronym.toLowerCase(),
        tag: {
          ...base,
          key: `driver:${driver.name_acronym}`,
          label: driver.name_acronym,
        },
      })
    }
  }

  patterns.sort((a, b) => b.pattern.length - a.pattern.length)
  return patterns
}

function overlaps(a: MatchCandidate, b: MatchCandidate): boolean {
  return a.start < b.end && b.start < a.end
}

/**
 * Tag items via case-insensitive substring match on title + summary.
 * Longest pattern wins on overlapping spans (v1 string match — no NLP).
 *
 * Known limitations: common-word last names, team names inside other words,
 * and driver TLAs that appear in unrelated acronyms can false-positive.
 */
export function tagItems(
  items: NewsItem[],
  drivers: ChampHubDriver[],
  teams: ChampHubTeam[],
): TaggedNewsItem[] {
  const patterns = buildTagPatterns(drivers, teams)

  return items.map((item) => {
    const haystack = `${item.title} ${item.summary ?? ''}`.toLowerCase()
    const accepted: MatchCandidate[] = []

    for (const { pattern, tag } of patterns) {
      if (!pattern) continue
      let from = 0
      while (from <= haystack.length - pattern.length) {
        const index = haystack.indexOf(pattern, from)
        if (index === -1) break
        const candidate: MatchCandidate = {
          start: index,
          end: index + pattern.length,
          tag,
        }
        if (!accepted.some((match) => overlaps(match, candidate))) {
          accepted.push(candidate)
        }
        from = index + 1
      }
    }

    const tagsByKey = new Map<string, DigestTag>()
    for (const match of accepted) {
      tagsByKey.set(match.tag.key, match.tag)
    }

    return {
      ...item,
      tags: [...tagsByKey.values()].sort((a, b) => a.label.localeCompare(b.label)),
    }
  })
}

export function activeDigestWindow(
  windows: GPWindow[],
  meetings: Meeting[],
  now: Date,
): GPWindow | null {
  const next = nextUpcomingMeeting(meetings, now)
  if (next) {
    return windows.find((window) => window.meeting_key === next.meeting_key) ?? null
  }
  const recent = mostRecentPastMeeting(meetings, now)
  if (recent) {
    return windows.find((window) => window.meeting_key === recent.meeting_key) ?? null
  }
  return windows[0] ?? null
}

export function sinceLastLabel(meetings: Meeting[], now: Date): string {
  const last = mostRecentPastMeeting(meetings, now)
  if (last) return last.meeting_name
  const next = nextUpcomingMeeting(meetings, now)
  if (next) return `Before ${next.meeting_name}`
  return 'Pre-season'
}

export function itemsForWindow(items: TaggedNewsItem[], window: GPWindow | null): TaggedNewsItem[] {
  if (!window) return []
  return items.filter((item) => {
    const published = itemPublishedAt(item)
    return published != null && itemInWindow(published, window)
  })
}

export function topTags(items: TaggedNewsItem[], limit = 5): DigestTag[] {
  const counts = new Map<string, { tag: DigestTag; count: number }>()
  for (const item of items) {
    for (const tag of item.tags) {
      const current = counts.get(tag.key)
      if (current) current.count += 1
      else counts.set(tag.key, { tag, count: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.tag.label.localeCompare(b.tag.label))
    .slice(0, limit)
    .map((entry) => entry.tag)
}

export function filterByTag(items: TaggedNewsItem[], tagKey: string | null): TaggedNewsItem[] {
  if (!tagKey) return items
  return items.filter((item) => item.tags.some((tag) => tag.key === tagKey))
}

export function tagColour(colour: string): string {
  if (!colour) return 'var(--text-3)'
  return colour.startsWith('#') ? colour : `#${colour}`
}

export function sortWindowBucketsNewestFirst<T extends { window: GPWindow }>(buckets: T[]): T[] {
  return [...buckets].sort((a, b) => {
    const left = a.window.start?.getTime() ?? 0
    const right = b.window.start?.getTime() ?? 0
    return right - left
  })
}

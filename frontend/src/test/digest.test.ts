import { describe, it, expect } from 'vitest'
import {
  activeDigestWindow,
  filterByTag,
  groupByWindow,
  gpWindows,
  itemsForWindow,
  sinceLastLabel,
  sortWindowBucketsNewestFirst,
  tagItems,
  topTags,
  windowForDate,
} from '../lib/digest'
import type { ChampHubDriver, ChampHubTeam, Meeting, NewsItem } from '../types'

const meeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  meeting_key: 1,
  meeting_name: 'Bahrain',
  meeting_official_name: 'Bahrain GP',
  location: 'Sakhir',
  country_name: 'Bahrain',
  country_code: 'BRN',
  country_flag: '',
  circuit_short_name: 'Sakhir',
  date_start: '2025-03-14T00:00:00+00:00',
  date_end: '2025-03-16T23:59:59+00:00',
  year: 2025,
  ...overrides,
})

const news = (overrides: Partial<NewsItem> = {}): NewsItem => ({
  source: 'autosport-f1',
  title: 'Headline',
  url: `https://example.com/${Math.random()}`,
  fetched_at: '2025-04-01T12:00:00Z',
  ...overrides,
})

const driver = (over: Partial<ChampHubDriver>): ChampHubDriver => ({
  driver_number: 1,
  name_acronym: 'VER',
  full_name: 'Max Verstappen',
  team_name: 'Red Bull',
  team_colour: '3671c6',
  points: 100,
  position: 1,
  wins: 3,
  podiums: 5,
  poles: 2,
  form: [25, 18, 25],
  cumulative: [25, 43, 68, 100],
  teammate_wins: 4,
  teammate_losses: 1,
  round_positions: [],
  ...over,
})

const team = (over: Partial<ChampHubTeam>): ChampHubTeam => ({
  team_name: 'Red Bull',
  team_colour: '3671c6',
  points: 150,
  position: 1,
  wins: 4,
  ...over,
})

describe('gpWindows', () => {
  const bahrain = meeting({ meeting_key: 1, meeting_name: 'Bahrain' })
  const monaco = meeting({
    meeting_key: 2,
    meeting_name: 'Monaco',
    date_start: '2025-05-23T00:00:00+00:00',
    date_end: '2025-05-25T23:59:59+00:00',
  })
  const canada = meeting({
    meeting_key: 3,
    meeting_name: 'Canada',
    date_start: '2025-06-13T00:00:00+00:00',
    date_end: '2025-06-15T23:59:59+00:00',
  })

  it('derives inter-race windows mid-season', () => {
    const now = new Date('2025-04-10T12:00:00Z')
    const windows = gpWindows([bahrain, monaco, canada], now)

    expect(windows).toHaveLength(3)
    expect(windows[0].start).toBeNull()
    expect(windows[0].end?.toISOString()).toBe(new Date('2025-05-23T00:00:00+00:00').toISOString())
    expect(windows[1].start?.toISOString()).toBe(new Date('2025-03-16T23:59:59+00:00').toISOString())
    expect(windows[1].end?.toISOString()).toBe(new Date('2025-06-13T00:00:00+00:00').toISOString())
    expect(windows[2].start?.toISOString()).toBe(new Date('2025-05-25T23:59:59+00:00').toISOString())
    expect(windows[2].end).toBeNull()
  })

  it('handles before the first race of the season', () => {
    const now = new Date('2025-01-01T00:00:00Z')
    const windows = gpWindows([bahrain, monaco], now)
    expect(windows[0].start).toBeNull()
    expect(activeDigestWindow(windows, [bahrain, monaco], now)?.meeting_name).toBe('Bahrain')
    expect(sinceLastLabel([bahrain, monaco], now)).toBe('Before Bahrain')
  })

  it('handles after the final race of the season', () => {
    const now = new Date('2025-12-01T00:00:00Z')
    const windows = gpWindows([bahrain, monaco], now)
    expect(activeDigestWindow(windows, [bahrain, monaco], now)?.meeting_name).toBe('Monaco')
    expect(sinceLastLabel([bahrain, monaco], now)).toBe('Monaco')
    expect(windows[1].end).toBeNull()
  })
})

describe('groupByWindow', () => {
  const bahrain = meeting({ meeting_key: 1 })
  const monaco = meeting({
    meeting_key: 2,
    date_start: '2025-05-23T00:00:00+00:00',
    date_end: '2025-05-25T23:59:59+00:00',
  })
  const windows = gpWindows([bahrain, monaco], new Date('2025-04-10T12:00:00Z'))

  it('buckets dated items into the matching GP window', () => {
    const items = [
      news({ url: 'https://a', published_at: '2025-03-10T10:00:00Z', title: 'Pre-Bahrain' }),
      news({ url: 'https://b', published_at: '2025-04-05T10:00:00Z', title: 'Between races' }),
      news({ url: 'https://c', published_at: '2025-05-24T10:00:00Z', title: 'Monaco weekend' }),
    ]

    const grouped = groupByWindow(items, windows)
    const bahrainItems = grouped.windows.find((entry) => entry.window.meeting_key === 1)?.items ?? []
    const monacoItems = grouped.windows.find((entry) => entry.window.meeting_key === 2)?.items ?? []

    expect(bahrainItems).toHaveLength(1)
    expect(bahrainItems[0].title).toBe('Pre-Bahrain')
    expect(monacoItems).toHaveLength(2)
    expect(monacoItems.map((item) => item.title)).toEqual(['Between races', 'Monaco weekend'])
  })

  it('puts undated items in the recent bucket', () => {
    const items = [
      news({ url: 'https://u', title: 'Undated story' }),
      news({ url: 'https://d', published_at: '2025-04-05T10:00:00Z' }),
    ]
    const grouped = groupByWindow(items, windows)
    expect(grouped.recent).toHaveLength(1)
    expect(grouped.recent[0].url).toBe('https://u')
  })

  it('sorts window buckets newest first for display', () => {
    const items = [
      news({ published_at: '2025-03-10T10:00:00Z' }),
      news({ published_at: '2025-05-24T10:00:00Z' }),
    ]
    const grouped = groupByWindow(items, windows)
    const sorted = sortWindowBucketsNewestFirst(grouped.windows)
    expect(sorted[0].window.meeting_key).toBe(2)
    expect(sorted[1].window.meeting_key).toBe(1)
  })
})

describe('tagItems', () => {
  const drivers = [
    driver({ name_acronym: 'VER', full_name: 'Max Verstappen', team_name: 'Red Bull' }),
    driver({
      driver_number: 4,
      name_acronym: 'NOR',
      full_name: 'Lando Norris',
      team_name: 'McLaren',
      team_colour: 'ff8000',
    }),
  ]
  const teams = [
    team({ team_name: 'Red Bull' }),
    team({ team_name: 'McLaren', team_colour: 'ff8000' }),
  ]

  it('tags drivers and teams case-insensitively', () => {
    const [item] = tagItems(
      [news({ title: 'ver leads mclaren in practice', summary: 'Norris close behind' })],
      drivers,
      teams,
    )
    const labels = item.tags.map((tag) => tag.label).sort()
    expect(labels).toEqual(['McLaren', 'NOR', 'VER'])
  })

  it('returns no tags when nothing matches', () => {
    const [item] = tagItems(
      [news({ title: 'Generic paddock update' })],
      drivers,
      teams,
    )
    expect(item.tags).toEqual([])
  })

  it('prefers the longest overlapping match', () => {
    const [item] = tagItems(
      [news({ title: 'Max Verstappen extends championship lead' })],
      drivers,
      teams,
    )
    expect(item.tags).toHaveLength(1)
    expect(item.tags[0].label).toBe('VER')
  })

  it('matches a driver last name inside prose', () => {
    const [item] = tagItems(
      [news({ title: 'Verstappen was untouchable in qualifying' })],
      drivers,
      teams,
    )
    expect(item.tags.some((tag) => tag.label === 'VER')).toBe(true)
  })
})

describe('digest helpers', () => {
  it('collects top tags by frequency', () => {
    const tagged = tagItems(
      [
        news({ title: 'VER wins', url: 'https://a' }),
        news({ title: 'VER dominates', url: 'https://b' }),
        news({ title: 'Norris podium', url: 'https://c' }),
      ],
      [driver({}), driver({ driver_number: 4, name_acronym: 'NOR', full_name: 'Lando Norris', team_name: 'McLaren' })],
      [team({}), team({ team_name: 'McLaren', team_colour: 'ff8000' })],
    )
    expect(topTags(tagged, 2).map((tag) => tag.label)).toEqual(['VER', 'NOR'])
  })

  it('filters items by tag key', () => {
    const tagged = tagItems(
      [
        news({ title: 'VER wins', url: 'https://a' }),
        news({ title: 'Neutral headline', url: 'https://b' }),
      ],
      [driver({})],
      [team({})],
    )
    const filtered = filterByTag(tagged, 'driver:VER')
    expect(filtered).toHaveLength(1)
    expect(filtered[0].url).toBe('https://a')
  })

  it('selects items for the active digest window', () => {
    const bahrain = meeting({ meeting_key: 1 })
    const monaco = meeting({
      meeting_key: 2,
      date_start: '2025-05-23T00:00:00+00:00',
      date_end: '2025-05-25T23:59:59+00:00',
    })
    const now = new Date('2025-04-10T12:00:00Z')
    const windows = gpWindows([bahrain, monaco], now)
    const active = activeDigestWindow(windows, [bahrain, monaco], now)
    const tagged = tagItems(
      [
        news({ published_at: '2025-04-05T10:00:00Z', url: 'https://in' }),
        news({ published_at: '2025-03-10T10:00:00Z', url: 'https://out' }),
      ],
      [],
      [],
    )
    const inWindow = itemsForWindow(tagged, active)
    expect(inWindow).toHaveLength(1)
    expect(inWindow[0].url).toBe('https://in')
    expect(windowForDate(windows, new Date('2025-04-05T10:00:00Z'))?.meeting_key).toBe(2)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BriefingPage } from '../pages/BriefingPage'
import type { ChampHubDriver, ChampHubTeam, ChampionshipHub, Meeting, NewsItem } from '../types'

vi.mock('../api', () => ({
  fetchNews: vi.fn(),
  fetchNewsArticle: vi.fn(),
  markNewsRead: vi.fn(),
  fetchSeasons: vi.fn(),
  fetchSeasonMeetings: vi.fn(),
  fetchChampionshipHub: vi.fn(),
}))

import {
  fetchNews,
  fetchNewsArticle,
  fetchSeasons,
  fetchSeasonMeetings,
  fetchChampionshipHub,
  markNewsRead,
} from '../api'

const mockFetchNews = vi.mocked(fetchNews)
const mockFetchNewsArticle = vi.mocked(fetchNewsArticle)
const mockFetchSeasons = vi.mocked(fetchSeasons)
const mockFetchSeasonMeetings = vi.mocked(fetchSeasonMeetings)
const mockFetchHub = vi.mocked(fetchChampionshipHub)
const mockMarkNewsRead = vi.mocked(markNewsRead)

const bahrain: Meeting = {
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
}

const monaco: Meeting = {
  meeting_key: 2,
  meeting_name: 'Monaco',
  meeting_official_name: 'Monaco GP',
  location: 'Monaco',
  country_name: 'Monaco',
  country_code: 'MON',
  country_flag: '',
  circuit_short_name: 'Monaco',
  date_start: '2025-05-23T00:00:00+00:00',
  date_end: '2025-05-25T23:59:59+00:00',
  year: 2025,
}

const drivers: ChampHubDriver[] = [
  {
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
  },
  {
    driver_number: 4,
    name_acronym: 'NOR',
    full_name: 'Lando Norris',
    team_name: 'McLaren',
    team_colour: 'ff8000',
    points: 80,
    position: 2,
    wins: 1,
    podiums: 4,
    poles: 1,
    form: [18, 25, 18],
    cumulative: [18, 36, 54, 80],
    teammate_wins: 3,
    teammate_losses: 2,
  },
]

const teams: ChampHubTeam[] = [
  { team_name: 'Red Bull', team_colour: '3671c6', points: 150, position: 1, wins: 4 },
  { team_name: 'McLaren', team_colour: 'ff8000', points: 120, position: 2, wins: 2 },
]

const hub: ChampionshipHub = {
  season: 2025,
  round: 2,
  total_rounds: 2,
  rounds_left: 0,
  last_race: 'Monaco GP',
  round_labels: ['R1', 'R2'],
  drivers,
  teams,
}

const newsItems: NewsItem[] = [
  {
    source: 'autosport-f1',
    title: 'Verstappen sets the pace in Bahrain',
    url: 'https://example.com/bahrain-ver',
    published_at: '2025-03-15T10:00:00Z',
    fetched_at: '2025-03-15T11:00:00Z',
    summary: 'Red Bull dominate opening practice',
  },
  {
    source: 'racefans-f1',
    title: 'Norris targets Monaco upgrade',
    url: 'https://example.com/monaco-nor',
    published_at: '2025-04-20T10:00:00Z',
    fetched_at: '2025-04-20T11:00:00Z',
    summary: 'McLaren bring new floor',
  },
  {
    source: 'bbc-f1',
    title: 'Undated paddock rumour',
    url: 'https://example.com/undated',
    fetched_at: '2025-04-21T11:00:00Z',
  },
]

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <BriefingPage />
    </QueryClientProvider>,
  )
}

describe('BriefingPage digest layout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2025-04-10T12:00:00Z'))
    mockFetchSeasons.mockResolvedValue([2025])
    mockFetchSeasonMeetings.mockResolvedValue([bahrain, monaco])
    mockFetchHub.mockResolvedValue(hub)
    mockFetchNews.mockResolvedValue(newsItems)
    mockFetchNewsArticle.mockResolvedValue({ title: 'Article', content: '<p>Body</p>' })
    mockMarkNewsRead.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders sticky since-last header, GP sections, and recent bucket', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('digest-sticky-header')).toHaveTextContent('Since Bahrain')
    })

    expect(screen.getByTestId('digest-window-2')).toHaveTextContent('Monaco')
    expect(screen.getByTestId('digest-window-1')).toHaveTextContent('Bahrain')
    expect(screen.getByTestId('digest-recent')).toHaveTextContent('Undated paddock rumour')
    expect(screen.getByText('Verstappen sets the pace in Bahrain')).toBeInTheDocument()
    expect(screen.getByText('Norris targets Monaco upgrade')).toBeInTheDocument()
  })

  it('filters the digest when a tag chip is clicked', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('digest-sticky-header')).toBeInTheDocument()
    })

    const sticky = screen.getByTestId('digest-sticky-header')
    const norTag = within(sticky).getByRole('button', { name: /^NOR$/i })
    fireEvent.click(norTag)

    await waitFor(() => {
      expect(screen.queryByText('Verstappen sets the pace in Bahrain')).not.toBeInTheDocument()
    })
    expect(screen.getByText('Norris targets Monaco upgrade')).toBeInTheDocument()
    expect(screen.getByTestId('digest-filter-clear')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('digest-filter-clear'))
    await waitFor(() => {
      expect(screen.getByText('Verstappen sets the pace in Bahrain')).toBeInTheDocument()
    })
  })

  it('preserves category tabs', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /All/i })).toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: /News/i })).toBeInTheDocument()
  })
})

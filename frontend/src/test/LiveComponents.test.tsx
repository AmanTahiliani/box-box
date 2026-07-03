import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { TrackStatusBanner } from '../components/live/TrackStatusBanner'
import { WeatherStrip } from '../components/live/WeatherStrip'
import { StintHistory } from '../components/live/StintHistory'
import { BattleChips } from '../components/live/BattleChips'
import { GapSparkline } from '../components/live/GapSparkline'
import { PinnedDrivers } from '../components/live/PinnedDrivers'
import { TimingTower } from '../components/live/TimingTower'
import { detectBattles } from '../lib/battles'
import type { LiveTimingRow } from '../lib/live'
import type { LiveDriverData, LiveWeatherData } from '../types'

function makeRow(
  number: string,
  position: number,
  tla: string,
  driver: Partial<LiveDriverData> = {},
): LiveTimingRow {
  return {
    RacingNumber: number,
    Position: position,
    Driver: {
      RacingNumber: number,
      Position: position,
      Interval: '',
      GapToLeader: '',
      LastLapTime: '1:14.000',
      BestLapTime: '1:13.500',
      NumberOfLaps: 10,
      InPit: false,
      PitOut: false,
      Retired: false,
      ...driver,
    } as LiveDriverData,
    Info: {
      RacingNumber: number,
      BroadcastName: '',
      Tla: tla,
      TeamName: '',
      TeamColour: '3671c6',
      FirstName: '',
      LastName: '',
    },
  }
}

describe('TrackStatusBanner', () => {
  it('renders a safety car banner for status 4', () => {
    render(<TrackStatusBanner status="4" />)
    const banner = screen.getByTestId('track-banner')
    expect(banner).toHaveClass('track-banner-sc')
    expect(banner).toHaveTextContent('SAFETY CAR')
  })

  it('renders a neutral banner for unknown statuses', () => {
    render(<TrackStatusBanner status="42" />)
    const banner = screen.getByTestId('track-banner')
    expect(banner).toHaveClass('track-banner-unknown')
    expect(banner).toHaveTextContent('TRACK STATUS 42')
  })

  it('renders nothing without a status', () => {
    render(<TrackStatusBanner status="" />)
    expect(screen.queryByTestId('track-banner')).not.toBeInTheDocument()
  })
})

describe('WeatherStrip', () => {
  const weather: LiveWeatherData = {
    AirTemp: 21.4,
    TrackTemp: 34.8,
    Humidity: 58,
    WindSpeed: 2.3,
    WindDir: 180,
    Rainfall: true,
  }

  it('renders all populated weather fields', () => {
    render(<WeatherStrip weather={weather} />)
    const strip = screen.getByTestId('weather-strip')
    expect(strip).toHaveTextContent('21°C')
    expect(strip).toHaveTextContent('35°C')
    expect(strip).toHaveTextContent('58%')
    expect(strip).toHaveTextContent('2.3 m/s S')
    expect(strip).toHaveTextContent('RAIN')
  })

  it('hides gracefully when the payload is empty', () => {
    render(
      <WeatherStrip
        weather={{ AirTemp: 0, TrackTemp: 0, Humidity: 0, WindSpeed: 0, WindDir: 0, Rainfall: false }}
      />,
    )
    expect(screen.queryByTestId('weather-strip')).not.toBeInTheDocument()
  })

  it('hides when weather is missing entirely', () => {
    render(<WeatherStrip weather={undefined} />)
    expect(screen.queryByTestId('weather-strip')).not.toBeInTheDocument()
  })
})

describe('StintHistory', () => {
  it('renders the compound sequence with lap counts', () => {
    render(
      <StintHistory
        stints={[
          { Compound: 'MEDIUM', New: true, Laps: 12 },
          { Compound: 'HARD', New: false, Laps: 20 },
        ]}
      />,
    )
    const seq = screen.getByTestId('stint-seq')
    expect(seq).toHaveTextContent('M')
    expect(seq).toHaveTextContent('12')
    expect(seq).toHaveTextContent('H')
    expect(seq).toHaveTextContent('20')
  })

  it('renders a dash without stint data', () => {
    render(<StintHistory stints={undefined} />)
    expect(screen.getByText('-')).toBeInTheDocument()
  })
})

describe('GapSparkline', () => {
  it('shows a placeholder with too few samples', () => {
    render(<GapSparkline samples={[1.0]} />)
    expect(screen.queryByTestId('gap-spark')).not.toBeInTheDocument()
  })

  it('renders a closing indicator when the gap shrinks', () => {
    render(<GapSparkline samples={[2.0, 1.8, 1.5, 1.2, 0.9, 0.6]} />)
    expect(screen.getByTestId('gap-spark')).toHaveClass('trend-closing')
    expect(screen.getByTitle('Gap closing')).toBeInTheDocument()
  })
})

describe('BattleChips', () => {
  it('renders chip labels for detected battles', () => {
    const battles = detectBattles(
      [makeRow('1', 1, 'VER'), makeRow('4', 2, 'NOR', { Interval: '+0.4' })],
      'Race',
    )
    render(<BattleChips battles={battles} />)
    expect(screen.getByTestId('battle-chips')).toHaveTextContent('VER ⚔ NOR +0.4')
  })

  it('renders nothing when there are no battles', () => {
    render(<BattleChips battles={[]} />)
    expect(screen.queryByTestId('battle-chips')).not.toBeInTheDocument()
  })
})

describe('TimingTower', () => {
  const rows = [
    makeRow('1', 1, 'VER'),
    makeRow('4', 2, 'NOR', { Interval: '+0.4', GapToLeader: '+0.4' }),
    makeRow('16', 3, 'LEC', { Interval: '+3.2', GapToLeader: '+3.6' }),
  ]

  it('highlights battle rows and marks pinned drivers', () => {
    render(
      <TimingTower
        rows={rows}
        battleNumbers={new Set(['1', '4'])}
        pinned={['16']}
        onTogglePin={() => {}}
      />,
    )
    expect(screen.getByText('VER').closest('tr')).toHaveClass('battle-row')
    expect(screen.getByText('NOR').closest('tr')).toHaveClass('battle-row')
    const lecRow = screen.getByText('LEC').closest('tr')
    expect(lecRow).not.toHaveClass('battle-row')
    expect(lecRow).toHaveClass('pinned-row')
  })

  it('toggles a pin when the pin button is clicked', () => {
    const onTogglePin = vi.fn()
    render(<TimingTower rows={rows} onTogglePin={onTogglePin} />)
    fireEvent.click(screen.getByText('NOR').closest('tr')!.querySelector('.pin-btn')!)
    expect(onTogglePin).toHaveBeenCalledWith('4')
  })

  it('shows an empty notice without rows', () => {
    render(<TimingTower rows={[]} />)
    expect(screen.getByText(/no driver timing rows/i)).toBeInTheDocument()
  })
})

describe('PinnedDrivers', () => {
  it('renders pinned cards with gap and unpins on click', () => {
    const onToggle = vi.fn()
    render(
      <PinnedDrivers
        rows={[makeRow('4', 2, 'NOR', { Interval: '+0.4' })]}
        history={{ '4': [1.0, 0.8, 0.6, 0.4] }}
        pinned={['4']}
        onToggle={onToggle}
      />,
    )
    const strip = screen.getByTestId('pinned-strip')
    expect(strip).toHaveTextContent('NOR')
    expect(strip).toHaveTextContent('+0.4')
    fireEvent.click(screen.getByText('NOR').closest('button')!)
    expect(onToggle).toHaveBeenCalledWith('4')
  })

  it('renders a fallback card when the driver is missing from the feed', () => {
    render(
      <PinnedDrivers rows={[]} history={{}} pinned={['44']} onToggle={() => {}} />,
    )
    expect(screen.getByTestId('pinned-strip')).toHaveTextContent('no data')
  })

  it('renders nothing without pins', () => {
    render(<PinnedDrivers rows={[]} history={{}} pinned={[]} onToggle={() => {}} />)
    expect(screen.queryByTestId('pinned-strip')).not.toBeInTheDocument()
  })
})

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WeatherView } from '../components/WeatherView'
import type { WeatherSample } from '../types'

const weather: WeatherSample[] = [
  {
    session_key: 9472,
    meeting_key: 1229,
    date: '2025-05-25T13:00:00Z',
    air_temperature: 20,
    track_temperature: 30,
    humidity: 60,
    pressure: 1010,
    rainfall: 0,
    wind_direction: 180,
    wind_speed: 2,
  },
  {
    session_key: 9472,
    meeting_key: 1229,
    date: '2025-05-25T13:05:00Z',
    air_temperature: 21,
    track_temperature: 33,
    humidity: 62,
    pressure: 1011,
    rainfall: 0.2,
    wind_direction: 190,
    wind_speed: 3,
  },
]

describe('WeatherView', () => {
  it('renders weather summary and recent samples', () => {
    render(<WeatherView weather={weather} />)

    expect(screen.getByTestId('weather-view')).toBeInTheDocument()
    expect(screen.getByText('Avg air / track')).toBeInTheDocument()
    expect(screen.getByText('20.5C / 31.5C')).toBeInTheDocument()
    expect(screen.getByText('Rain samples')).toBeInTheDocument()
    expect(screen.getByText('0.2')).toBeInTheDocument()
  })

  it('shows a missing-data state when no weather samples are present', () => {
    render(<WeatherView weather={[]} />)

    expect(screen.getByText(/Weather samples not ingested/i)).toBeInTheDocument()
  })
})

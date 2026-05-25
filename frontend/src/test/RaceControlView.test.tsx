import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RaceControlView } from '../components/RaceControlView'
import type { RaceControlMessage } from '../types'

const messages: RaceControlMessage[] = [
  {
    session_key: 9472,
    meeting_key: 1229,
    date: '2025-05-25T13:10:00Z',
    category: 'Flag',
    flag: 'YELLOW',
    message: 'Yellow flag in sector 2',
    scope: 'Sector',
    driver_number: null,
    lap_number: 6,
    sector: 2,
    qualifying_phase: null,
  },
  {
    session_key: 9472,
    meeting_key: 1229,
    date: '2025-05-25T13:12:00Z',
    category: 'Other',
    flag: '',
    message: 'Car 44 noted for track limits',
    scope: 'Driver',
    driver_number: 44,
    lap_number: 8,
    sector: null,
    qualifying_phase: null,
  },
]

describe('RaceControlView', () => {
  it('renders race-control messages from the payload array', () => {
    render(<RaceControlView messages={messages} />)

    expect(screen.getByTestId('race-control-view')).toBeInTheDocument()
    expect(screen.getByText('YELLOW')).toBeInTheDocument()
    expect(screen.getByText('Yellow flag in sector 2')).toBeInTheDocument()
    expect(screen.getByText('Car 44 noted for track limits')).toBeInTheDocument()
  })

  it('shows a missing-data state when no messages are present', () => {
    render(<RaceControlView messages={[]} />)

    expect(screen.getByText(/Race control messages not ingested/i)).toBeInTheDocument()
  })
})

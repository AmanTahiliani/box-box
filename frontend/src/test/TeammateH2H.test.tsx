import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TeammateH2H } from '../components/TeammateH2H'

describe('TeammateH2H', () => {
  it('renders score and TLAs', () => {
    render(
      <TeammateH2H
        teamName="Red Bull"
        teamColour="3671c6"
        driverATla="VER"
        driverBTla="PER"
        winsA={9}
        winsB={1}
      />,
    )
    expect(screen.getByText('VER')).toBeInTheDocument()
    expect(screen.getByText('PER')).toBeInTheDocument()
    expect(screen.getByTestId('h2h-score')).toHaveTextContent('9–1')
    expect(screen.getByText('Red Bull')).toBeInTheDocument()
  })

  it('sets proportional bar segment widths from wins', () => {
    render(
      <TeammateH2H
        teamName="McLaren"
        teamColour="ff8000"
        driverATla="NOR"
        driverBTla="PIA"
        winsA={6}
        winsB={4}
      />,
    )
    const barA = screen.getByTestId('h2h-bar-a')
    const barB = screen.getByTestId('h2h-bar-b')
    expect(barA).toHaveStyle({ width: '60%' })
    expect(barB).toHaveStyle({ width: '40%' })
  })

  it('shows extra driver note when provided', () => {
    render(
      <TeammateH2H
        teamName="Red Bull"
        teamColour="3671c6"
        driverATla="VER"
        driverBTla="PER"
        winsA={5}
        winsB={3}
        extraNote="+1"
      />,
    )
    expect(screen.getByText('+1')).toBeInTheDocument()
  })
})

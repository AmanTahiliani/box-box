import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Meaning } from '../components/Meaning'

describe('Meaning', () => {
  it('renders bare value when meaning is null', () => {
    render(<Meaning value="+1.234" meaning={null} />)
    expect(screen.getByText('+1.234')).toBeInTheDocument()
    expect(screen.queryByText('DRS range')).not.toBeInTheDocument()
  })

  it('renders value with caption and tooltip title', () => {
    render(
      <Meaning
        value="+0.4"
        meaning="DRS range"
        title="Within 1.0s — DRS enabled next straight"
        tone="good"
      />,
    )
    const value = screen.getByText('+0.4')
    expect(value).toBeInTheDocument()
    expect(screen.getByText('DRS range')).toHaveClass('meaning-caption--good')
    expect(value.closest('.meaning')).toHaveAttribute('title', 'Within 1.0s — DRS enabled next straight')
  })
})

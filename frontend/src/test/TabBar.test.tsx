import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from '../components/TabBar'

describe('TabBar', () => {
  it('renders all Race Hub tabs', () => {
    render(<TabBar active="results" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Results' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Grid' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Strategy' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Positions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Laps' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Race Control' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Weather' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Datasets' })).toBeInTheDocument()
  })

  it('marks the active tab with aria-selected', () => {
    render(<TabBar active="grid" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Grid' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Results' })).toHaveAttribute('aria-selected', 'false')
  })

  it('applies active class only to the active tab', () => {
    render(<TabBar active="strategy" onChange={() => {}} />)
    const strategy = screen.getByRole('tab', { name: 'Strategy' })
    const results = screen.getByRole('tab', { name: 'Results' })
    expect(strategy.className).toContain('active')
    expect(results.className).not.toContain('active')
  })

  it('calls onChange with the correct tab id when clicked', () => {
    const onChange = vi.fn()
    render(<TabBar active="results" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Race Control' }))
    expect(onChange).toHaveBeenCalledWith('race_control')
  })
})

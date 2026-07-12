import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from '../components/TabBar'

describe('TabBar', () => {
  it('renders all Race Hub workspace tabs grouped into a hierarchy', () => {
    render(<TabBar active="overview" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Race Story' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Strategy' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Compare' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lap Data' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Conditions' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Race Control' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Diagnostics' })).toBeInTheDocument()

    expect(screen.getByTestId('rh-tabgroup-story')).toBeInTheDocument()
    expect(screen.getByTestId('rh-tabgroup-analysis')).toBeInTheDocument()
    expect(screen.getByTestId('rh-tabgroup-context')).toBeInTheDocument()
  })

  it('marks the active tab with aria-selected', () => {
    render(<TabBar active="strategy" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Strategy' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false')
  })

  it('applies active class only to the active tab', () => {
    render(<TabBar active="conditions" onChange={() => {}} />)
    const active = screen.getByRole('tab', { name: 'Conditions' })
    const inactive = screen.getByRole('tab', { name: 'Overview' })
    expect(active.className).toContain('active')
    expect(inactive.className).not.toContain('active')
  })

  it('calls onChange with the correct tab id when clicked', () => {
    const onChange = vi.fn()
    render(<TabBar active="overview" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Race Control' }))
    expect(onChange).toHaveBeenCalledWith('race_control')
  })
})

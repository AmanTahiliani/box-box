import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CliCommands, ingestMeetingCommands, ingestSessionCommands } from '../components/CliCommands'

describe('CliCommands', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders commands with comments', () => {
    render(
      <CliCommands
        commands={[{ comment: '# test', cmd: 'box-box --ingest-year 2025' }]}
      />,
    )
    expect(screen.getByText('# test')).toBeInTheDocument()
    expect(screen.getByText('box-box --ingest-year 2025')).toBeInTheDocument()
  })

  it('copies command on button click', async () => {
    render(<CliCommands commands={[{ cmd: 'box-box --ingest-session 9472' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Copy/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('box-box --ingest-session 9472')
    expect(await screen.findByText('Copied')).toBeInTheDocument()
  })

  it('builds meeting ingest commands', () => {
    const cmds = ingestMeetingCommands(1229)
    expect(cmds[0].cmd).toBe('box-box --ingest-meeting 1229')
    expect(cmds[1].cmd).toBe('box-box --ingest-meeting 1229 --dry-run')
  })

  it('builds session ingest commands', () => {
    const cmds = ingestSessionCommands(9472)
    expect(cmds[0].cmd).toBe('box-box --ingest-session 9472')
  })
})

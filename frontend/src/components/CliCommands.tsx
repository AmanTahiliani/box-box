import { useState } from 'react'

interface Command {
  comment?: string
  cmd: string
}

interface Props {
  commands: Command[]
}

export function CliCommands({ commands }: Props) {
  return (
    <div className="cli-block" data-testid="cli-commands">
      {commands.map(({ comment, cmd }, i) => (
        <div key={cmd} className="cli-entry">
          {comment && <div className="cli-comment">{comment}</div>}
          <CliCommandLine cmd={cmd} />
          {i < commands.length - 1 && <div className="cli-spacer" />}
        </div>
      ))}
    </div>
  )
}

function CliCommandLine({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard may be unavailable in tests
    }
  }

  return (
    <div className="cli-cmd-row">
      <code className="cli-cmd">{cmd}</code>
      <button type="button" className="cli-copy-btn" onClick={handleCopy} aria-label={`Copy ${cmd}`}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export function ingestYearCommands(year: number): Command[] {
  return [
    { comment: '# Discover season meetings and sessions', cmd: `box-box --ingest-year ${year}` },
    { comment: '# Preview season discovery only', cmd: `box-box --ingest-year ${year} --dry-run` },
  ]
}

export function ingestMeetingCommands(meetingKey: number): Command[] {
  return [
    { comment: '# Full weekend ingest (all sessions)', cmd: `box-box --ingest-meeting ${meetingKey}` },
    { comment: '# Preview without downloading', cmd: `box-box --ingest-meeting ${meetingKey} --dry-run` },
  ]
}

export function ingestSessionCommands(sessionKey: number): Command[] {
  return [{ comment: '# Race Hub datasets for one session', cmd: `box-box --ingest-session ${sessionKey}` }]
}

import { RACE_HUB_DATASETS, formatCoverageHint } from '../lib/coverage'
import { SourceBadge } from './SourceBadge'
import { SessionCoverageDots } from './SessionCoverageDots'
import {
  CliCommands,
  ingestMeetingCommands,
  ingestSessionCommands,
} from './CliCommands'
import type { Weekend, WeekendSession } from '../types'

interface Props {
  weekend: Weekend
}

export function MeetingDetailPanel({ weekend }: Props) {
  const { meeting, sessions, source } = weekend

  return (
    <div className="dl-detail" data-testid="meeting-detail">
      <div className="detail-header">
        <div className="detail-header-row">
          <span className="detail-title">{meeting.meeting_name}</span>
          <SourceBadge source={source} label={source === 'local' ? 'Full' : undefined} />
        </div>
        <div className="detail-meta">
          {meeting.country_name} · meeting_key {meeting.meeting_key}
        </div>
        <div className="detail-meta">
          {sessions.length} session{sessions.length === 1 ? '' : 's'} stored locally
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="missing-notice">
          No sessions ingested for this meeting. Run{' '}
          <code>box-box --ingest-meeting {meeting.meeting_key}</code>
        </div>
      ) : (
        sessions.map((entry) => (
          <SessionDetailBlock key={entry.session.session_key} entry={entry} />
        ))
      )}

      <div className="dl-cli-section">
        <div className="sec-header">
          <span className="sec-title">Ingest Commands</span>
        </div>
        <CliCommands commands={ingestMeetingCommands(meeting.meeting_key)} />
      </div>
    </div>
  )
}

function SessionDetailBlock({ entry }: { entry: WeekendSession }) {
  const { session, source, datasets } = entry
  const coverage = formatCoverageHint(datasets)

  return (
    <div className="session-detail-row" data-testid={`session-detail-${session.session_key}`}>
      <div className="session-detail-head">
        <SourceBadge source={source} />
        <span>{session.session_name}</span>
        <span className="session-detail-key mono">{session.session_key}</span>
        <span className="session-detail-coverage mono">{coverage}</span>
        <SessionCoverageDots datasets={datasets} />
      </div>

      <table className="data-table ds-detail-table">
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Status</th>
            <th className="r">Records</th>
          </tr>
        </thead>
        <tbody>
          {RACE_HUB_DATASETS.map((key) => {
            const info = datasets[key]
            const available = info?.status === 'available'
            return (
              <tr key={key}>
                <td className="mono" style={{ color: 'var(--text-2)' }}>
                  {key}
                </td>
                 <td>
                  {info?.status === 'available' ? (
                    <span className="badge badge-local">Local</span>
                  ) : info?.status === 'skipped' ? (
                    <span className="badge badge-none">N/A</span>
                  ) : (
                    <span className="badge badge-none">Missing</span>
                  )}
                </td>
                <td className="r mono" style={{ color: 'var(--text-3)' }}>
                  {info?.count != null ? info.count : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="session-cli">
        <CliCommands commands={ingestSessionCommands(session.session_key)} />
      </div>
    </div>
  )
}

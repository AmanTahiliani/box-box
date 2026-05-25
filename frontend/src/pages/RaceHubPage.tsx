import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { fetchRaceHub } from '../api'
import { RaceHubHeader } from '../components/RaceHubHeader'
import { DatasetStrip } from '../components/DatasetStrip'
import { ClassificationTable } from '../components/ClassificationTable'
import { StartingGridTable } from '../components/StartingGridTable'

interface Props {
  sessionKey: number
}

export function RaceHubPage({ sessionKey }: Props) {
  const navigate = useNavigate()
  const [inputVal, setInputVal] = useState(sessionKey > 0 ? String(sessionKey) : '')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['race-hub', sessionKey],
    queryFn: () => fetchRaceHub(sessionKey),
    enabled: sessionKey > 0,
    staleTime: 30_000,
  })

  function handleLoad(e: React.FormEvent) {
    e.preventDefault()
    const key = parseInt(inputVal, 10)
    if (key > 0) {
      navigate({ to: '/race-hub', search: { session_key: key } })
    }
  }

  return (
    <div className="page">
      {/* Session key input */}
      <form className="session-bar" onSubmit={handleLoad}>
        <label htmlFor="sk-input">Session Key</label>
        <input
          id="sk-input"
          type="number"
          placeholder="e.g. 9472"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <button type="submit">Load</button>
        {sessionKey > 0 && (
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-3)' }}>
            key {sessionKey}
          </span>
        )}
      </form>

      {/* Prompt when no key entered */}
      {sessionKey === 0 && (
        <div className="empty-state">
          <div className="empty-state-title">Enter a session key to load Race Hub data</div>
          <div className="empty-state-desc">
            Example: <code>9472</code> (Monaco GP 2025 Race)<br />
            Ingest data first with{' '}
            <code>box-box --ingest-session &lt;key&gt;</code>
          </div>
        </div>
      )}

      {/* Loading */}
      {sessionKey > 0 && isLoading && (
        <div className="loading-state">loading session {sessionKey}…</div>
      )}

      {/* Error */}
      {isError && (
        <div className="error-box">
          {error instanceof Error ? error.message : 'Failed to load race hub data'}
        </div>
      )}

      {/* Data */}
      {data && (
        <>
          <RaceHubHeader
            meeting={data.meeting}
            session={data.session}
            source={data.source}
          />

          <DatasetStrip datasets={data.datasets} />

          <div className="data-section">
            <div className="sec-header">
              <span className="sec-title">Final Classification</span>
              {data.results.length > 0 && (
                <span className="sec-meta">{data.results.length} drivers</span>
              )}
            </div>
            <ClassificationTable results={data.results} grid={data.starting_grid} />
          </div>

          <div className="data-section">
            <div className="sec-header">
              <span className="sec-title">Starting Grid</span>
              {data.starting_grid.length > 0 && (
                <span className="sec-meta">{data.starting_grid.length} positions</span>
              )}
            </div>
            <StartingGridTable grid={data.starting_grid} />
          </div>
        </>
      )}
    </div>
  )
}

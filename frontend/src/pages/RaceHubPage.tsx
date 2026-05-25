import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { fetchRaceHub } from '../api'
import { LocalDataNavigator } from '../components/LocalDataNavigator'
import { RaceHubHeader } from '../components/RaceHubHeader'
import { DatasetStrip } from '../components/DatasetStrip'
import { ClassificationTable } from '../components/ClassificationTable'
import { StartingGridTable } from '../components/StartingGridTable'
import { TabBar, type Tab } from '../components/TabBar'
import { DatasetStatusView } from '../components/DatasetStatusView'
import { StrategyView } from '../components/StrategyView'
import { PositionEvolutionView } from '../components/PositionEvolutionView'
import { LapsView } from '../components/LapsView'
import { RaceControlView } from '../components/RaceControlView'
import { WeatherView } from '../components/WeatherView'

interface Props {
  sessionKey: number
}

export function RaceHubPage({ sessionKey }: Props) {
  const navigate = useNavigate()
  const [inputVal, setInputVal] = useState(sessionKey > 0 ? String(sessionKey) : '')
  const [activeTab, setActiveTab] = useState<Tab>('results')

  useEffect(() => {
    setInputVal(sessionKey > 0 ? String(sessionKey) : '')
  }, [sessionKey])

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

      {/* Local data browser when no session loaded */}
      {sessionKey === 0 && <LocalDataNavigator />}

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

          <TabBar active={activeTab} onChange={setActiveTab} />

          {activeTab === 'results' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Final Classification</span>
                {data.results.length > 0 && (
                  <span className="sec-meta">{data.results.length} drivers</span>
                )}
              </div>
              <ClassificationTable results={data.results} grid={data.starting_grid} />
            </div>
          )}

          {activeTab === 'grid' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Starting Grid</span>
                {data.starting_grid.length > 0 && (
                  <span className="sec-meta">{data.starting_grid.length} positions</span>
                )}
              </div>
              <StartingGridTable grid={data.starting_grid} />
            </div>
          )}

          {activeTab === 'strategy' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Race Strategy</span>
              </div>
              <StrategyView
                results={data.results}
                stints={data.stints}
                pit_stops={data.pit_stops}
                hasStints={data.datasets['stints']?.status === 'available'}
              />
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Position Evolution</span>
              </div>
              <PositionEvolutionView
                results={data.results}
                grid={data.starting_grid}
                positions={data.positions}
                laps={data.laps}
                hasPositions={data.datasets['positions']?.status === 'available'}
              />
            </div>
          )}

          {activeTab === 'laps' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Laps</span>
                {data.laps.length > 0 && (
                  <span className="sec-meta">{data.laps.length} samples</span>
                )}
              </div>
              <LapsView laps={data.laps} />
            </div>
          )}

          {activeTab === 'race_control' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Race Control</span>
                {data.race_control.length > 0 && (
                  <span className="sec-meta">{data.race_control.length} messages</span>
                )}
              </div>
              <RaceControlView messages={data.race_control} />
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Weather</span>
                {data.weather.length > 0 && (
                  <span className="sec-meta">{data.weather.length} samples</span>
                )}
              </div>
              <WeatherView weather={data.weather} />
            </div>
          )}

          {activeTab === 'datasets' && (
            <div className="data-section">
              <div className="sec-header">
                <span className="sec-title">Dataset Status</span>
              </div>
              <DatasetStatusView datasets={data.datasets} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveState } from '../api'
import type { LiveStreamData } from '../types'
import {
  loadPinnedDrivers,
  parseLiveStateEvent,
  savePinnedDrivers,
  sortLiveTimingRows,
  togglePin,
} from '../lib/live'
import type { GapHistoryMap } from '../lib/gapHistory'
import { recordGapSamples } from '../lib/gapHistory'
import { battleNumbers, detectBattles } from '../lib/battles'
import { SessionBanner } from '../components/live/SessionBanner'
import { TrackStatusBanner } from '../components/live/TrackStatusBanner'
import { TimingTower } from '../components/live/TimingTower'
import { BattleChips } from '../components/live/BattleChips'
import { PinnedDrivers } from '../components/live/PinnedDrivers'
import { RaceControlFeed } from '../components/live/RaceControlFeed'
import { Radio } from 'lucide-react'

type StreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function LiveTimingPage() {
  const [snapshot, setSnapshot] = useState<LiveStreamData | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting')
  const [now, setNow] = useState(Date.now())
  const [gapHistory, setGapHistory] = useState<GapHistoryMap>({})
  const [pinned, setPinned] = useState<string[]>(() => loadPinnedDrivers())

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['live-state'],
    queryFn: fetchLiveState,
    staleTime: 5_000,
  })

  useEffect(() => {
    if (!data) return
    setIsLive(data.is_live)
    setSnapshot(data.data)
  }, [data])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!('EventSource' in window)) {
      setStreamStatus('error')
      return
    }

    let cancelled = false
    const events = new EventSource('/api/v1/live/stream')
    setStreamStatus('connecting')

    events.onopen = () => {
      if (!cancelled) setStreamStatus('connected')
    }

    events.addEventListener('snapshot', (event) => {
      const state = parseLiveStateEvent(event.data)
      if (!state || cancelled) return
      setIsLive(state.is_live)
      setSnapshot(state.data)
      setStreamStatus('connected')
    })

    events.addEventListener('heartbeat', () => {
      if (!cancelled) setStreamStatus('connected')
    })

    events.onerror = () => {
      if (!cancelled) setStreamStatus('disconnected')
    }

    return () => {
      cancelled = true
      events.close()
    }
  }, [])

  const rows = useMemo(() => sortLiveTimingRows(snapshot), [snapshot])

  // One interval sample per received snapshot, ring-buffered per driver.
  useEffect(() => {
    if (rows.length === 0) return
    setGapHistory((prev) =>
      recordGapSamples(
        prev,
        rows.map((row) => ({ racingNumber: row.RacingNumber, interval: row.Driver.Interval || '' })),
      ),
    )
  }, [rows])

  useEffect(() => {
    savePinnedDrivers(pinned)
  }, [pinned])

  const battles = useMemo(
    () => detectBattles(rows, snapshot?.Session?.SessionType),
    [rows, snapshot?.Session?.SessionType],
  )
  const inBattle = useMemo(() => battleNumbers(battles), [battles])

  const handleTogglePin = (racingNumber: string) => {
    setPinned((prev) => togglePin(prev, racingNumber))
  }

  return (
    <div className="page live-page" data-testid="live-page">
      {isError && (
        <div className="error-box">
          {error instanceof Error ? error.message : 'Failed to load live timing state'}
        </div>
      )}

      {streamStatus === 'disconnected' && snapshot && (
        <div className="live-status-strip live-status-warn">
          Stream disconnected — showing last received snapshot
        </div>
      )}

      {isLoading && !snapshot && (
        <div className="loading-state">connecting to live timing…</div>
      )}

      {!isLoading && !snapshot && (
        <div className="empty-state ui-card glass-panel" style={{ padding: '40px', textAlign: 'center', marginTop: '20vh', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }} data-testid="live-empty">
          <div className="live-empty-status" style={{ marginBottom: '16px' }}>
            <span className={`live-conn live-conn-${streamStatus}`}>{streamStatus}</span>
          </div>
          <Radio size={48} style={{ color: 'var(--text-3)', margin: '0 auto 16px auto', display: 'block' }} />
          <h2 className="empty-state-title" style={{ fontSize: '20px', marginBottom: '8px' }}>No live session active</h2>
          <p className="empty-state-desc" style={{ color: 'var(--text-2)' }}>
            The telemetry feed is currently offline. <br /><br /> Check the <a href="/" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Command Center</a> for the weekend schedule or explore historical data in the <a href="/race-hub" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Race Hub</a>.
          </p>
        </div>
      )}

      {snapshot && (
        <>
          <SessionBanner isLive={isLive} snapshot={snapshot} connection={streamStatus} now={now} />
          <TrackStatusBanner status={snapshot.TrackStatus} />
          <PinnedDrivers rows={rows} history={gapHistory} pinned={pinned} onToggle={handleTogglePin} />
          <div className="live-columns">
            <div className="live-tower-col">
              <div className="sec-header">
                <span className="sec-title">Timing Tower</span>
                {pinned.length > 0 && <span className="sec-meta">{pinned.length}/3 pinned</span>}
              </div>
              <BattleChips battles={battles} />
              <TimingTower
                rows={rows}
                stints={snapshot.Stints}
                history={gapHistory}
                battleNumbers={inBattle}
                pinned={pinned}
                onTogglePin={handleTogglePin}
                sessionType={snapshot.Session?.SessionType}
              />
            </div>
            <div className="live-rc-col">
              <RaceControlFeed messages={snapshot.RCMessages ?? []} driverInfo={snapshot.DriverInfo} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveState } from '../api'
import type { LiveStreamData } from '../types'
import { parseLiveStateEvent } from '../lib/live'
import { SessionBanner } from '../components/live/SessionBanner'
import { TimingTower } from '../components/live/TimingTower'
import { RaceControlFeed } from '../components/live/RaceControlFeed'

type StreamStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export function LiveTimingPage() {
  const [snapshot, setSnapshot] = useState<LiveStreamData | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting')
  const [now, setNow] = useState(Date.now())

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
        <div className="empty-state" data-testid="live-empty">
          <div className="live-empty-status">
            <span className={`live-conn live-conn-${streamStatus}`}>{streamStatus}</span>
          </div>
          <div className="empty-state-title">No live session active</div>
          <div className="empty-state-desc">
            No timing data in the current snapshot. The feed will update automatically when an F1 session goes live.
          </div>
        </div>
      )}

      {snapshot && (
        <>
          <SessionBanner isLive={isLive} snapshot={snapshot} connection={streamStatus} now={now} />
          <div className="live-columns">
            <div className="live-tower-col">
              <div className="sec-header">
                <span className="sec-title">Timing Tower</span>
              </div>
              <TimingTower snapshot={snapshot} />
            </div>
            <div className="live-rc-col">
              <RaceControlFeed messages={snapshot.RCMessages ?? []} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

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
    <div className="page live-page">
      {isError && (
        <div className="error-box">
          {error instanceof Error ? error.message : 'Failed to load live timing state'}
        </div>
      )}

      {streamStatus === 'disconnected' && (
        <div className="missing-notice">Live stream disconnected. Showing the last received snapshot.</div>
      )}

      {isLoading && !snapshot && <div className="loading-state">connecting to live timing…</div>}

      {!isLoading && !snapshot && (
        <div className="empty-state">
          <div className="empty-state-title">No live session active</div>
          <div className="empty-state-desc">Check back during an F1 race weekend.</div>
        </div>
      )}

      {snapshot && (
        <>
          <SessionBanner isLive={isLive} snapshot={snapshot} connection={streamStatus} now={now} />
          <div className="data-section">
            <div className="sec-header">
              <span className="sec-title">Timing Tower</span>
            </div>
            <TimingTower snapshot={snapshot} />
          </div>
          <RaceControlFeed messages={snapshot.RCMessages ?? []} />
        </>
      )}
    </div>
  )
}

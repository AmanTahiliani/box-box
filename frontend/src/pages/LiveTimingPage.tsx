import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLiveState, fetchWeekendContext } from '../api'
import type { LivePosition, LiveStreamData } from '../types'
import {
  loadPinnedDrivers,
  mergeVisibleSectors,
  parseLiveStateEvent,
  rowsWithVisibleSectors,
  savePinnedDrivers,
  sortLiveTimingRows,
  togglePin,
} from '../lib/live'
import type { VisibleSectorState } from '../lib/live'
import type { GapHistoryMap } from '../lib/gapHistory'
import { recordGapSamples } from '../lib/gapHistory'
import { battleNumbers, detectBattles } from '../lib/battles'
import type { LiveEvent } from '../lib/events'
import { appendEvents, diffSnapshots, sessionSignature } from '../lib/events'
import {
  allowsLiveInterpretations,
  deriveLivePhase,
  effectiveFeedHealth,
  rendersSnapshot,
  terminalSessionStatus,
} from '../lib/liveState'
import type { TransportHealth } from '../lib/liveState'
import { shouldPollHandoffAnalysis } from '../components/live/LiveHandoff'
import { SessionBanner } from '../components/live/SessionBanner'
import { TrackStatusBanner } from '../components/live/TrackStatusBanner'
import { TimingTower } from '../components/live/TimingTower'
import { BattleChips } from '../components/live/BattleChips'
import { PinnedDrivers } from '../components/live/PinnedDrivers'
import { RaceControlFeed } from '../components/live/RaceControlFeed'
import { EventRail } from '../components/live/EventRail'
import { TeamRadioTicker } from '../components/live/TeamRadioTicker'
import { TyreDegPanel } from '../components/live/TyreDegPanel'
import { LiveHandoff } from '../components/live/LiveHandoff'
import '../styles/live-state.css'

/** How often to re-check weekend-context while analysis is still ingesting. */
export const WEEKEND_CONTEXT_POLL_MS = 15_000
const WEEKEND_CONTEXT_STALE_MS = 15_000

export function LiveTimingPage() {
  const [activeSnapshot, setActiveSnapshot] = useState<LiveStreamData | null>(null)
  const [archiveSnapshot, setArchiveSnapshot] = useState<LiveStreamData | null>(null)
  const [archivePositions, setArchivePositions] = useState<Record<string, LivePosition>>({})
  const [archiveSnapshotAt, setArchiveSnapshotAt] = useState<string | null>(null)
  const [archiveMode, setArchiveMode] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [streamStatus, setStreamStatus] = useState<TransportHealth>('connecting')
  const [now, setNow] = useState(Date.now())
  const [gapHistory, setGapHistory] = useState<GapHistoryMap>({})
  const [pinned, setPinned] = useState<string[]>(() => loadPinnedDrivers())
  const [visibleSectors, setVisibleSectors] = useState<VisibleSectorState>({})
  const [, setPositions] = useState<Record<string, LivePosition>>({})
  const [events, setEvents] = useState<LiveEvent[]>([])
  const prevSnapshotRef = useRef<LiveStreamData | null>(null)
  const sessionSigRef = useRef('')
  const isLiveRef = useRef(false)
  const archiveModeRef = useRef(false)
  // Whether we ever observed this session as live — used to reason about a
  // dropped feed vs. a session that was never live in this page session.
  const wasLiveRef = useRef(false)
  const hasArchive = Boolean(archiveSnapshot)

  const {
    data,
    isError,
    error,
    isFetched: liveStateFetched,
  } = useQuery({
    queryKey: ['live-state'],
    queryFn: fetchLiveState,
    staleTime: 5_000,
  })

  // A retained snapshot is only "settled" (session genuinely finished) if it
  // carries a terminal FIA SessionStatus. Otherwise the upstream feed dropped
  // while the session was still active and we must stay in `disconnected`.
  const sessionEndedCleanly = terminalSessionStatus(archiveSnapshot?.SessionStatus)

  // Transport health, active-session state, and archive availability are
  // orthogonal inputs; deriveLivePhase collapses them into one UI phase.
  const phase = deriveLivePhase({
    transport: streamStatus,
    isLive,
    hasActiveSnapshot: Boolean(activeSnapshot),
    hasArchive,
    archiveMode,
    sessionEndedCleanly,
    wasLive: wasLiveRef.current,
    stateLoaded: liveStateFetched,
  })
  const snapshot =
    phase === 'archive'
      ? archiveSnapshot
      : isLive
        ? activeSnapshot
        : phase === 'disconnected'
          ? archiveSnapshot
          : null

  // Canonical weekend context (issue #72) — the single source of truth for
  // previous/next/default-analysis identity and temporal state. Only needed
  // when no session is streaming; keep it idle during a live session. Poll
  // while a completed session is still ingesting so `settling` can flip to
  // analysis-ready without a manual refresh.
  const contextQuery = useQuery({
    queryKey: ['weekend-context'],
    queryFn: fetchWeekendContext,
    enabled: !isLive,
    staleTime: WEEKEND_CONTEXT_STALE_MS,
    refetchInterval: (query) => {
      // Poll until the just-finished previous_completed_session is ready — an
      // older already-complete default_analysis_session must not stop us.
      return shouldPollHandoffAnalysis(query.state.data) ? WEEKEND_CONTEXT_POLL_MS : false
    },
    refetchIntervalInBackground: false,
  })
  const weekendContext = contextQuery.data

  useEffect(() => {
    if (!data) return
    const nextLive = data.is_live && Boolean(data.data)
    setIsLive(nextLive)
    isLiveRef.current = nextLive
    if (nextLive) wasLiveRef.current = true
    if (nextLive && data.data) {
      setActiveSnapshot(data.data)
      setArchiveMode(false)
      return
    }

    setActiveSnapshot(null)
    setArchiveSnapshot(data.last_snapshot ?? null)
    setArchivePositions(data.last_positions ?? {})
    setArchiveSnapshotAt(data.last_snapshot_at ?? null)
    setArchiveMode((current) => current && Boolean(data.last_snapshot))
  }, [data])

  useEffect(() => {
    archiveModeRef.current = archiveMode
    if (archiveMode) {
      setPositions(archivePositions)
    }
  }, [archiveMode, archivePositions])

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
      const nextLive = state.is_live && Boolean(state.data)
      setIsLive(nextLive)
      if (nextLive && state.data) {
        if (!isLiveRef.current || archiveModeRef.current) {
          setPositions({})
        }
        isLiveRef.current = true
        wasLiveRef.current = true
        setActiveSnapshot(state.data)
        setArchiveMode(false)
      } else {
        isLiveRef.current = false
        setActiveSnapshot(null)
        setArchiveSnapshot(state.last_snapshot ?? null)
        setArchivePositions(state.last_positions ?? {})
        setArchiveSnapshotAt(state.last_snapshot_at ?? null)
        setArchiveMode((current) => current && Boolean(state.last_snapshot))
      }
      setStreamStatus('connected')
    })

    events.addEventListener('heartbeat', () => {
      if (!cancelled) setStreamStatus('connected')
    })

    events.addEventListener('positions', (event) => {
      if (cancelled) return
      try {
        const parsed = JSON.parse(event.data) as Record<string, LivePosition>
        setPositions(parsed && typeof parsed === 'object' ? parsed : {})
        setStreamStatus('connected')
      } catch {
        // Ignore malformed transient frames; the next 4Hz update will replace it.
      }
    })

    events.onerror = () => {
      if (!cancelled) setStreamStatus('disconnected')
    }

    return () => {
      cancelled = true
      events.close()
    }
  }, [])

  // Synthesize "what just happened" events from successive snapshots; the
  // buffer resets whenever a different session starts streaming.
  useEffect(() => {
    if (!snapshot) return
    const signature = sessionSignature(snapshot.Session)
    const prev = prevSnapshotRef.current
    prevSnapshotRef.current = snapshot
    if (signature !== sessionSigRef.current) {
      sessionSigRef.current = signature
      setEvents([])
      return
    }
    if (!prev || prev === snapshot) return
    const fresh = diffSnapshots(prev, snapshot)
    if (fresh.length > 0) setEvents((current) => appendEvents(current, fresh))
  }, [snapshot])

  const rawRows = useMemo(() => sortLiveTimingRows(snapshot), [snapshot])
  // Final-snapshot rows for the settling handoff (independent of live rows).
  const settlingRows = useMemo(() => sortLiveTimingRows(archiveSnapshot), [archiveSnapshot])

  useEffect(() => {
    if (rawRows.length === 0) {
      setVisibleSectors({})
      return
    }
    setVisibleSectors((prev) => mergeVisibleSectors(prev, rawRows))
  }, [rawRows])

  const rows = useMemo(() => rowsWithVisibleSectors(rawRows, visibleSectors), [rawRows, visibleSectors])

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

  const handleViewArchive = () => {
    if (!archiveSnapshot) return
    setIsLive(false)
    setArchiveMode(true)
    setPositions(archivePositions)
  }

  const handleExitArchive = () => {
    setArchiveMode(false)
  }

  const archiveTimestamp = archiveSnapshotAt ? new Date(archiveSnapshotAt) : null
  const archiveLabel =
    archiveTimestamp && !Number.isNaN(archiveTimestamp.getTime())
      ? `Archived snapshot from ${archiveTimestamp.toLocaleString()}`
      : 'Archived live timing snapshot'

  const showLiveInterpretations = allowsLiveInterpretations(phase)
  // Upstream FIA loss can leave the browser SSE open; present one coherent
  // feed-health truth rather than "Connection lost" + "Feed healthy".
  const feedHealth = effectiveFeedHealth(streamStatus, phase)

  return (
    <div className="page live-page" data-testid="live-page" data-phase={phase}>
      {isError && (
        <div className="error-box">
          {error instanceof Error ? error.message : 'Failed to load live timing state'}
        </div>
      )}

      {phase === 'disconnected' && (
        <div className="live-status-strip live-status-warn" data-testid="live-disconnected-strip">
          Connection lost — showing the last live data while we reconnect. This is not an archive.
        </div>
      )}

      {phase === 'archive' && (
        <div className="live-status-strip live-status-archive" data-testid="live-archive-strip">
          <span>{archiveLabel} — read-only, live updates are paused</span>
          <button type="button" className="live-archive-exit" onClick={handleExitArchive}>
            Exit archive
          </button>
        </div>
      )}

      {phase === 'connecting' && (
        <div className="loading-state">connecting to live timing…</div>
      )}

      {(phase === 'settling' || phase === 'inactive') && (
        <LiveHandoff
          phase={phase}
          transport={feedHealth}
          context={weekendContext}
          rows={settlingRows}
          capturedAt={archiveSnapshotAt}
          hasArchive={hasArchive}
          onViewArchive={handleViewArchive}
        />
      )}

      {snapshot && rendersSnapshot(phase) && (
        <>
          <SessionBanner
            phase={phase}
            snapshot={snapshot}
            rows={rows}
            transport={feedHealth}
            now={now}
            capturedAt={phase === 'archive' ? archiveSnapshotAt : null}
          />
          <TrackStatusBanner status={snapshot.TrackStatus} />
          <PinnedDrivers rows={rows} history={gapHistory} pinned={pinned} onToggle={handleTogglePin} />
          {showLiveInterpretations && (
            <TyreDegPanel rows={rows} sessionType={snapshot.Session?.SessionType} pinned={pinned} />
          )}
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
                session={snapshot.Session}
              />
            </div>
            <div className="live-rc-col">
              <TeamRadioTicker
                captures={snapshot.TeamRadio ?? []}
                driverInfo={snapshot.DriverInfo}
                session={snapshot.Session}
              />
              <RaceControlFeed messages={snapshot.RCMessages ?? []} driverInfo={snapshot.DriverInfo} />
              <EventRail events={events} driverInfo={snapshot.DriverInfo} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

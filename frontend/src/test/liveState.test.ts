import { describe, expect, it } from 'vitest'
import {
  allowsLiveInterpretations,
  deriveLivePhase,
  isReadOnlyPhase,
  rendersSnapshot,
  terminalSessionStatus,
  type LiveStateInputs,
} from '../lib/liveState'

const base: LiveStateInputs = {
  transport: 'connecting',
  isLive: false,
  hasActiveSnapshot: false,
  hasArchive: false,
  archiveMode: false,
  sessionEndedCleanly: false,
  wasLive: false,
  stateLoaded: false,
}

describe('terminalSessionStatus', () => {
  it('recognizes genuine session-end statuses', () => {
    for (const s of ['Finished', 'Finalised', 'Finalized', 'ENDED', 'Aborted']) {
      expect(terminalSessionStatus(s)).toBe(true)
    }
  })

  it('treats still-running / unknown statuses as non-terminal', () => {
    for (const s of ['Started', 'Resumed', 'Inactive', '', undefined, null]) {
      expect(terminalSessionStatus(s)).toBe(false)
    }
  })
})

describe('deriveLivePhase transitions', () => {
  it('connecting: cold start with the feed still opening', () => {
    expect(deriveLivePhase({ ...base, transport: 'connecting' })).toBe('connecting')
  })

  it('connecting → live once a session snapshot arrives', () => {
    expect(
      deriveLivePhase({
        ...base,
        transport: 'connected',
        isLive: true,
        hasActiveSnapshot: true,
      }),
    ).toBe('live')
  })

  it('live → disconnected when the SSE transport drops mid-session', () => {
    expect(
      deriveLivePhase({
        ...base,
        transport: 'disconnected',
        isLive: true,
        hasActiveSnapshot: true,
        wasLive: true,
      }),
    ).toBe('disconnected')
  })

  it('live → settling when the session ends with a terminal status', () => {
    // Feed reports is_live=false, transport healthy, retained snapshot carries a
    // terminal SessionStatus → the session genuinely finished.
    expect(
      deriveLivePhase({
        ...base,
        transport: 'connected',
        isLive: false,
        hasArchive: true,
        sessionEndedCleanly: true,
        wasLive: true,
      }),
    ).toBe('settling')
  })

  it('live → disconnected (NOT settling) when the FIA feed drops but status is non-terminal', () => {
    // This is the P0 case: server deactivate() moved a still-active snapshot to
    // last_snapshot with is_live=false but a non-terminal SessionStatus. The
    // browser transport is healthy. We must warn + retain, never settle/archive.
    expect(
      deriveLivePhase({
        ...base,
        transport: 'connected',
        isLive: false,
        hasArchive: true,
        sessionEndedCleanly: false,
        wasLive: true,
      }),
    ).toBe('disconnected')
  })

  it('a retained non-terminal snapshot on cold load is disconnected, not settling', () => {
    expect(
      deriveLivePhase({
        ...base,
        transport: 'connected',
        isLive: false,
        hasArchive: true,
        sessionEndedCleanly: false,
        wasLive: false,
      }),
    ).toBe('disconnected')
  })

  it('settling → archive when the user explicitly opens the read-only snapshot', () => {
    expect(
      deriveLivePhase({
        ...base,
        transport: 'connected',
        isLive: false,
        hasArchive: true,
        sessionEndedCleanly: true,
        archiveMode: true,
      }),
    ).toBe('archive')
  })

  it('archive mode wins over an active session (user-chosen read-only view)', () => {
    expect(
      deriveLivePhase({
        ...base,
        transport: 'connected',
        isLive: true,
        hasActiveSnapshot: true,
        hasArchive: true,
        archiveMode: true,
      }),
    ).toBe('archive')
  })

  it('inactive when there is no session and nothing retained', () => {
    expect(deriveLivePhase({ ...base, transport: 'connected', stateLoaded: true })).toBe('inactive')
  })

  it('leaves connecting for inactive once the initial state resolves, even mid-handshake', () => {
    // connecting → inactive: the SSE transport handshake is still pending
    // (transport === "connecting") but the initial live-state query resolved as
    // idle, so we must not spin on "connecting…" forever.
    expect(deriveLivePhase({ ...base, transport: 'connecting', stateLoaded: true })).toBe('inactive')
  })
})

describe('phase capability helpers', () => {
  it('renders the snapshot surface only for live/disconnected/archive', () => {
    expect(rendersSnapshot('live')).toBe(true)
    expect(rendersSnapshot('disconnected')).toBe(true)
    expect(rendersSnapshot('archive')).toBe(true)
    expect(rendersSnapshot('settling')).toBe(false)
    expect(rendersSnapshot('inactive')).toBe(false)
    expect(rendersSnapshot('connecting')).toBe(false)
  })

  it('allows live-only interpretations only while the session is moving', () => {
    expect(allowsLiveInterpretations('live')).toBe(true)
    expect(allowsLiveInterpretations('disconnected')).toBe(true)
    // A frozen archive frame must never present live-only interpretations.
    expect(allowsLiveInterpretations('archive')).toBe(false)
    expect(allowsLiveInterpretations('settling')).toBe(false)
  })

  it('marks archive as the read-only phase', () => {
    expect(isReadOnlyPhase('archive')).toBe(true)
    expect(isReadOnlyPhase('live')).toBe(false)
    expect(isReadOnlyPhase('disconnected')).toBe(false)
  })
})

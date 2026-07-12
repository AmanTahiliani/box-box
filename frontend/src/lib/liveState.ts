// Live timing state model.
//
// The Live page has to hold four *orthogonal* concepts that used to be
// conflated into a single "connected / offline" flag:
//
//   1. transport health  — is the SSE stream up? (connecting/connected/…)
//   2. active session     — is a session actually running right now?
//   3. archive availability — do we retain a final snapshot to inspect?
//   4. analysis readiness — is the completed session ingested for Race Hub?
//
// `deriveLivePhase` collapses the first three inputs into a single UI phase so
// the page never, for example, calls a finished session "offline" or lets a
// dropped socket masquerade as "archive mode".
//
// Critical distinction (issue #74 P0): the server's `deactivate()` path moves a
// STILL-ACTIVE snapshot into `last_snapshot` whenever the upstream FIA SignalR
// connection ends or idles — WITHOUT changing SessionStatus. So `is_live=false`
// alone is ambiguous. We rely on the retained snapshot's terminal SessionStatus
// (Finished/Ended/…) as the only trustworthy "the session really ended" signal.
// A non-terminal retained snapshot means the feed dropped, not that the session
// finished, and must render as `disconnected` (retain snapshot, warn, recover),
// never `settling`/archive.

export type TransportHealth = 'connecting' | 'connected' | 'disconnected' | 'error'

export type LivePhase =
  | 'connecting' // cold start: no snapshot yet, still opening the feed
  | 'live' // a session is running and streaming
  | 'disconnected' // was live, transport/feed dropped — keep the last snapshot, warn
  | 'settling' // session truly ended; a final snapshot is retained, analysis pending
  | 'archive' // user opened the retained snapshot as an explicit read-only view
  | 'inactive' // no session and nothing retained — show weekend context instead

export interface LiveStateInputs {
  transport: TransportHealth
  /** The feed reports an active session AND carries a snapshot for it. */
  isLive: boolean
  hasActiveSnapshot: boolean
  /** A retained snapshot from the last stream is held (may be a dropped feed). */
  hasArchive: boolean
  /** The user explicitly opened the archive as a read-only timing view. */
  archiveMode: boolean
  /**
   * The retained snapshot ended on a *terminal* FIA SessionStatus. Only true
   * here means the session genuinely finished (vs. the transport dropping).
   */
  sessionEndedCleanly: boolean
  /** We have observed this session live at least once in this page session. */
  wasLive: boolean
  /**
   * The initial `/api/v1/live/state` query has resolved. `connecting` is a
   * cold-start-only phase: once we know the current state (even if the SSE
   * transport handshake is still pending), an idle feed is `inactive`, not a
   * perpetual "connecting…" spinner.
   */
  stateLoaded: boolean
}

// Raw FIA SessionStatus values that mean the session is genuinely over. Mirrors
// the backend `terminalSessionStatus` used by the weekend-context resolver so
// the client and server agree on "finished".
const TERMINAL_STATUSES = new Set(['finished', 'finalised', 'finalized', 'ended', 'aborted'])

function normalizeStatus(status: string | undefined | null): string {
  if (!status) return ''
  return status.replace(/[^a-zA-Z]/g, '').toLowerCase()
}

/** Whether a raw FIA SessionStatus represents a genuinely completed session. */
export function terminalSessionStatus(status: string | undefined | null): boolean {
  return TERMINAL_STATUSES.has(normalizeStatus(status))
}

export function transportDown(transport: TransportHealth): boolean {
  return transport === 'disconnected' || transport === 'error'
}

/**
 * Map transport + session + archive inputs to one UI phase. Session lifecycle
 * and transport health are deliberately orthogonal: a live session with a
 * dropped socket is `disconnected` (snapshot retained), never `archive` or
 * `settling`.
 */
export function deriveLivePhase(input: LiveStateInputs): LivePhase {
  const {
    transport,
    isLive,
    hasActiveSnapshot,
    hasArchive,
    archiveMode,
    sessionEndedCleanly,
    stateLoaded,
  } = input

  // Explicit read-only archive wins — it is a user-chosen mode.
  if (archiveMode && hasArchive) return 'archive'

  // An active session: transport health only downgrades the *presentation*,
  // it never removes the session.
  if (isLive && hasActiveSnapshot) {
    return transportDown(transport) ? 'disconnected' : 'live'
  }

  // Feed reports no active session but a snapshot is retained. Distinguish a
  // genuine session end from an upstream feed drop using the *only* trustworthy
  // signal: whether the retained snapshot carries a terminal SessionStatus.
  if (hasArchive) {
    if (sessionEndedCleanly) return 'settling'
    // Non-terminal retained snapshot means the upstream feed dropped, not that
    // the session finished. Hold the last frame and warn — never settle/archive.
    return 'disconnected'
  }

  // Cold start only: still opening the feed and we have not yet learned the
  // current state. Once the initial state query resolves, an idle feed is
  // `inactive`, not a perpetual "connecting…".
  if (transport === 'connecting' && !stateLoaded) return 'connecting'

  return 'inactive'
}

/** Phases that render the live timing tower / snapshot surface. */
export function rendersSnapshot(phase: LivePhase): boolean {
  return phase === 'live' || phase === 'disconnected' || phase === 'archive'
}

/**
 * Whether live-only interpretations (pit-window rejoin, tyre-deg slope, "what
 * just happened" deltas) are meaningful. They require a moving session, so an
 * archived single frame must never present them as current insight.
 */
export function allowsLiveInterpretations(phase: LivePhase): boolean {
  return phase === 'live' || phase === 'disconnected'
}

/** Read-only, timestamped phases that must not show live/connected chrome. */
export function isReadOnlyPhase(phase: LivePhase): boolean {
  return phase === 'archive'
}

/** Short, human transport-health label — always secondary to session state. */
export function feedHealthLabel(transport: TransportHealth): string {
  switch (transport) {
    case 'connected':
      return 'Feed healthy'
    case 'connecting':
      return 'Connecting'
    case 'disconnected':
      return 'Reconnecting'
    case 'error':
      return 'Feed unavailable'
  }
}

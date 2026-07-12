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

export type TransportHealth = 'connecting' | 'connected' | 'disconnected' | 'error'

export type LivePhase =
  | 'connecting' // cold start: no snapshot yet, still opening the feed
  | 'live' // a session is running and streaming
  | 'disconnected' // was live, transport dropped — keep the last snapshot, warn
  | 'settling' // session ended; a final snapshot is retained, analysis pending
  | 'archive' // user opened the retained snapshot as an explicit read-only view
  | 'inactive' // no session and nothing retained — show weekend context instead

export interface LiveStateInputs {
  transport: TransportHealth
  /** The feed reports an active session AND carries a snapshot for it. */
  isLive: boolean
  hasActiveSnapshot: boolean
  /** A final snapshot from the last session is retained. */
  hasArchive: boolean
  /** The user explicitly opened the archive as a read-only timing view. */
  archiveMode: boolean
}

export function transportDown(transport: TransportHealth): boolean {
  return transport === 'disconnected' || transport === 'error'
}

/**
 * Map transport + session + archive inputs to one UI phase. Session lifecycle
 * and transport health are deliberately orthogonal: a live session with a
 * dropped socket is `disconnected` (snapshot retained), never `archive`.
 */
export function deriveLivePhase(input: LiveStateInputs): LivePhase {
  const { transport, isLive, hasActiveSnapshot, hasArchive, archiveMode } = input

  // Explicit read-only archive wins — it is a user-chosen mode.
  if (archiveMode && hasArchive) return 'archive'

  // An active session: transport health only downgrades the *presentation*,
  // it never removes the session.
  if (isLive && hasActiveSnapshot) {
    return transportDown(transport) ? 'disconnected' : 'live'
  }

  // No active session but we still hold the final snapshot -> settling handoff.
  if (hasArchive) return 'settling'

  // Nothing yet and the feed is still opening.
  if (transport === 'connecting') return 'connecting'

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

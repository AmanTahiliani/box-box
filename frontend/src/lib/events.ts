// "What just happened" event synthesis for the live page.
// Pure functions only — no React, no side effects — so everything is unit-testable.
// Mirrors the gapHistory/battles precedent: successive LiveStreamData snapshots
// in, typed events out; the page owns the buffer, this module owns the diffing.

import type {
  LiveDriverData,
  LiveRCMessage,
  LiveSessionMeta,
  LiveStreamData,
} from '../types'

export const MAX_EVENTS = 30

export type LiveEventKind =
  | 'overtake'
  | 'position-gain'
  | 'position-loss'
  | 'pit-in'
  | 'pit-out'
  | 'personal-best'
  | 'fastest-lap'
  | 'retirement'
  | 'track-status'
  | 'race-control'

export interface LiveEvent {
  id: string
  kind: LiveEventKind
  lap: number
  timestamp: string
  headline: string
  detail?: string
  racingNumbers: string[]
}

/**
 * Identity of the running session, used to reset the event buffer when a new
 * session starts. LiveSessionMeta carries no numeric session key, so the
 * meeting + session name/type triple stands in for one.
 */
export function sessionSignature(session: LiveSessionMeta | null | undefined): string {
  if (!session) return ''
  return [session.MeetingName, session.SessionName, session.SessionType].join('|')
}

/**
 * Prepend freshly diffed events onto the newest-first buffer, dropping any
 * whose id is already present (re-renders and replayed diffs must not
 * duplicate) and evicting the oldest events beyond `cap`.
 */
export function appendEvents(
  buffer: ReadonlyArray<LiveEvent>,
  incoming: ReadonlyArray<LiveEvent>,
  cap = MAX_EVENTS,
): LiveEvent[] {
  const seen = new Set(buffer.map((event) => event.id))
  const fresh = incoming.filter((event) => {
    if (seen.has(event.id)) return false
    seen.add(event.id)
    return true
  })
  if (fresh.length === 0) return [...buffer]
  // Within one diff the array is oldest-first; reverse so the last-produced
  // event ends up at the top of the newest-first rail.
  return [...fresh.reverse(), ...buffer].slice(0, cap)
}

const TRACK_STATUS_HEADLINES: Record<string, string> = {
  '1': 'Green flag — track clear',
  '2': 'Yellow flag',
  '4': 'Safety Car deployed',
  '5': 'Red flag — session stopped',
  '6': 'Virtual Safety Car deployed',
  '7': 'Virtual Safety Car ending',
}

const RC_CATEGORIES = new Set(['flag', 'safetycar', 'drs'])

/**
 * Diff two successive live snapshots into a chronological list of synthesized
 * events. Callers are expected to feed genuinely consecutive snapshots of the
 * same session; diffing across a session boundary is the caller's job to
 * prevent (see sessionSignature).
 */
export function diffSnapshots(prev: LiveStreamData, next: LiveStreamData): LiveEvent[] {
  if (!prev || !next || prev === next) return []

  const events: LiveEvent[] = []
  const lap = next.CurrentLap || 0
  const timestamp = next.Clock || ''
  const code = (racingNumber: string): string =>
    next.DriverInfo?.[racingNumber]?.Tla ||
    prev.DriverInfo?.[racingNumber]?.Tla ||
    `#${racingNumber}`

  diffTrackStatus(prev, next, lap, timestamp, events)
  diffRaceControl(prev, next, events)

  const prevDrivers = prev.Drivers ?? {}
  const nextDrivers = next.Drivers ?? {}
  const numbers = Object.keys(nextDrivers).filter((number) => prevDrivers[number])

  // Racing numbers whose position loss is already explained by an overtake
  // event, so we don't also report a generic "drops to Pn".
  const overtakenNumbers = new Set<string>()

  for (const number of numbers) {
    const before = prevDrivers[number]
    const after = nextDrivers[number]

    if (!before.Retired && after.Retired) {
      events.push({
        id: `ret:${number}`,
        kind: 'retirement',
        lap,
        timestamp,
        headline: `${code(number)} retires`,
        detail: before.Position > 0 ? `Was running P${before.Position}` : undefined,
        racingNumbers: [number],
      })
    }

    if (!before.InPit && after.InPit && !after.Retired) {
      const fromPosition = before.Position > 0 ? ` from P${before.Position}` : ''
      events.push({
        id: `pit-in:${number}:l${lap}`,
        kind: 'pit-in',
        lap,
        timestamp,
        headline: `${code(number)} pits${fromPosition}`,
        racingNumbers: [number],
      })
    }

    if (before.InPit && !after.InPit && !after.Retired) {
      const compound = next.Tyres?.[number]?.Compound || ''
      const stops = Math.max(0, (next.Stints?.[number]?.length ?? 0) - 1)
      const parts = [compound, stops > 0 ? `${ordinal(stops)} stop` : ''].filter(Boolean)
      const rejoined = after.Position > 0 ? ` P${after.Position}` : ''
      events.push({
        id: `pit-out:${number}:l${lap}`,
        kind: 'pit-out',
        lap,
        timestamp,
        headline: `${code(number)} rejoins${rejoined}${parts.length > 0 ? ` (${parts.join(', ')})` : ''}`,
        racingNumbers: [number],
      })
    }

    diffBestLap(number, before, after, code, lap, timestamp, events)
  }

  // Position gains, with overtake attribution via position swaps.
  for (const number of numbers) {
    const before = prevDrivers[number]
    const after = nextDrivers[number]
    if (before.Position <= 0 || after.Position <= 0) continue
    if (after.Position >= before.Position) continue
    if (after.InPit || after.Retired) continue

    const overtaken = numbers.find((other) => {
      if (other === number) return false
      const otherBefore = prevDrivers[other]
      const otherAfter = nextDrivers[other]
      return (
        otherBefore.Position === after.Position &&
        otherAfter.Position > otherBefore.Position &&
        !otherAfter.InPit &&
        !otherAfter.Retired
      )
    })

    if (overtaken) {
      overtakenNumbers.add(overtaken)
      events.push({
        id: `overtake:${number}:${overtaken}:p${after.Position}:l${lap}`,
        kind: 'overtake',
        lap,
        timestamp,
        headline: `${code(number)} overtakes ${code(overtaken)} for P${after.Position}`,
        detail: before.Position - after.Position > 1 ? `Up from P${before.Position}` : undefined,
        racingNumbers: [number, overtaken],
      })
    } else {
      events.push({
        id: `pos:${number}:${before.Position}-${after.Position}:l${lap}`,
        kind: 'position-gain',
        lap,
        timestamp,
        headline: `${code(number)} moves up to P${after.Position} (from P${before.Position})`,
        racingNumbers: [number],
      })
    }
  }

  // Position losses not already explained by an overtake or a pit visit.
  for (const number of numbers) {
    const before = prevDrivers[number]
    const after = nextDrivers[number]
    if (before.Position <= 0 || after.Position <= 0) continue
    if (after.Position <= before.Position) continue
    if (overtakenNumbers.has(number)) continue
    if (after.InPit || after.PitOut || after.Retired || before.InPit) continue

    events.push({
      id: `pos:${number}:${before.Position}-${after.Position}:l${lap}`,
      kind: 'position-loss',
      lap,
      timestamp,
      headline: `${code(number)} drops to P${after.Position} (from P${before.Position})`,
      racingNumbers: [number],
    })
  }

  return events
}

function diffTrackStatus(
  prev: LiveStreamData,
  next: LiveStreamData,
  lap: number,
  timestamp: string,
  events: LiveEvent[],
): void {
  if (!prev.TrackStatus || !next.TrackStatus) return
  if (prev.TrackStatus === next.TrackStatus) return
  events.push({
    id: `track:${next.TrackStatus}:l${lap}`,
    kind: 'track-status',
    lap,
    timestamp,
    headline: TRACK_STATUS_HEADLINES[next.TrackStatus] ?? `Track status ${next.TrackStatus}`,
    racingNumbers: [],
  })
}

function diffRaceControl(prev: LiveStreamData, next: LiveStreamData, events: LiveEvent[]): void {
  const prevMessages = prev.RCMessages ?? []
  const seen = new Set(prevMessages.map(rcMessageKey))
  for (const message of next.RCMessages ?? []) {
    if (!message.Message || seen.has(rcMessageKey(message))) continue
    if (!RC_CATEGORIES.has((message.Category || '').toLowerCase())) continue
    events.push({
      id: `rc:${rcMessageKey(message)}`,
      kind: 'race-control',
      lap: message.Lap || 0,
      timestamp: message.Time || '',
      headline: humanizeRaceControl(message.Message),
      racingNumbers: carNumbersIn(message.Message),
    })
  }
}

function diffBestLap(
  number: string,
  before: LiveDriverData,
  after: LiveDriverData,
  code: (racingNumber: string) => string,
  lap: number,
  timestamp: string,
  events: LiveEvent[],
): void {
  if (!after.LastLapTime) return
  const isNewLap = after.LastLapTime !== before.LastLapTime

  if (after.LastLapOB && (isNewLap || !before.LastLapOB)) {
    events.push({
      id: `ob:${number}:${after.LastLapTime}`,
      kind: 'fastest-lap',
      lap,
      timestamp,
      headline: `${code(number)} sets the fastest lap — ${after.LastLapTime}`,
      racingNumbers: [number],
    })
    return
  }

  if (after.LastLapPB && !after.LastLapOB && (isNewLap || !before.LastLapPB)) {
    events.push({
      id: `pb:${number}:${after.LastLapTime}`,
      kind: 'personal-best',
      lap,
      timestamp,
      headline: `${code(number)} sets a personal best — ${after.LastLapTime}`,
      racingNumbers: [number],
    })
  }
}

function rcMessageKey(message: LiveRCMessage): string {
  return `${message.Time}:${message.Message}`
}

/** "SAFETY CAR DEPLOYED" -> "Safety car deployed", keeping known acronyms upper-cased. */
export function humanizeRaceControl(message: string): string {
  const lower = message.trim().toLowerCase()
  if (!lower) return ''
  const sentence = lower.charAt(0).toUpperCase() + lower.slice(1)
  return sentence.replace(/\b(drs|vsc|sc|fia)\b/gi, (acronym) => acronym.toUpperCase())
}

function carNumbersIn(message: string): string[] {
  const numbers: string[] = []
  for (const match of message.matchAll(/CAR (\d+)/gi)) {
    if (!numbers.includes(match[1])) numbers.push(match[1])
  }
  return numbers
}

function ordinal(n: number): string {
  const rem10 = n % 10
  const rem100 = n % 100
  if (rem10 === 1 && rem100 !== 11) return `${n}st`
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`
  return `${n}th`
}

import type {
  LiveDriverData,
  LiveDriverInfo,
  LiveRCMessage,
  LiveStateResponse,
  LiveStreamData,
  LiveTyreData,
} from '../types'

export interface LiveTimingRow {
  RacingNumber: string
  Position: number
  Driver: LiveDriverData
  Info?: LiveDriverInfo
  Tyre?: LiveTyreData
}

const TRACK_STATUS_LABELS: Record<string, string> = {
  '1': 'GREEN',
  '2': 'YELLOW',
  '4': 'SC',
  '5': 'RED',
  '6': 'VSC',
  '7': 'VSC ENDING',
}

export interface TrackStatusInfo {
  key: 'green' | 'yellow' | 'sc' | 'vsc' | 'red' | 'unknown'
  label: string
  detail: string
}

// Raw F1 SignalR TrackStatus.Status values (see internal/live/types.go):
// "1"=all clear, "2"=yellow, "4"=safety car, "5"=red, "6"=VSC, "7"=VSC ending.
// "3" has not been observed in the feed; unknown values fall through to a
// neutral display so a new encoding never breaks the banner.
const TRACK_STATUS_INFO: Record<string, TrackStatusInfo> = {
  '1': { key: 'green', label: 'TRACK CLEAR', detail: 'Green flag — racing' },
  '2': { key: 'yellow', label: 'YELLOW FLAG', detail: 'Caution on track' },
  '4': { key: 'sc', label: 'SAFETY CAR', detail: 'Safety car deployed' },
  '5': { key: 'red', label: 'RED FLAG', detail: 'Session stopped' },
  '6': { key: 'vsc', label: 'VIRTUAL SAFETY CAR', detail: 'VSC deployed' },
  '7': { key: 'vsc', label: 'VSC ENDING', detail: 'Virtual safety car ending' },
}

export function trackStatusInfo(status: string | null | undefined): TrackStatusInfo {
  if (status && TRACK_STATUS_INFO[status]) return TRACK_STATUS_INFO[status]
  return {
    key: 'unknown',
    label: status ? `TRACK STATUS ${status}` : 'TRACK STATUS UNKNOWN',
    detail: '',
  }
}

export function parseLiveStateEvent(data: string): LiveStateResponse | null {
  try {
    const parsed = JSON.parse(data) as LiveStateResponse
    return typeof parsed === 'object' && parsed !== null ? parsed : null
  } catch {
    return null
  }
}

export function sortLiveTimingRows(snapshot: LiveStreamData | null | undefined): LiveTimingRow[] {
  if (!snapshot) return []

  const rowsByNumber = new Map<string, LiveTimingRow>()
  for (const [number, driver] of Object.entries(snapshot.Drivers ?? {})) {
    rowsByNumber.set(number, {
      RacingNumber: driver.RacingNumber || number,
      Position: driver.Position || 0,
      Driver: { ...driver, RacingNumber: driver.RacingNumber || number },
      Info: snapshot.DriverInfo?.[number],
      Tyre: snapshot.Tyres?.[number],
    })
  }

  for (const [number, info] of Object.entries(snapshot.DriverInfo ?? {})) {
    if (!rowsByNumber.has(number)) {
      rowsByNumber.set(number, {
        RacingNumber: info.RacingNumber || number,
        Position: 0,
        Driver: {
          RacingNumber: info.RacingNumber || number,
          Position: 0,
        } as LiveDriverData,
        Info: info,
        Tyre: snapshot.Tyres?.[number],
      })
    }
  }

  const rows = [...rowsByNumber.values()]
  rows.sort((a, b) => {
    if (a.Position > 0 && b.Position > 0) return a.Position - b.Position
    if (a.Position > 0) return -1
    if (b.Position > 0) return 1

    const aBest = a.Driver.BestLapTime || ''
    const bBest = b.Driver.BestLapTime || ''
    if (aBest && bBest) return aBest.localeCompare(bBest)
    if (aBest) return -1
    if (bBest) return 1

    return Number(a.RacingNumber) - Number(b.RacingNumber)
  })

  return rows.map((row, index) => ({
    ...row,
    Position: row.Position || index + 1,
  }))
}

export function driverCode(row: LiveTimingRow): string {
  return row.Info?.Tla || row.RacingNumber
}

export function trackStatusLabel(status: string): string {
  return TRACK_STATUS_LABELS[status] || status || 'UNKNOWN'
}

export function positionDelta(driver: LiveDriverData): string {
  if (!driver.PrevPosition || !driver.Position || driver.PrevPosition === driver.Position) return ''
  return driver.PrevPosition > driver.Position ? '▲' : '▼'
}

export function positionDeltaClass(driver: LiveDriverData): string {
  if (!driver.PrevPosition || !driver.Position || driver.PrevPosition === driver.Position) return ''
  return driver.PrevPosition > driver.Position ? 'pos-gain' : 'pos-loss'
}

const RC_FLAG_CSS: Record<string, string> = {
  GREEN:                'rc-flag-green',
  YELLOW:               'rc-flag-yellow',
  'DOUBLE YELLOW':      'rc-flag-yellow',
  RED:                  'rc-flag-red',
  BLUE:                 'rc-flag-blue',
  BLACK:                'rc-flag-black',
  'BLACK AND ORANGE':   'rc-flag-black',
  'BLACK AND WHITE':    'rc-flag-black',
  SC:                   'rc-flag-sc',
  'SAFETY CAR':         'rc-flag-sc',
  VSC:                  'rc-flag-vsc',
  'VIRTUAL SAFETY CAR': 'rc-flag-vsc',
  CHEQUERED:            'rc-flag-chequered',
  CHECKERED:            'rc-flag-chequered',
}

export function rcFlagClass(flag: string): string {
  if (!flag) return ''
  return RC_FLAG_CSS[flag.toUpperCase()] ?? ''
}

export function tyreLabel(tyre: LiveTyreData | undefined): string {
  if (!tyre) return '?'
  const compound = tyre.Compound?.charAt(0) || '?'
  return `${compound} +${tyre.Age || 0}`
}

export function compoundClass(compound: string | null | undefined): string {
  if (!compound) return 'tyre-unknown'
  const normalized = compound.toLowerCase()
  return `tyre-${normalized === 'intermediate' ? 'inter' : normalized}`
}

export function compoundLetter(compound: string | null | undefined): string {
  return compound?.charAt(0).toUpperCase() || '?'
}

export function tyreClass(tyre: LiveTyreData | undefined): string {
  return compoundClass(tyre?.Compound)
}

export function windDirectionLabel(degrees: number | null | undefined): string {
  if (degrees == null || !Number.isFinite(degrees)) return ''
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8
  return points[index]
}

export const MAX_PINNED_DRIVERS = 3

/**
 * Toggle a driver pin. Unpins if already pinned; otherwise appends,
 * dropping the oldest pin when at capacity so clicking always works.
 */
export function togglePin(pins: ReadonlyArray<string>, racingNumber: string, max = MAX_PINNED_DRIVERS): string[] {
  if (!racingNumber) return [...pins]
  if (pins.includes(racingNumber)) return pins.filter((pin) => pin !== racingNumber)
  const next = [...pins, racingNumber]
  return next.length > max ? next.slice(next.length - max) : next
}

const PINS_STORAGE_KEY = 'box-box.live.pins'

export function loadPinnedDrivers(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string[] {
  try {
    const raw = storage?.getItem(PINS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((pin): pin is string => typeof pin === 'string').slice(0, MAX_PINNED_DRIVERS)
  } catch {
    return []
  }
}

export function savePinnedDrivers(pins: ReadonlyArray<string>, storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(PINS_STORAGE_KEY, JSON.stringify(pins))
  } catch {
    // storage unavailable (private mode, SSR) — pins just won't persist
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

export function latestRaceControl(messages: LiveRCMessage[], limit = 10): LiveRCMessage[] {
  return [...(messages ?? [])].reverse().slice(0, limit)
}

export function extrapolateClock(clock: string, refTime: string, extrapolating: boolean, now = Date.now()): string {
  if (!clock || !extrapolating || !refTime) return clock || ''

  const parts = clock.split(':').map(Number)
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return clock

  const refMs = new Date(refTime).getTime()
  if (!Number.isFinite(refMs)) return clock

  const totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
  const elapsed = Math.max(0, (now - refMs) / 1000)
  const remaining = Math.max(0, totalSeconds - elapsed)
  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = Math.floor(remaining % 60)

  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

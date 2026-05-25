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

export function trackStatusClass(status: string): string {
  return `track-${trackStatusLabel(status).toLowerCase()}`
}

export function positionDelta(driver: LiveDriverData): string {
  if (!driver.PrevPosition || !driver.Position || driver.PrevPosition === driver.Position) return ''
  return driver.PrevPosition > driver.Position ? '▲' : '▼'
}

export function tyreLabel(tyre: LiveTyreData | undefined): string {
  if (!tyre) return '?'
  const compound = tyre.Compound?.charAt(0) || '?'
  return `${compound} +${tyre.Age || 0}`
}

export function tyreClass(tyre: LiveTyreData | undefined): string {
  if (!tyre?.Compound) return 'tyre-unknown'
  const compound = tyre.Compound.toLowerCase()
  return `tyre-${compound === 'intermediate' ? 'inter' : compound}`
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

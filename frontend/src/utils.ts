export function teamColor(hex: string | undefined): string {
  if (!hex) return '#444444'
  return hex.startsWith('#') ? hex : `#${hex}`
}

export function formatDuration(val: number | number[] | null | undefined): string {
  if (val == null) return '—'
  const s = Array.isArray(val) ? val[0] : val
  if (typeof s !== 'number' || isNaN(s) || s <= 0) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toFixed(3)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${sec.padStart(6, '0')}`
  return `${m}:${sec.padStart(6, '0')}`
}

export function formatGap(val: number | string | number[] | null | undefined): string {
  if (val == null) return '—'
  if (typeof val === 'string') return val
  const g = Array.isArray(val) ? val[0] : val
  if (typeof g !== 'number' || isNaN(g)) return '—'
  return `+${g.toFixed(3)}`
}

export function formatLapTime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(3)
  return `${m}:${s.padStart(6, '0')}`
}

export function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function gridDelta(finishPos: number, gridPos: number): string {
  if (!gridPos || !finishPos) return '—'
  const delta = gridPos - finishPos
  if (delta > 0) return `↑${delta}`
  if (delta < 0) return `↓${Math.abs(delta)}`
  return '—'
}

export function gridDeltaClass(finishPos: number, gridPos: number): string {
  if (!gridPos || !finishPos) return 'pos-same'
  const delta = gridPos - finishPos
  if (delta > 0) return 'pos-gain'
  if (delta < 0) return 'pos-loss'
  return 'pos-same'
}

export function positionClass(pos: number): string {
  if (pos === 1) return 'pos-p1'
  if (pos === 2) return 'pos-p2'
  if (pos === 3) return 'pos-p3'
  return 'pos-n'
}

/** Classified finish order; position 0 (DNF/DNS) sorts last. */
export function finishPositionOrder(pos: number): number {
  return pos > 0 ? pos : 9999
}

export function compareFinishPosition(a: number, b: number): number {
  return finishPositionOrder(a) - finishPositionOrder(b)
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

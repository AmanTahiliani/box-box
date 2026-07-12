// Pure helpers for the championship rivalry compare view.

/** One round that counted toward the head-to-head tally. */
export interface H2HRound {
  round: number // 1-based season round
  label: string
  posA: number
  posB: number
  winner: 'a' | 'b'
}

export interface H2HTally {
  a: number
  b: number
  /** Rounds counted in the tally, in season order. */
  rounds: H2HRound[]
  /** Rounds skipped because either driver had no finishing position. */
  skipped: number
}

/**
 * Per-round points gap (a − b) across the rounds both cumulative series
 * cover. Positive values mean driver A is ahead.
 */
export function gapSeries(a: number[], b: number[]): number[] {
  const n = Math.min(a.length, b.length)
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(a[i] - b[i])
  return out
}

/**
 * Race head-to-head: per round, the lower finishing position wins. Rounds
 * where either driver has no position (0 / missing) are skipped from the
 * tally, as are equal positions (defensive — races can't tie).
 */
export function h2hTally(posA: number[], posB: number[], labels: string[]): H2HTally {
  const n = Math.max(posA.length, posB.length)
  const rounds: H2HRound[] = []
  let a = 0
  let b = 0
  let skipped = 0
  for (let i = 0; i < n; i++) {
    const pa = posA[i] ?? 0
    const pb = posB[i] ?? 0
    if (pa <= 0 || pb <= 0 || pa === pb) {
      skipped++
      continue
    }
    const winner = pa < pb ? 'a' : 'b'
    if (winner === 'a') a++
    else b++
    rounds.push({ round: i + 1, label: labels[i] ?? `R${i + 1}`, posA: pa, posB: pb, winner })
  }
  return { a, b, rounds, skipped }
}

/** Last n counted rounds of a tally, for the mini strip. */
export function lastRounds(tally: H2HTally, n: number): H2HRound[] {
  return tally.rounds.slice(-n)
}

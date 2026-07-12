import { useMemo, useState } from 'react'
import type { ChampHubDriver, ChampionshipHub } from '../types'
import { teamColor } from '../utils'
import { gapSeries, h2hTally, lastRounds } from '../lib/rivalry'
import '../styles/rivalry.css'

const PAD_L = 48
const PAD_T = 16
const PLOT_W = 882
const PLOT_H = 316
const GAP_PLOT_H = 200

function fmtPts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Up to ~7 evenly spaced round labels, always including the last round. */
function xTicks(n: number, labels: string[], x: (i: number) => number): { x: number; label: string }[] {
  const step = Math.max(1, Math.ceil(n / 7))
  const ticks: { x: number; label: string }[] = []
  for (let i = 0; i < n; i += step) {
    ticks.push({ x: x(i), label: labels[i] ?? `R${i + 1}` })
  }
  const last = labels[n - 1] ?? `R${n}`
  if (ticks[ticks.length - 1]?.label !== last) {
    ticks.push({ x: x(n - 1), label: last })
  }
  return ticks
}

function polyline(values: number[], x: (i: number) => number, y: (v: number) => number): string {
  return values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}

interface PickerProps {
  id: 'a' | 'b'
  label: string
  drivers: ChampHubDriver[]
  value: number
  color: string
  onChange: (driverNumber: number) => void
}

function DriverPicker({ id, label, drivers, value, color, onChange }: PickerProps) {
  return (
    <label className="rivalry-picker">
      <span className="rivalry-picker-label">{label}</span>
      <select
        className="rivalry-picker-select"
        style={{ borderLeft: `3px solid ${color}` }}
        value={value}
        data-testid={`rivalry-pick-${id}`}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {drivers.map((d) => (
          <option key={d.driver_number} value={d.driver_number}>
            {d.name_acronym} · {d.full_name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function RivalryCompare({ hub }: { hub: ChampionshipHub }) {
  const { drivers } = hub
  const [pickA, setPickA] = useState<number | null>(null)
  const [pickB, setPickB] = useState<number | null>(null)

  // Default to the top two in the standings; fall back there if a picked
  // driver disappears (e.g. season switch re-fetches the hub).
  const a = drivers.find((d) => d.driver_number === pickA) ?? drivers[0]
  const b = drivers.find((d) => d.driver_number === pickB) ?? drivers[1]

  const tally = useMemo(
    () => (a && b ? h2hTally(a.round_positions ?? [], b.round_positions ?? [], hub.round_labels) : null),
    [a, b, hub.round_labels],
  )

  if (drivers.length < 2) {
    return (
      <div className="champ-chart-empty" data-testid="champ-view-rivalry">
        Need at least two drivers in the standings to compare a rivalry.
      </div>
    )
  }

  const colorA = teamColor(a.team_colour)
  const colorB = teamColor(b.team_colour)
  const sameTeam = a.team_name === b.team_name

  const cumA = a.cumulative ?? []
  const cumB = b.cumulative ?? []
  const rounds = Math.min(cumA.length, cumB.length)
  const gaps = gapSeries(cumA, cumB)
  const lastGap = gaps[gaps.length - 1] ?? 0
  const strip = tally ? lastRounds(tally, 5) : []

  const pickers = (
    <div className="rivalry-pickers">
      <DriverPicker id="a" label="Driver A" drivers={drivers} value={a.driver_number} color={colorA} onChange={setPickA} />
      <span className="rivalry-vs mono">vs</span>
      <DriverPicker id="b" label="Driver B" drivers={drivers} value={b.driver_number} color={colorB} onChange={setPickB} />
    </div>
  )

  if (rounds === 0) {
    return (
      <div className="rivalry" data-testid="champ-view-rivalry">
        {pickers}
        <div className="champ-chart-empty">
          No completed rounds yet — the rivalry will appear after the first race.
        </div>
      </div>
    )
  }

  // Points race scales.
  const peak = Math.max(...cumA.slice(0, rounds), ...cumB.slice(0, rounds), 1)
  const maxY = Math.max(50, Math.ceil(peak / 50) * 50)
  const px = (i: number) => (rounds <= 1 ? PAD_L : PAD_L + (i * PLOT_W) / (rounds - 1))
  const py = (v: number) => PAD_T + PLOT_H - (v / maxY) * PLOT_H
  const pyGrid = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: py(maxY * f), label: Math.round(maxY * f) }))
  const pxGrid = xTicks(rounds, hub.round_labels, px)

  // Gap scales: symmetric around zero.
  const maxAbs = Math.max(10, Math.ceil(Math.max(...gaps.map(Math.abs), 1) / 10) * 10)
  const gy = (v: number) => PAD_T + GAP_PLOT_H / 2 - (v / maxAbs) * (GAP_PLOT_H / 2)
  const gyGrid = [maxAbs, 0, -maxAbs].map((v) => ({ y: gy(v), label: v > 0 ? `+${v}` : String(v) }))
  const gxGrid = xTicks(rounds, hub.round_labels, px)

  const gapLeader = lastGap === 0 ? null : lastGap > 0 ? a : b
  const gapCaption = gapLeader
    ? `${gapLeader.name_acronym} leads by ${fmtPts(Math.abs(lastGap))} pts after ${hub.round_labels[rounds - 1] ?? `R${rounds}`}.`
    : 'Dead level on points.'

  return (
    <div className="rivalry" data-testid="champ-view-rivalry">
      {pickers}

      <div className="rivalry-h2h" data-testid="rivalry-h2h">
        <div className="rivalry-h2h-score">
          <span className="rivalry-h2h-code mono" style={{ color: colorA }}>
            {a.name_acronym}
          </span>
          <span className="rivalry-h2h-num mono" data-testid="rivalry-h2h-num">
            {tally ? `${tally.a}–${tally.b}` : '—'}
          </span>
          <span className="rivalry-h2h-code mono" style={{ color: colorB }}>
            {b.name_acronym}
          </span>
        </div>
        <span className="rivalry-h2h-meta">
          Race head-to-head · {tally?.rounds.length ?? 0} round{(tally?.rounds.length ?? 0) === 1 ? '' : 's'} counted
          {tally && tally.skipped > 0 ? ` · ${tally.skipped} skipped` : ''}
        </span>
        {strip.length > 0 && (
          <div className="rivalry-strip" data-testid="rivalry-strip">
            <span className="rivalry-strip-label">Last {strip.length}</span>
            {strip.map((r) => (
              <span className="rivalry-chip" key={r.round} title={`${r.label}: ${a.name_acronym} P${r.posA} · ${b.name_acronym} P${r.posB}`}>
                <span className="rivalry-chip-round mono">{r.label}</span>
                <span className="rivalry-chip-winner mono" style={{ color: r.winner === 'a' ? colorA : colorB }}>
                  {r.winner === 'a' ? a.name_acronym : b.name_acronym}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>

      <section className="rivalry-section" data-testid="rivalry-points-race">
        <div className="champ-chart-head">
          <span className="champ-chart-title mono">
            Points race — {a.name_acronym} vs {b.name_acronym}
          </span>
          <span className="champ-chart-meta">
            Rounds 1–{rounds} · {hub.season}
          </span>
        </div>
        <div className="champ-chart">
          <svg viewBox="0 0 1000 380" className="champ-chart-svg" preserveAspectRatio="none">
            {pyGrid.map((g) => (
              <g key={g.label}>
                <line x1={PAD_L} y1={g.y} x2={930} y2={g.y} stroke="var(--border)" strokeWidth="1" />
                <text x={40} y={g.y + 4} textAnchor="end" className="champ-chart-axis">
                  {g.label}
                </text>
              </g>
            ))}
            {pxGrid.map((g, i) => (
              <text key={i} x={g.x} y={372} textAnchor="middle" className="champ-chart-axis">
                {g.label}
              </text>
            ))}
            {[
              { slot: 'a', d: a, color: colorA, dash: '0', values: cumA.slice(0, rounds) },
              { slot: 'b', d: b, color: colorB, dash: sameTeam ? '5 4' : '0', values: cumB.slice(0, rounds) },
            ].map((s) => (
              <g key={s.slot}>
                <polyline
                  points={polyline(s.values, px, py)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.4"
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <circle cx={px(s.values.length - 1)} cy={py(s.values[s.values.length - 1])} r="3" fill={s.color} />
                <text
                  x={px(s.values.length - 1) + 8}
                  y={py(s.values[s.values.length - 1]) + 4}
                  fill={s.color}
                  className="champ-chart-label"
                >
                  {s.d.name_acronym}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </section>

      <section className="rivalry-section" data-testid="rivalry-gap">
        <div className="champ-chart-head">
          <span className="champ-chart-title mono">
            Gap over season — {a.name_acronym} − {b.name_acronym}
          </span>
          <span className="champ-chart-meta">{gapCaption}</span>
        </div>
        <div className="champ-chart">
          <svg viewBox="0 0 1000 250" className="champ-chart-svg" preserveAspectRatio="none">
            {gyGrid.map((g) => (
              <g key={g.label}>
                <line
                  x1={PAD_L}
                  y1={g.y}
                  x2={930}
                  y2={g.y}
                  stroke={g.label === '0' ? 'var(--border-2)' : 'var(--border)'}
                  strokeWidth={g.label === '0' ? 1.5 : 1}
                />
                <text x={40} y={g.y + 4} textAnchor="end" className="champ-chart-axis">
                  {g.label}
                </text>
              </g>
            ))}
            {gxGrid.map((g, i) => (
              <text key={i} x={g.x} y={242} textAnchor="middle" className="champ-chart-axis">
                {g.label}
              </text>
            ))}
            <polyline
              points={polyline(gaps, px, gy)}
              fill="none"
              stroke={colorA}
              strokeWidth="2.4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={px(gaps.length - 1)} cy={gy(lastGap)} r="3" fill={colorA} />
          </svg>
        </div>
        <p className="rivalry-caption">
          Above the zero line: {a.name_acronym} ahead. Below: {b.name_acronym} ahead.
        </p>
      </section>
    </div>
  )
}

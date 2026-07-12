import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { fetchDriverSummary, fetchSeasons } from '../api'
import { DataNotice, RouteState } from '../components/RouteState'
import { teamColor } from '../utils'
import { countryFlag } from '../lib/gpIdentity'
import {
  formatDelta,
  formatPosition,
  gridFinishDeltas,
  type RoundDelta,
} from '../lib/driverProfile'
import type { DriverSummary } from '../types'
import '../styles/driver-profile.css'

interface Props {
  driverNumber: number
  year?: number
}

function fmtPts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function DriverProfilePage({ driverNumber, year }: Props) {
  // Without an explicit ?year=, default to the latest ingested season; if the
  // seasons list is empty/unavailable the backend falls back to the current year.
  const seasonsQuery = useQuery({
    queryKey: ['seasons'],
    queryFn: ({ signal }) => fetchSeasons(signal),
    enabled: year == null,
  })
  const resolvedYear = year ?? seasonsQuery.data?.[0]
  const seasonsSettled = year != null || !seasonsQuery.isLoading

  const summaryQuery = useQuery({
    queryKey: ['driver-summary', driverNumber, resolvedYear ?? 'latest'],
    queryFn: ({ signal }) => fetchDriverSummary(driverNumber, resolvedYear, signal),
    enabled: seasonsSettled && driverNumber > 0,
    staleTime: 5 * 60_000,
  })

  if (driverNumber <= 0) {
    return (
      <div className="page">
        <RouteState kind="empty" title="Invalid driver number" message="Pick a driver from the championship standings." />
      </div>
    )
  }
  if (!seasonsSettled || summaryQuery.isLoading) {
    return (
      <div className="page">
        <RouteState kind="loading" title="loading driver profile…" testId="driver-profile-loading" />
      </div>
    )
  }
  if (summaryQuery.isError) {
    return (
      <div className="page">
        <RouteState
          kind="error"
          title="Driver profile unavailable"
          error={summaryQuery.error}
          onRetry={() => {
            if (!summaryQuery.isFetching) void summaryQuery.refetch()
          }}
          retrying={summaryQuery.isFetching}
          testId="driver-profile-error"
        />
      </div>
    )
  }
  const summary = summaryQuery.data
  if (!summary) {
    return (
      <div className="page">
        <RouteState
          kind="empty"
          title="No driver data"
          message="This driver is not in the local season standings yet."
        />
      </div>
    )
  }
  return (
    <DriverProfileBody
      summary={summary}
      onRetry={() => {
        if (!summaryQuery.isFetching) void summaryQuery.refetch()
      }}
    />
  )
}

function DriverProfileBody({
  summary,
  onRetry,
}: {
  summary: DriverSummary
  onRetry?: () => void
}) {
  const color = teamColor(summary.team_colour)
  const deltas = gridFinishDeltas(summary.rounds)

  return (
    <div className="dp-page" data-testid="driver-profile">
      {summary.enrichment === 'limited' && (
        <DataNotice
          availability="limited"
          message="Optional remote details are unavailable. Showing local season identity and results."
          onRetry={onRetry}
          testId="driver-profile-limited"
        />
      )}
      {summary.source === 'local' && summary.enrichment !== 'limited' && (
        <DataNotice availability="local" message="Loaded from local season data." testId="driver-profile-local" />
      )}
      <header className="dp-header" data-testid="dp-header" style={{ borderLeftColor: color }}>
        <div className="dp-identity">
          <div className="dp-title-row">
            <span className="dp-code mono">{summary.name_acronym || `#${summary.driver_number}`}</span>
            <span className="dp-num mono" style={{ color }}>
              #{summary.driver_number}
            </span>
          </div>
          <h1 className="dp-name">{summary.full_name || `Driver ${summary.driver_number}`}</h1>
          <div className="dp-team">
            <span className="dp-team-swatch" style={{ background: color }} />
            {summary.team_name || 'Unknown team'}
            <span className="dp-season mono">{summary.season}</span>
          </div>
        </div>
        <div className="dp-stat-rail">
          <div className="dp-stat">
            <div className="dp-stat-value mono">{summary.position > 0 ? `P${summary.position}` : '—'}</div>
            <div className="dp-stat-label">Championship</div>
          </div>
          <div className="dp-stat">
            <div className="dp-stat-value mono">{fmtPts(summary.points)}</div>
            <div className="dp-stat-label">Points</div>
          </div>
          <div className="dp-stat">
            <div className="dp-stat-value mono">{summary.wins}</div>
            <div className="dp-stat-label">Wins</div>
          </div>
          <div className="dp-stat">
            <div className="dp-stat-value mono">{summary.podiums}</div>
            <div className="dp-stat-label">Podiums</div>
          </div>
          <div className="dp-stat">
            <div className="dp-stat-value mono">{summary.poles}</div>
            <div className="dp-stat-label">Poles</div>
          </div>
        </div>
        <Link to="/championship" className="dp-back mono">
          ← Championship
        </Link>
      </header>

      <section className="dp-section" data-testid="dp-form">
        <h2 className="dp-section-title mono">Season form</h2>
        {summary.cumulative.length > 0 ? (
          <div className="dp-form-grid">
            <CumulativeLine
              cumulative={summary.cumulative}
              labels={summary.round_labels}
              color={color}
            />
            <FormStrip form={summary.form} color={color} />
          </div>
        ) : (
          <div className="dp-empty">No completed rounds yet.</div>
        )}
      </section>

      <section className="dp-section" data-testid="dp-quali-race">
        <h2 className="dp-section-title mono">Quali vs race</h2>
        {deltas.some((d) => d.delta != null) ? (
          <GridVsRaceChart deltas={deltas} color={color} />
        ) : (
          <div className="dp-empty">No grid-vs-finish data yet.</div>
        )}
      </section>

      <section className="dp-section" data-testid="dp-rounds">
        <h2 className="dp-section-title mono">Track by track</h2>
        {summary.rounds.length > 0 ? (
          <RoundsTable summary={summary} deltas={deltas} />
        ) : (
          <div className="dp-empty">No completed rounds yet.</div>
        )}
      </section>
    </div>
  )
}

const LINE_W = 640
const LINE_H = 180
const LINE_PL = 44
const LINE_PR = 16
const LINE_PT = 12
const LINE_PB = 24

function CumulativeLine({
  cumulative,
  labels,
  color,
}: {
  cumulative: number[]
  labels: string[]
  color: string
}) {
  const n = cumulative.length
  const maxY = Math.max(25, ...cumulative)
  const plotW = LINE_W - LINE_PL - LINE_PR
  const plotH = LINE_H - LINE_PT - LINE_PB
  const x = (i: number) => (n <= 1 ? LINE_PL + plotW / 2 : LINE_PL + (i * plotW) / (n - 1))
  const y = (v: number) => LINE_PT + plotH - (v / maxY) * plotH
  const points = cumulative.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const tickStep = Math.max(1, Math.ceil(n / 8))
  const ticks: { x: number; label: string }[] = []
  for (let i = 0; i < n; i += tickStep) {
    ticks.push({ x: x(i), label: labels[i] ?? `R${i + 1}` })
  }

  return (
    <figure className="dp-chart">
      <figcaption className="dp-chart-caption mono">Cumulative points</figcaption>
      <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} className="dp-chart-svg" role="img" aria-label="Cumulative points per round">
        {[0, 0.5, 1].map((f) => {
          const v = Math.round(maxY * f)
          return (
            <g key={f}>
              <line x1={LINE_PL} y1={y(v)} x2={LINE_W - LINE_PR} y2={y(v)} className="dp-gridline" />
              <text x={LINE_PL - 6} y={y(v) + 3} textAnchor="end" className="dp-axis">
                {v}
              </text>
            </g>
          )
        })}
        {ticks.map((t) => (
          <text key={t.label} x={t.x} y={LINE_H - 8} textAnchor="middle" className="dp-axis">
            {t.label}
          </text>
        ))}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx={x(n - 1)} cy={y(cumulative[n - 1])} r="3.2" fill={color} />
      </svg>
    </figure>
  )
}

function FormStrip({ form, color }: { form: number[]; color: string }) {
  const max = Math.max(25, ...form)
  return (
    <div className="dp-form-strip">
      <div className="dp-chart-caption mono">Last {form.length} races</div>
      <div className="dp-form-bars">
        {form.map((pts, i) => (
          <div className="dp-form-bar" key={i} title={`${fmtPts(pts)} pts`}>
            <div
              className="dp-form-bar-fill"
              style={{ height: `${Math.max(4, (pts / max) * 100)}%`, background: color }}
            />
            <span className="dp-form-bar-val mono">{fmtPts(pts)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const DELTA_H = 190
const DELTA_PT = 14
const DELTA_PB = 30

function GridVsRaceChart({ deltas, color }: { deltas: RoundDelta[]; color: string }) {
  const maxAbs = Math.max(1, ...deltas.map((d) => Math.abs(d.delta ?? 0)))
  const colW = 34
  const w = Math.max(240, deltas.length * colW)
  const plotH = DELTA_H - DELTA_PT - DELTA_PB
  const zeroY = DELTA_PT + plotH / 2
  const scale = plotH / 2 / maxAbs

  return (
    <figure className="dp-chart">
      <figcaption className="dp-chart-caption mono">
        Positions gained (▲) / lost (▼) from grid to flag, per round
      </figcaption>
      <div className="dp-chart-scroll">
        <svg
          viewBox={`0 0 ${w} ${DELTA_H}`}
          width={w}
          height={DELTA_H}
          className="dp-delta-svg"
          role="img"
          aria-label="Positions gained or lost per round"
        >
          <line x1={0} y1={zeroY} x2={w} y2={zeroY} className="dp-zeroline" />
          {deltas.map((d, i) => {
            const cx = i * colW + colW / 2
            if (d.delta == null) {
              return (
                <g key={d.round}>
                  <text x={cx} y={zeroY - 6} textAnchor="middle" className="dp-axis">
                    ·
                  </text>
                  <text x={cx} y={DELTA_H - 8} textAnchor="middle" className="dp-axis">
                    R{d.round}
                  </text>
                </g>
              )
            }
            const h = Math.abs(d.delta) * scale
            const yTop = d.delta >= 0 ? zeroY - h : zeroY
            return (
              <g key={d.round}>
                <title>{`${d.label}: ${formatPosition(d.grid)} → ${formatPosition(d.finish)} (${formatDelta(d.delta)})`}</title>
                <rect
                  x={cx - 8}
                  y={yTop}
                  width={16}
                  height={Math.max(1.5, h)}
                  rx={2}
                  fill={color}
                  opacity={d.delta >= 0 ? 0.95 : 0.45}
                />
                <text
                  x={cx}
                  y={d.delta >= 0 ? yTop - 4 : yTop + h + 11}
                  textAnchor="middle"
                  className="dp-delta-val mono"
                >
                  {formatDelta(d.delta)}
                </text>
                <text x={cx} y={DELTA_H - 8} textAnchor="middle" className="dp-axis">
                  R{d.round}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </figure>
  )
}

function statusNote(d: RoundDelta): string {
  if (d.status === 'dnf') return 'DNF'
  if (d.status === 'dns') return 'DNS'
  if (d.status === 'dsq') return 'DSQ'
  if (d.status === 'absent') return '—'
  return ''
}

function RoundsTable({ summary, deltas }: { summary: DriverSummary; deltas: RoundDelta[] }) {
  return (
    <div className="dp-scroll">
      <table className="dp-table">
        <thead>
          <tr>
            <th className="l">Rnd</th>
            <th className="l">Grand Prix</th>
            <th className="r">Grid</th>
            <th className="r">Race</th>
            <th className="r">Δ</th>
            <th className="r">Pts</th>
            <th className="l"></th>
          </tr>
        </thead>
        <tbody>
          {summary.rounds.map((r, i) => {
            const d = deltas[i]
            return (
              <tr key={r.meeting_key}>
                <td className="mono dp-td-dim">R{i + 1}</td>
                <td>
                  <span className="dp-flag" aria-hidden="true">
                    {countryFlag({ country_code: r.country_code, country_flag: '' })}
                  </span>
                  {r.meeting_name}
                </td>
                <td className="r mono">{formatPosition(d.grid)}</td>
                <td className="r mono">{formatPosition(d.finish)}</td>
                <td
                  className="r mono"
                  style={{
                    color:
                      d.delta == null
                        ? 'var(--text-3)'
                        : d.delta > 0
                          ? 'var(--green)'
                          : d.delta < 0
                            ? 'var(--red)'
                            : 'var(--text-2)',
                  }}
                >
                  {formatDelta(d.delta)}
                </td>
                <td className="r mono">{fmtPts(r.points)}</td>
                <td className="dp-td-dim mono">{statusNote(d)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

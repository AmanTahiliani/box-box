import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChampionshipHub, fetchSeasons } from '../api'
import { teamColor } from '../utils'
import type { ChampHubDriver, ChampionshipHub } from '../types'

type View = 'drivers' | 'constructors' | 'progression'

const GOLD = '#ffd700'
const SILVER = '#c0c0c0'
const BRONZE = '#cd7f32'

function medalColor(pos: number): string {
  if (pos === 1) return GOLD
  if (pos === 2) return SILVER
  if (pos === 3) return BRONZE
  return 'var(--text-2)'
}

function ghostColor(pos: number): string {
  if (pos === 1) return 'rgba(255,215,0,0.08)'
  if (pos === 2) return 'rgba(192,192,192,0.07)'
  if (pos === 3) return 'rgba(205,127,50,0.07)'
  return 'rgba(255,255,255,0.03)'
}

function fmtPts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** Sparkline polyline points inside a 62×20 box. */
function sparkPoints(form: number[]): string {
  if (!form.length) return ''
  const fmax = Math.max(25, ...form)
  const n = form.length
  return form
    .map((v, k) => {
      const x = n === 1 ? 0 : (k * 62) / (n - 1)
      const y = 18 - (fmax > 0 ? (v / fmax) * 16 : 0)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

interface TeamSplit {
  driverA: string
  ptsA: number
  driverB: string
  ptsB: number
  splitA: number
  splitB: number
  shareLabel: string
}

function teamSplit(teamName: string, drivers: ChampHubDriver[]): TeamSplit {
  const ds = drivers.filter((d) => d.team_name === teamName).sort((a, b) => b.points - a.points)
  const a = ds[0]
  const b = ds[1]
  const ptsA = a?.points ?? 0
  const ptsB = b?.points ?? 0
  const total = ptsA + ptsB || 1
  const splitA = Math.round((ptsA / total) * 100)
  return {
    driverA: a?.name_acronym ?? '—',
    ptsA,
    driverB: b?.name_acronym ?? '—',
    ptsB,
    splitA,
    splitB: 100 - splitA,
    shareLabel: `${splitA}/${100 - splitA}`,
  }
}

export function ChampionshipPage() {
  const [view, setView] = useState<View>('drivers')

  const seasonsQuery = useQuery({ queryKey: ['seasons'], queryFn: fetchSeasons })
  const latestSeason = seasonsQuery.data?.[0] ?? null

  const hubQuery = useQuery({
    queryKey: ['championship-hub', latestSeason],
    queryFn: () => fetchChampionshipHub(latestSeason ?? undefined),
    enabled: latestSeason != null,
    staleTime: 5 * 60_000,
  })

  if (seasonsQuery.isLoading || hubQuery.isLoading) {
    return <div className="page loading-state">loading championship…</div>
  }
  if (hubQuery.isError) {
    return (
      <div className="page error-box">
        {hubQuery.error instanceof Error ? hubQuery.error.message : 'Failed to load championship'}
      </div>
    )
  }

  const hub = hubQuery.data
  if (!hub || hub.drivers.length === 0) {
    return (
      <div className="champ-page champ-empty" data-testid="championship-empty">
        <div className="champ-empty-band">
          <span className="champ-empty-eyebrow mono">box-box · championship</span>
          <h1 className="champ-empty-title">No championship data</h1>
          <p className="champ-empty-sub">
            Standings for {latestSeason ?? 'this season'} are not available yet. Once race results are
            ingested they will appear here.
          </p>
        </div>
      </div>
    )
  }

  return <ChampionshipBody hub={hub} view={view} setView={setView} />
}

interface BodyProps {
  hub: ChampionshipHub
  view: View
  setView: (v: View) => void
}

function ChampionshipBody({ hub, view, setView }: BodyProps) {
  const { drivers, teams } = hub
  const leader = drivers[0]
  const remaining = hub.rounds_left * 25

  const enriched = useMemo<EnrichedDriver[]>(
    () =>
      drivers.map((d, i) => {
        const gapLeaderNum = leader.points - d.points
        const gapAheadNum = i === 0 ? null : drivers[i - 1].points - d.points
        const alive = i === 0 || gapLeaderNum <= remaining
        return {
          d,
          pos: d.position,
          color: teamColor(d.team_colour),
          gapLeader: i === 0 ? 'LEADER' : `+${fmtPts(gapLeaderNum)}`,
          gapAhead: gapAheadNum == null ? '—' : `+${fmtPts(gapAheadNum)}`,
          spark: sparkPoints(d.form),
          h2h: `${d.teammate_wins}–${d.teammate_losses}`,
          h2hWin: d.teammate_wins >= d.teammate_losses,
          aliveLabel: i === 0 ? 'LEADS' : alive ? 'ALIVE' : 'OUT',
          aliveColor: i === 0 ? GOLD : alive ? 'var(--green)' : 'var(--text-3)',
        }
      }),
    [drivers, leader, remaining],
  )

  const aliveCount = enriched.filter((e) => e.aliveLabel === 'ALIVE' || e.aliveLabel === 'LEADS').length

  const titleMath =
    `${aliveCount} driver${aliveCount === 1 ? '' : 's'} can still mathematically win the title. ` +
    `With ${hub.rounds_left} round${hub.rounds_left === 1 ? '' : 's'} left (max ${remaining} pts), ` +
    `${leader.name_acronym} leads ` +
    (drivers[1] ? `${drivers[1].name_acronym} by ${fmtPts(leader.points - drivers[1].points)}` : 'the field') +
    (drivers[2] ? ` and ${drivers[2].name_acronym} by ${fmtPts(leader.points - drivers[2].points)}.` : '.')

  const topTeam = teams[0]
  const teamGap = teams[1] ? topTeam.points - teams[1].points : 0
  const seasonPct = hub.total_rounds > 0 ? Math.round((hub.round / hub.total_rounds) * 100) : 0

  const statRail = [
    { label: 'Drivers Leader', value: leader.name_acronym, sub: `${fmtPts(leader.points)} pts · ${leader.wins} wins`, color: '#fff' },
    {
      label: 'Constructors Leader',
      value: topTeam?.team_name ?? '—',
      sub: teams[1] ? `+${fmtPts(teamGap)} ahead` : 'Sole entry',
      color: '#fff',
    },
    { label: 'Title Fight', value: `${aliveCount} alive`, sub: `${hub.rounds_left} rounds remain`, color: 'var(--red)' },
    { label: 'Season Progress', value: `${seasonPct}%`, sub: `Round ${hub.round}/${hub.total_rounds}`, color: '#fff' },
  ]

  return (
    <div className="champ-page" data-testid="championship">
      <div className="champ-header">
        <div className="champ-title-row">
          <span className="champ-accent" aria-hidden="true" />
          <h1 className="champ-title">Championship</h1>
          <span className="champ-season mono">{hub.season}</span>
        </div>
        <div className="champ-sub">
          {hub.last_race ? `After ${hub.last_race} · ` : ''}Round {hub.round} of {hub.total_rounds}
        </div>
        <div className="champ-tabs" role="tablist">
          <button
            type="button"
            className={`champ-tab${view === 'drivers' ? ' is-active' : ''}`}
            onClick={() => setView('drivers')}
            data-testid="champ-tab-drivers"
          >
            Drivers
          </button>
          <button
            type="button"
            className={`champ-tab${view === 'constructors' ? ' is-active' : ''}`}
            onClick={() => setView('constructors')}
            data-testid="champ-tab-constructors"
          >
            Constructors
          </button>
          <button
            type="button"
            className={`champ-tab${view === 'progression' ? ' is-active' : ''}`}
            onClick={() => setView('progression')}
            data-testid="champ-tab-progression"
          >
            Progression
          </button>
        </div>
      </div>

      <div className="champ-stat-rail">
        {statRail.map((stat) => (
          <div className="champ-stat" key={stat.label}>
            <div className="champ-stat-label mono">{stat.label}</div>
            <div className="champ-stat-value mono" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="champ-stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      {view === 'drivers' && (
        <DriversView enriched={enriched} leaderPoints={leader.points} titleMath={titleMath} />
      )}
      {view === 'constructors' && <ConstructorsView hub={hub} />}
      {view === 'progression' && <ProgressionView hub={hub} />}
    </div>
  )
}

interface EnrichedDriver {
  d: ChampHubDriver
  pos: number
  color: string
  gapLeader: string
  gapAhead: string
  spark: string
  h2h: string
  h2hWin: boolean
  aliveLabel: string
  aliveColor: string
}

function DriversView({
  enriched,
  leaderPoints,
  titleMath,
}: {
  enriched: EnrichedDriver[]
  leaderPoints: number
  titleMath: string
}) {
  const podium = enriched.slice(0, 3)
  return (
    <div data-testid="champ-view-drivers">
      <div className="champ-podium">
        {podium.map((e) => (
          <div
            className="champ-podium-card"
            key={e.d.driver_number}
            style={{ borderTopColor: e.color }}
          >
            <span className="champ-podium-ghost mono" style={{ color: ghostColor(e.pos) }}>
              P{e.pos}
            </span>
            <div className="champ-podium-inner">
              <div className="champ-podium-top">
                <span className="mono" style={{ color: medalColor(e.pos), fontWeight: 700 }}>
                  P{e.pos}
                </span>
                <span className="champ-podium-team mono">{e.d.team_name}</span>
              </div>
              <div className="champ-podium-id">
                <span className="champ-podium-bar" style={{ background: e.color }} />
                <span className="champ-podium-code mono">{e.d.name_acronym}</span>
              </div>
              <div className="champ-podium-name">{e.d.full_name}</div>
              <div className="champ-podium-pts">
                <span className="champ-podium-pts-num mono">{fmtPts(e.d.points)}</span>
                <span className="champ-podium-pts-unit">PTS</span>
                <span
                  className="champ-podium-gap mono"
                  style={{ color: e.pos === 1 ? GOLD : 'var(--text-2)' }}
                >
                  {e.pos === 1 ? 'P1' : `+${fmtPts(leaderPoints - e.d.points)}`}
                </span>
              </div>
              <div className="champ-podium-stats">
                <div>
                  <div className="champ-podium-stat-num mono">{e.d.wins}</div>
                  <div className="champ-podium-stat-label">Wins</div>
                </div>
                <div>
                  <div className="champ-podium-stat-num mono">{e.d.podiums}</div>
                  <div className="champ-podium-stat-label">Podiums</div>
                </div>
                <div>
                  <div className="champ-podium-stat-num mono">{e.d.poles}</div>
                  <div className="champ-podium-stat-label">Poles</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="champ-titlemath" data-testid="champ-titlemath">
        <span className="champ-titlemath-tag mono">Title Math</span>
        <span className="champ-titlemath-text">{titleMath}</span>
      </div>

      <div className="champ-scroll">
        <table className="champ-table champ-table-drivers">
          <thead>
            <tr>
              <th className="l">Pos</th>
              <th className="l">Driver</th>
              <th className="l">Team</th>
              <th className="r">Pts</th>
              <th className="r">Gap</th>
              <th className="r">Int</th>
              <th className="c">Wins</th>
              <th className="c">Pod</th>
              <th className="l">Form</th>
              <th className="c">vs Teammate</th>
              <th className="r">Title</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map((e) => (
              <tr key={e.d.driver_number}>
                <td className="mono" style={{ color: medalColor(e.pos), fontWeight: 700 }}>
                  P{e.pos}
                </td>
                <td>
                  <div className="champ-drv">
                    <span className="champ-drv-bar" style={{ background: e.color }} />
                    <span className="champ-drv-code mono">{e.d.name_acronym}</span>
                    <span className="champ-drv-name">{e.d.full_name}</span>
                    <span className="champ-drv-num mono">#{e.d.driver_number}</span>
                  </div>
                </td>
                <td className="champ-td-team">{e.d.team_name}</td>
                <td className="r mono champ-td-pts">{fmtPts(e.d.points)}</td>
                <td className="r mono champ-td-muted">{e.gapLeader}</td>
                <td className="r mono champ-td-dim">{e.gapAhead}</td>
                <td className="c mono" style={{ color: e.d.wins > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                  {e.d.wins}
                </td>
                <td className="c mono champ-td-muted">{e.d.podiums}</td>
                <td>
                  {e.spark ? (
                    <svg width="62" height="20" viewBox="0 0 62 20" className="champ-spark">
                      <polyline
                        points={e.spark}
                        fill="none"
                        stroke={e.color}
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        opacity="0.9"
                      />
                    </svg>
                  ) : (
                    <span className="champ-td-dim mono">—</span>
                  )}
                </td>
                <td className="c mono" style={{ color: e.h2hWin ? 'var(--green)' : 'var(--text-2)' }}>
                  {e.h2h}
                </td>
                <td className="r">
                  <span className="champ-alive mono" style={{ color: e.aliveColor }}>
                    {e.aliveLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ConstructorsView({ hub }: { hub: ChampionshipHub }) {
  const { teams, drivers } = hub
  const leaderPts = teams[0]?.points ?? 0
  const podium = teams.slice(0, 3)

  return (
    <div data-testid="champ-view-constructors">
      <div className="champ-podium">
        {podium.map((t) => {
          const color = teamColor(t.team_colour)
          const split = teamSplit(t.team_name, drivers)
          return (
            <div className="champ-podium-card" key={t.team_name} style={{ borderTopColor: color }}>
              <span className="champ-podium-ghost mono" style={{ color: ghostColor(t.position) }}>
                P{t.position}
              </span>
              <div className="champ-podium-inner">
                <div className="champ-podium-top">
                  <span className="mono" style={{ color: medalColor(t.position), fontWeight: 700 }}>
                    P{t.position}
                  </span>
                </div>
                <div className="champ-podium-id">
                  <span className="champ-podium-bar" style={{ background: color }} />
                  <span className="champ-podium-team-name">{t.team_name}</span>
                </div>
                <div className="champ-podium-pts">
                  <span className="champ-podium-pts-num mono">{fmtPts(t.points)}</span>
                  <span className="champ-podium-pts-unit">PTS</span>
                  <span
                    className="champ-podium-gap mono"
                    style={{ color: t.position === 1 ? GOLD : 'var(--text-2)' }}
                  >
                    {t.position === 1 ? 'P1' : `+${fmtPts(leaderPts - t.points)}`}
                  </span>
                </div>
                <div className="champ-contrib">
                  <div className="champ-contrib-bar">
                    <span style={{ width: `${split.splitA}%`, background: color }} />
                    <span style={{ width: `${split.splitB}%`, background: color, opacity: 0.4 }} />
                  </div>
                  <div className="champ-contrib-legend mono">
                    <span>
                      {split.driverA} <em>{fmtPts(split.ptsA)}</em>
                    </span>
                    <span>
                      {split.driverB} <em>{fmtPts(split.ptsB)}</em>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="champ-scroll">
        <table className="champ-table champ-table-teams">
          <thead>
            <tr>
              <th className="l">Pos</th>
              <th className="l">Constructor</th>
              <th className="r">Pts</th>
              <th className="r">Gap</th>
              <th className="c">Wins</th>
              <th className="l">Driver Contribution</th>
              <th className="r">Share</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const color = teamColor(t.team_colour)
              const split = teamSplit(t.team_name, drivers)
              return (
                <tr key={t.team_name}>
                  <td className="mono" style={{ color: medalColor(t.position), fontWeight: 700 }}>
                    P{t.position}
                  </td>
                  <td>
                    <div className="champ-drv">
                      <span className="champ-drv-bar" style={{ background: color }} />
                      <span className="champ-team-name">{t.team_name}</span>
                    </div>
                  </td>
                  <td className="r mono champ-td-pts">{fmtPts(t.points)}</td>
                  <td className="r mono champ-td-muted">
                    {t.position === 1 ? 'LEADER' : `+${fmtPts(leaderPts - t.points)}`}
                  </td>
                  <td className="c mono" style={{ color: t.wins > 0 ? 'var(--text)' : 'var(--text-3)' }}>
                    {t.wins}
                  </td>
                  <td>
                    <div className="champ-contrib-row">
                      <div className="champ-contrib-bar">
                        <span style={{ width: `${split.splitA}%`, background: color }} />
                        <span style={{ width: `${split.splitB}%`, background: color, opacity: 0.4 }} />
                      </div>
                      <span className="champ-contrib-names mono">
                        {split.driverA}
                        <em> · </em>
                        {split.driverB}
                      </span>
                    </div>
                  </td>
                  <td className="r mono champ-td-dim">{split.shareLabel}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const CHART_PAD_L = 48
const CHART_PAD_T = 16
const CHART_PLOT_W = 882
const CHART_PLOT_H = 316

function ProgressionView({ hub }: { hub: ChampionshipHub }) {
  const top = hub.drivers.slice(0, 6).filter((d) => d.cumulative.length > 0)

  if (top.length === 0) {
    return (
      <div className="champ-chart-empty" data-testid="champ-view-progression">
        No completed rounds yet — progression will appear after the first race.
      </div>
    )
  }

  const N = Math.max(...top.map((d) => d.cumulative.length))
  const peak = Math.max(...top.flatMap((d) => d.cumulative))
  const maxY = Math.max(100, Math.ceil(peak / 100) * 100)

  const x = (i: number) => (N <= 1 ? CHART_PAD_L : CHART_PAD_L + (i * CHART_PLOT_W) / (N - 1))
  const y = (v: number) => CHART_PAD_T + CHART_PLOT_H - (v / maxY) * CHART_PLOT_H

  const yGrid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const value = Math.round(maxY * f)
    const yy = y(value)
    return { y: yy, label: value }
  })

  // x ticks: up to ~7 evenly spaced round labels.
  const tickStep = Math.max(1, Math.ceil(N / 7))
  const xGrid: { x: number; label: string }[] = []
  for (let i = 0; i < N; i += tickStep) {
    xGrid.push({ x: x(i), label: hub.round_labels[i] ?? `R${i + 1}` })
  }
  if (xGrid[xGrid.length - 1]?.label !== (hub.round_labels[N - 1] ?? `R${N}`)) {
    xGrid.push({ x: x(N - 1), label: hub.round_labels[N - 1] ?? `R${N}` })
  }

  const seenTeams = new Set<string>()
  const series = top.map((d, idx) => {
    const dashed = seenTeams.has(d.team_name)
    seenTeams.add(d.team_name)
    const pts = d.cumulative.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    const endVal = d.cumulative[d.cumulative.length - 1]
    const endX = x(d.cumulative.length - 1)
    const endY = y(endVal)
    return {
      code: d.name_acronym,
      name: d.full_name,
      total: d.points,
      color: teamColor(d.team_colour),
      width: idx < 3 ? 2.4 : 1.8,
      dash: dashed ? '5 4' : '0',
      points: pts,
      endX,
      endY,
    }
  })

  return (
    <div className="champ-progression" data-testid="champ-view-progression">
      <div className="champ-chart-head">
        <span className="champ-chart-title mono">Cumulative points — top {top.length} drivers</span>
        <span className="champ-chart-meta">
          Rounds 1–{hub.round} · {hub.season}
        </span>
      </div>
      <div className="champ-chart">
        <svg viewBox="0 0 1000 380" className="champ-chart-svg" preserveAspectRatio="none">
          {yGrid.map((g) => (
            <g key={g.label}>
              <line x1={CHART_PAD_L} y1={g.y} x2={930} y2={g.y} stroke="var(--border)" strokeWidth="1" />
              <text x={40} y={g.y + 4} textAnchor="end" className="champ-chart-axis">
                {g.label}
              </text>
            </g>
          ))}
          {xGrid.map((g, i) => (
            <text key={i} x={g.x} y={372} textAnchor="middle" className="champ-chart-axis">
              {g.label}
            </text>
          ))}
          {series.map((s) => (
            <g key={s.code}>
              <polyline
                points={s.points}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={s.endX} cy={s.endY} r="3" fill={s.color} />
              <text x={s.endX + 8} y={s.endY + 4} fill={s.color} className="champ-chart-label">
                {s.code}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="champ-legend">
        {series.map((s) => (
          <div className="champ-legend-item" key={s.code}>
            <span className="champ-legend-swatch" style={{ background: s.color }} />
            <span className="champ-legend-code mono">{s.code}</span>
            <span className="champ-legend-name">{s.name}</span>
            <span className="champ-legend-total mono">{fmtPts(s.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

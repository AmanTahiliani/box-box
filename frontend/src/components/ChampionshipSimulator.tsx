import { useEffect, useMemo, useState } from 'react'
import type { ChampionshipHub } from '../types'
import { teamColor } from '../utils'
import {
  assignPosition,
  defaultRound,
  defaultScenario,
  normalizeScenario,
  pointsForPosition,
  projectStandings,
} from '../lib/simulator'
import type { Scenario } from '../lib/simulator'

const STORAGE_PREFIX = 'box-box.champ.sim'

function storageKey(season: number): string {
  return `${STORAGE_PREFIX}.${season}`
}

function loadScenario(hub: ChampionshipHub): Scenario {
  try {
    const raw = window.localStorage.getItem(storageKey(hub.season))
    if (!raw) return defaultScenario(hub.drivers, hub.rounds_left)
    return normalizeScenario(JSON.parse(raw), hub.drivers, hub.rounds_left)
  } catch {
    return defaultScenario(hub.drivers, hub.rounds_left)
  }
}

function saveScenario(season: number, scenario: Scenario) {
  try {
    window.localStorage.setItem(storageKey(season), JSON.stringify(scenario))
  } catch {
    // storage unavailable (private mode, quota) — simulator still works in memory
  }
}

/** Label for the i-th remaining round (0-based), e.g. "R7" or "Round 7". */
function roundLabel(hub: ChampionshipHub, index: number): string {
  return hub.round_labels[hub.round + index] ?? `Round ${hub.round + index + 1}`
}

function fmtPts(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function ChampionshipSimulator({ hub }: { hub: ChampionshipHub }) {
  const [scenario, setScenario] = useState<Scenario>(() => loadScenario(hub))
  const [selected, setSelected] = useState(0)

  // Reload when the season changes (new hub, new storage key).
  useEffect(() => {
    setScenario(loadScenario(hub))
    setSelected(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hub.season, hub.rounds_left])

  useEffect(() => {
    if (scenario.length > 0) saveScenario(hub.season, scenario)
  }, [hub.season, scenario])

  const projected = useMemo(
    () => projectStandings(hub.drivers, scenario, hub.rounds_left),
    [hub.drivers, scenario, hub.rounds_left],
  )

  if (hub.rounds_left <= 0 || hub.drivers.length === 0 || scenario.length === 0) {
    return (
      <div className="champ-chart-empty" data-testid="champ-view-simulator">
        Season complete — nothing left to simulate.
      </div>
    )
  }

  const roundIdx = Math.min(selected, scenario.length - 1)
  const round = scenario[roundIdx]

  const setRound = (nextRound: (number | null)[]) => {
    setScenario((prev) => prev.map((r, i) => (i === roundIdx ? nextRound : r)))
  }

  const driverByNumber = new Map(hub.drivers.map((d) => [d.driver_number, d]))

  return (
    <div className="champ-sim" data-testid="champ-view-simulator">
      <div className="champ-sim-head">
        <span className="champ-chart-title mono">What-if simulator — remaining rounds</span>
        <button
          type="button"
          className="champ-sim-btn"
          onClick={() => setScenario(defaultScenario(hub.drivers, hub.rounds_left))}
          data-testid="sim-reset-all"
        >
          Reset all
        </button>
      </div>

      <div className="champ-sim-rounds" role="tablist" aria-label="Remaining rounds">
        {scenario.map((_, i) => (
          <button
            key={i}
            type="button"
            className={`champ-sim-round${i === roundIdx ? ' is-active' : ''}`}
            onClick={() => setSelected(i)}
            data-testid={`sim-round-${i}`}
          >
            {roundLabel(hub, i)}
          </button>
        ))}
      </div>

      <div className="champ-sim-grid">
        <div className="champ-sim-editor" data-testid="sim-editor">
          <div className="champ-sim-editor-head">
            <span className="champ-sim-editor-title mono">{roundLabel(hub, roundIdx)} finishing order</span>
            <button
              type="button"
              className="champ-sim-btn"
              onClick={() => setRound(defaultRound(hub.drivers))}
              data-testid="sim-reset-round"
            >
              Reset round
            </button>
          </div>
          {round.map((driverNumber, p) => {
            const driver = driverNumber != null ? driverByNumber.get(driverNumber) : undefined
            return (
              <div className="champ-sim-slot" key={p}>
                <span className="champ-sim-slot-pos mono">P{p + 1}</span>
                <span
                  className="champ-sim-slot-bar"
                  style={{ background: driver ? teamColor(driver.team_colour) : 'var(--border)' }}
                />
                <select
                  className="champ-sim-select mono"
                  value={driverNumber ?? ''}
                  aria-label={`P${p + 1} driver`}
                  data-testid={`sim-pos-${p + 1}`}
                  onChange={(e) => {
                    const value = e.target.value
                    setRound(assignPosition(round, p, value === '' ? null : Number(value)))
                  }}
                >
                  <option value="">—</option>
                  {hub.drivers.map((d) => (
                    <option key={d.driver_number} value={d.driver_number}>
                      {d.name_acronym} · {d.full_name}
                    </option>
                  ))}
                </select>
                <span className="champ-sim-slot-pts mono">+{pointsForPosition(p + 1)}</span>
              </div>
            )
          })}
        </div>

        <div className="champ-sim-table-wrap">
          <div className="champ-sim-editor-head">
            <span className="champ-sim-editor-title mono">Projected standings</span>
          </div>
          <div className="champ-scroll">
            <table className="champ-table champ-sim-table" data-testid="sim-projected">
              <thead>
                <tr>
                  <th className="l">Pos</th>
                  <th className="c">Δ</th>
                  <th className="l">Driver</th>
                  <th className="r">Now</th>
                  <th className="r">+Sim</th>
                  <th className="r">Proj</th>
                  <th className="r">Title</th>
                </tr>
              </thead>
              <tbody>
                {projected.map((row) => {
                  const d = row.driver
                  const moved = row.delta !== 0
                  return (
                    <tr
                      key={d.driver_number}
                      className={moved ? 'champ-sim-row-moved' : undefined}
                      data-testid={`sim-row-${d.driver_number}`}
                    >
                      <td className="mono" style={{ fontWeight: 700 }}>
                        P{row.projectedPosition}
                      </td>
                      <td className="c mono">
                        {row.delta > 0 && (
                          <span className="champ-sim-delta up">▲{row.delta}</span>
                        )}
                        {row.delta < 0 && (
                          <span className="champ-sim-delta down">▼{-row.delta}</span>
                        )}
                        {row.delta === 0 && <span className="champ-td-dim">—</span>}
                      </td>
                      <td>
                        <div className="champ-drv">
                          <span
                            className="champ-drv-bar"
                            style={{ background: teamColor(d.team_colour) }}
                          />
                          <span className="champ-drv-code mono">{d.name_acronym}</span>
                          <span className="champ-drv-name">{d.full_name}</span>
                        </div>
                      </td>
                      <td className="r mono champ-td-muted">{fmtPts(row.currentPoints)}</td>
                      <td className="r mono champ-td-dim">+{fmtPts(row.simPoints)}</td>
                      <td className="r mono champ-td-pts">{fmtPts(row.projectedPoints)}</td>
                      <td className="r">
                        <span
                          className="champ-alive mono"
                          style={{ color: row.titleAlive ? 'var(--green)' : 'var(--text-3)' }}
                        >
                          {row.titleAlive ? 'ALIVE' : 'OUT'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <p className="champ-sim-caption">
        Simplified model: every remaining round is scored as a standard Grand Prix
        (25-18-15-12-10-8-6-4-2-1, no fastest-lap point). Sprint weekends are ignored. Title status
        uses the max-points-remaining bound against the leader&apos;s projected total.
      </p>
    </div>
  )
}

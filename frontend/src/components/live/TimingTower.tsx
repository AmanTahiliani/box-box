import { useState, useMemo, Fragment } from 'react'
import { teamColor } from '../../utils'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import type { LiveSessionMeta, LiveStintData } from '../../types'
import type { LiveTimingRow } from '../../lib/live'
import {
  bestLapGaps,
  driverCode,
  liveSessionDisplay,
  positionDelta,
  positionDeltaClass,
  tyreClass,
  tyreLabel,
} from '../../lib/live'
import type { GapHistoryMap } from '../../lib/gapHistory'
import { parseIntervalSeconds } from '../../lib/gapHistory'
import { intervalMeaning } from '../../lib/meaning'
import { Meaning } from '../Meaning'
import { GapSparkline } from './GapSparkline'
import { StintHistory } from './StintHistory'
import { Pin } from 'lucide-react'

interface Props {
  rows: LiveTimingRow[]
  stints?: Record<string, LiveStintData[]>
  history?: GapHistoryMap
  battleNumbers?: Set<string>
  pinned?: string[]
  onTogglePin?: (racingNumber: string) => void
  session?: LiveSessionMeta
}

function posClass(pos: number): string {
  if (pos === 1) return 'pos-p1'
  if (pos === 2) return 'pos-p2'
  if (pos === 3) return 'pos-p3'
  return 'pos-n'
}

export function TimingTower({
  rows,
  stints,
  history,
  battleNumbers,
  pinned,
  onTogglePin,
  session,
}: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [gapMode, setGapMode] = useState<'interval' | 'leader'>('interval')
  const [listRef] = useAutoAnimate<HTMLTableSectionElement>({ duration: 300, easing: 'ease-out' })

  if (rows.length === 0) {
    return (
      <div className="missing-notice">
        Live timing is connected, but no driver timing rows have arrived yet.
      </div>
    )
  }

  const sessionDisplay = liveSessionDisplay(session, rows)
  const isRace = sessionDisplay.isRace
  const isQuali = sessionDisplay.isQualifying || !isRace
  const columnCount = 7 + (isRace ? 3 : 0) + (isQuali ? 3 : 0)

  // Practice/qualifying: derive a display-only gap to P1 from valid best laps
  // when the upstream feed omits GapToLeader. Empty for races (feed is truth).
  const practiceGaps = useMemo(() => bestLapGaps(isRace ? [] : rows), [isRace, rows])

  return (
    <div className="scroll-x">
      <table className="data-table live-tower" style={{ minWidth: 760 }}>
        <thead>
          <tr>
            <th>Pos</th>
            {isRace && <th>Δ</th>}
            <th>Driver</th>
            <th>Tyre</th>
            <th className={isRace ? undefined : 'hide-mobile'}>Last Lap</th>
            <th
              className="interactive"
              onClick={() => setGapMode(g => g === 'interval' ? 'leader' : 'interval')}
              title="Click to toggle Gap vs Interval"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              {gapMode === 'interval' && isRace ? 'Interval' : 'Gap to P1'}
            </th>
            {isRace && <th>Trend</th>}
            {isQuali && <th className="hide-mobile">S1</th>}
            {isQuali && <th className="hide-mobile">S2</th>}
            {isQuali && <th className="hide-mobile">S3</th>}
            <th className={isRace ? 'hide-mobile' : undefined}>Best</th>
            {isRace && <th className="hide-mobile r">Laps</th>}
            <th className="r"></th>
          </tr>
        </thead>
        <tbody ref={listRef}>
          {rows.map((row) => {
            const driver = row.Driver
            const delta = positionDelta(driver)
            const deltaClass = positionDeltaClass(driver)
            const isPinned = pinned?.includes(row.RacingNumber) ?? false
            const inBattle = battleNumbers?.has(row.RacingNumber) ?? false
            const isExpanded = expandedRow === row.RacingNumber
            const isAtRisk =
              Boolean(sessionDisplay.cutoffPosition && row.Position > sessionDisplay.cutoffPosition) ||
              driver.Cutoff
            const showCutoffAfter = row.Position === sessionDisplay.cutoffPosition

            let gapText: string
            if (isRace) {
              gapText = gapMode === 'interval' ? (driver.Interval || driver.GapToLeader) : driver.GapToLeader
            } else if (driver.GapToLeader) {
              gapText = driver.GapToLeader
            } else {
              const computed = practiceGaps[row.RacingNumber]
              gapText = computed ? (computed.isLeader ? '—' : computed.gap) : ''
            }
            const intervalAnnotation =
              gapMode === 'interval' && isRace && row.Position > 1
                ? intervalMeaning(parseIntervalSeconds(gapText))
                : null

            const renderSector = (idx: number) => {
              const sec = driver.Sectors?.[idx]
              if (!sec) return '-'
              let sClass = 'sector-time mono'
              if (sec.OverallFastest) sClass += ' sector-overall txt-purple'
              else if (sec.PersonalFastest) sClass += ' sector-personal txt-green'
              else if (sec.Value) sClass += ' sector-active txt-yellow'
              return <span className={sClass}>{sec.Value || '-'}</span>
            }

            return (
              <Fragment key={row.RacingNumber}>
                <tr
                  className={[
                    driver.InPit ? 'in-pit' : '',
                    driver.PitOut ? 'pit-out' : '',
                    driver.Retired ? 'retired' : '',
                    inBattle ? 'battle-row' : '',
                    isPinned ? 'pinned-row' : '',
                    isAtRisk && !driver.KnockedOut ? 'danger-row' : '',
                    driver.OnFlyingLap ? 'flying-row' : '',
                    'interactive-row'
                  ].filter(Boolean).join(' ')}
                  onClick={() => setExpandedRow(isExpanded ? null : row.RacingNumber)}
                  style={{ cursor: 'pointer' }}
                >
                  <td className={`mono ${posClass(row.Position)}`}>{row.Position}</td>
                  {isRace && <td className={`pos-delta${deltaClass ? ` ${deltaClass}` : ''}`}>{delta}</td>}
                  <td>
                    <div className="drv-cell">
                      <div className="drv-bar" style={{ background: teamColor(row.Info?.TeamColour) }} />
                      <span className="drv-code">{driverCode(row)}</span>
                      <span className="drv-num">{row.RacingNumber}</span>
                      {driver.InPit && <span className="badge badge-pit">PIT</span>}
                      {driver.PitOut && !driver.InPit && <span className="badge badge-pit">OUT</span>}
                      {driver.Retired && <span className="badge badge-out">RET</span>}
                      {driver.KnockedOut && <span className="badge badge-knocked">KO</span>}
                      {driver.Cutoff && !driver.KnockedOut && <span className="badge badge-cutoff">CUT</span>}
                      {!driver.Cutoff && isAtRisk && !driver.KnockedOut && <span className="badge badge-risk">RISK</span>}
                      {driver.OnFlyingLap && <span className="badge badge-flying">FL</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`tyre-badge ${tyreClass(row.Tyre)}`}>{tyreLabel(row.Tyre)}</span>
                  </td>
                  <td className={[
                    isRace ? '' : 'hide-mobile',
                    driver.LastLapOB ? 'mono lap-ob' : driver.LastLapPB ? 'mono lap-pb' : 'mono',
                  ].filter(Boolean).join(' ')}>
                    {driver.LastLapTime || '-'}
                  </td>
                  <td className="mono">
                    <Meaning
                      value={gapText || '-'}
                      meaning={intervalAnnotation?.caption}
                      title={intervalAnnotation?.title}
                      tone={intervalAnnotation?.tone}
                    />
                  </td>
                  
                  {isRace && (
                    <td className="spark-cell">
                      <GapSparkline samples={history?.[row.RacingNumber]} />
                    </td>
                  )}

                  {isQuali && <td className="hide-mobile">{renderSector(0)}</td>}
                  {isQuali && <td className="hide-mobile">{renderSector(1)}</td>}
                  {isQuali && <td className="hide-mobile">{renderSector(2)}</td>}

                  <td className={[
                    isRace ? 'hide-mobile' : '',
                    driver.BestLapOB ? 'mono lap-ob' : 'mono',
                  ].filter(Boolean).join(' ')}>
                    {driver.BestLapTime || '-'}
                  </td>
                  
                  {isRace && <td className="hide-mobile mono r">{driver.NumberOfLaps || '-'}</td>}

                  <td className="r">
                     {onTogglePin && (
                        <button 
                          className="pin-btn interactive" 
                          onClick={(e) => { e.stopPropagation(); onTogglePin(row.RacingNumber); }}
                          style={{ opacity: isPinned ? 1 : 0.3, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}
                          title={isPinned ? 'Unpin driver' : 'Pin driver'}
                        >
                          <Pin size={14} fill={isPinned ? 'currentColor' : 'none'} />
                        </button>
                     )}
                  </td>
                </tr>
                {isExpanded && (
                   <tr className="expanded-row">
                      <td colSpan={columnCount} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                         <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                            <div>
                               <div className="mono" style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '4px' }}>STINTS</div>
                               <StintHistory stints={stints?.[row.RacingNumber]} />
                            </div>
                            {!isRace && (
                              <div>
                                 <div className="mono" style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '4px' }}>LAPS</div>
                                 <div className="mono">{driver.NumberOfLaps || 0}</div>
                              </div>
                            )}
                            {!isRace && driver.Sectors?.some((sec) => sec?.Value) && (
                              <div data-testid="expanded-sectors">
                                 <div className="mono" style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '4px' }}>SECTORS</div>
                                 <div className="mono" style={{ display: 'flex', gap: '10px' }}>
                                    {renderSector(0)}
                                    {renderSector(1)}
                                    {renderSector(2)}
                                 </div>
                              </div>
                            )}
                            {driver.SpeedTrap && (
                              <div>
                                 <div className="mono" style={{ color: 'var(--text-3)', fontSize: '10px', marginBottom: '4px' }}>SPEED TRAP</div>
                                 <div className="mono">{driver.SpeedTrap} km/h</div>
                              </div>
                            )}
                         </div>
                      </td>
                   </tr>
                )}
                {showCutoffAfter && (
                  <tr className="cutoff-separator" data-testid="qualifying-cutoff">
                    <td colSpan={columnCount}>
                      <span>{sessionDisplay.phaseLabel || 'Q'} cutoff</span>
                      <strong>P{sessionDisplay.cutoffPosition} advance</strong>
                      {sessionDisplay.atRiskStart && sessionDisplay.atRiskEnd && (
                        <em>P{sessionDisplay.atRiskStart}-P{sessionDisplay.atRiskEnd} at risk</em>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

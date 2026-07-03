import { useState, Fragment } from 'react'
import { teamColor } from '../../utils'
import type { LiveStintData } from '../../types'
import type { LiveTimingRow } from '../../lib/live'
import {
  driverCode,
  positionDelta,
  positionDeltaClass,
  tyreClass,
  tyreLabel,
} from '../../lib/live'
import type { GapHistoryMap } from '../../lib/gapHistory'
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
  sessionType?: string
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
  sessionType = '',
}: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [gapMode, setGapMode] = useState<'interval' | 'leader'>('interval')

  if (rows.length === 0) {
    return (
      <div className="missing-notice">
        Live timing is connected, but no driver timing rows have arrived yet.
      </div>
    )
  }

  const sType = sessionType.toLowerCase()
  const isRace = sType.includes('race') || sType.includes('sprint')
  const isQuali = sType.includes('qualifying') || sType.includes('practice') || !isRace

  const isQ1 = sType === 'qualifying 1' || sType.includes('q1')
  const isQ2 = sType === 'qualifying 2' || sType.includes('q2')

  return (
    <div className="scroll-x">
      <table className="data-table live-tower" style={{ minWidth: 620 }}>
        <thead>
          <tr>
            <th>Pos</th>
            {isRace && <th>Δ</th>}
            <th>Driver</th>
            <th>Tyre</th>
            <th>Last Lap</th>
            <th 
              className="interactive" 
              onClick={() => setGapMode(g => g === 'interval' ? 'leader' : 'interval')}
              title="Click to toggle Gap vs Interval"
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
            >
              {gapMode === 'interval' && isRace ? 'Interval' : 'Gap to P1'}
            </th>
            {isRace && <th>Trend</th>}
            {isQuali && <th>S1</th>}
            {isQuali && <th>S2</th>}
            {isQuali && <th>S3</th>}
            <th className="hide-mobile">Best</th>
            {isRace && <th className="hide-mobile r">Laps</th>}
            <th className="r"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const driver = row.Driver
            const delta = positionDelta(driver)
            const deltaClass = positionDeltaClass(driver)
            const isPinned = pinned?.includes(row.RacingNumber) ?? false
            const inBattle = battleNumbers?.has(row.RacingNumber) ?? false
            const isExpanded = expandedRow === row.RacingNumber
            
            // Knockout zone border
            let koClass = ''
            if (isQuali && (isQ1 || isQ2)) {
              if (isQ1 && row.Position === 15) koClass = 'ko-line-p15'
              if (isQ2 && row.Position === 10) koClass = 'ko-line-p10'
            } else if (isQuali) {
               if (row.Position === 15) koClass = 'ko-line-p15'
               if (row.Position === 10) koClass = 'ko-line-p10'
            }

            const gapText = gapMode === 'interval' && isRace ? (driver.Interval || driver.GapToLeader) : driver.GapToLeader
            
            // Render micro sectors
            const renderSector = (idx: number) => {
              const sec = driver.Sectors?.[idx]
              if (!sec) return '-'
              let sClass = 'mono'
              if (sec.OverallFastest) sClass = 'mono txt-purple'
              else if (sec.PersonalFastest) sClass = 'mono txt-green'
              else if (sec.Value) sClass = 'mono txt-yellow'
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
                    koClass,
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
                      {driver.OnFlyingLap && <span className="badge badge-flying">FL</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`tyre-badge ${tyreClass(row.Tyre)}`}>{tyreLabel(row.Tyre)}</span>
                  </td>
                  <td className={driver.LastLapOB ? 'mono lap-ob' : driver.LastLapPB ? 'mono lap-pb' : 'mono'}>
                    {driver.LastLapTime || '-'}
                  </td>
                  <td className="mono">{gapText || '-'}</td>
                  
                  {isRace && (
                    <td className="spark-cell">
                      <GapSparkline samples={history?.[row.RacingNumber]} />
                    </td>
                  )}

                  {isQuali && <td>{renderSector(0)}</td>}
                  {isQuali && <td>{renderSector(1)}</td>}
                  {isQuali && <td>{renderSector(2)}</td>}

                  <td className={`hide-mobile ${driver.BestLapOB ? 'mono lap-ob' : 'mono'}`}>
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
                      <td colSpan={12} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
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
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

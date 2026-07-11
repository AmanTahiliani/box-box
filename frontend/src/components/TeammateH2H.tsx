import { teamColor } from '../utils'
import '../styles/h2h.css'

export interface TeammateH2HProps {
  teamName: string
  teamColour: string
  driverATla: string
  driverBTla: string
  winsA: number
  winsB: number
  /** e.g. "+1" when more than two drivers share the team. */
  extraNote?: string
}

export function TeammateH2H({
  teamName,
  teamColour,
  driverATla,
  driverBTla,
  winsA,
  winsB,
  extraNote,
}: TeammateH2HProps) {
  const total = winsA + winsB || 1
  const pctA = (winsA / total) * 100
  const color = teamColor(teamColour)

  return (
    <div className="h2h-row" data-testid="teammate-h2h">
      <div className="h2h-team">
        <span className="h2h-team-name">{teamName}</span>
        {extraNote ? <span className="h2h-extra mono">{extraNote}</span> : null}
      </div>
      <div className="h2h-bar-wrap">
        <span className="h2h-tla h2h-tla--left mono">{driverATla}</span>
        <div className="h2h-bar" data-testid="h2h-bar">
          <span
            className="h2h-bar-seg"
            data-testid="h2h-bar-a"
            style={{ width: `${pctA}%`, background: color }}
          />
          <span
            className="h2h-bar-seg h2h-bar-seg--muted"
            data-testid="h2h-bar-b"
            style={{ width: `${100 - pctA}%`, background: color }}
          />
          <span className="h2h-score mono" data-testid="h2h-score">
            {winsA}–{winsB}
          </span>
        </div>
        <span className="h2h-tla h2h-tla--right mono">{driverBTla}</span>
      </div>
    </div>
  )
}

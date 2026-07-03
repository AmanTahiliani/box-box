import type { LiveStintData } from '../../types'
import { compoundClass, compoundLetter } from '../../lib/live'

interface Props {
  stints: LiveStintData[] | undefined
}

export function StintHistory({ stints }: Props) {
  if (!stints || stints.length === 0) {
    return <span className="stint-empty">-</span>
  }

  return (
    <span className="stint-seq" data-testid="stint-seq">
      {stints.map((stint, index) => (
        <span className="stint-item" key={index}>
          {index > 0 && <span className="stint-arrow">›</span>}
          <span
            className={`stint-dot ${compoundClass(stint.Compound)}`}
            title={`${stint.Compound || 'Unknown'}${stint.New ? ' (new)' : ''} · ${stint.Laps} laps`}
          >
            {compoundLetter(stint.Compound)}
          </span>
          {stint.Laps > 0 && <span className="stint-laps">{stint.Laps}</span>}
        </span>
      ))}
    </span>
  )
}

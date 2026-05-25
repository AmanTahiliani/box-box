import { RACE_HUB_DATASETS } from '../lib/coverage'
import type { DatasetInfo } from '../types'

interface Props {
  datasets: Record<string, DatasetInfo>
}

export function SessionCoverageDots({ datasets }: Props) {
  return (
    <span className="coverage-dots" aria-hidden="true">
      {RACE_HUB_DATASETS.map((key) => {
        const available = datasets[key]?.status === 'available' || datasets[key]?.status === 'skipped'
        return <span key={key} className={`coverage-dot ${available ? 'on' : 'off'}`} />
      })}
    </span>
  )
}

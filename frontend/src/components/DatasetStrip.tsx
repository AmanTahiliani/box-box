import type { DatasetInfo } from '../types'

const DATASET_LABELS: Record<string, string> = {
  meeting: 'meeting',
  session: 'session',
  drivers: 'drivers',
  results: 'results',
  starting_grid: 'grid',
}

interface Props {
  datasets: Record<string, DatasetInfo>
}

export function DatasetStrip({ datasets }: Props) {
  const keys = Object.keys(DATASET_LABELS)

  return (
    <div className="dataset-strip">
      {keys.map((key) => {
        const info = datasets[key]
        const available = info?.status === 'available'
        return (
          <div key={key} className="ds-item" title={info ? `${info.source} · ${info.count ?? 0} rows` : 'missing'}>
            <div className={`ds-dot ${available ? 'ds-dot-local' : 'ds-dot-missing'}`} />
            <span>{DATASET_LABELS[key]}</span>
            {available && info.count != null && info.count > 0 && (
              <span style={{ opacity: 0.5 }}>·{info.count}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

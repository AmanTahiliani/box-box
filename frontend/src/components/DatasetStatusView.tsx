import { Link } from '@tanstack/react-router'
import { RACE_HUB_DATASETS } from '../lib/coverage'
import type { DatasetInfo } from '../types'

interface Props {
  datasets: Record<string, DatasetInfo>
}

const DATASET_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  session: 'Session',
  drivers: 'Drivers',
  results: 'Results',
  starting_grid: 'Starting Grid',
  stints: 'Stints',
  pit_stops: 'Pit Stops',
  positions: 'Positions',
  race_control: 'Race Control',
  weather: 'Weather',
  laps: 'Laps',
}

export function DatasetStatusView({ datasets }: Props) {
  const entries = RACE_HUB_DATASETS.map((key) => ({
    key,
    label: DATASET_LABELS[key] ?? key,
    info: datasets[key] as DatasetInfo | undefined,
  }))
  const available = entries.filter((e) => e.info?.status === 'available').length
  const total = entries.length
  const missing = total - available

  return (
    <div data-testid="rh-data-status">
      <div className="rh-coverage-meter" aria-hidden="true">
        <div
          className="rh-coverage-fill"
          style={{ width: `${(available / total) * 100}%` }}
        />
      </div>
      <div className="ds-legend">
        <span className="mono" style={{ color: 'var(--text-2)' }}>
          {available}/{total} datasets local
        </span>
        {missing > 0 && (
          <span style={{ color: 'var(--text-3)' }}>
            {missing} dataset{missing === 1 ? '' : 's'} still missing —{' '}
            <Link to="/admin" className="rh-inline-link">
              manage ingestion
            </Link>
            .
          </span>
        )}
      </div>

      <table className="data-table" style={{ maxWidth: 480 }}>
        <thead>
          <tr>
            <th>Dataset</th>
            <th>Status</th>
            <th className="r">Records</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ key, label, info }) => (
            <tr key={key}>
              <td className="mono" style={{ color: 'var(--text-2)' }}>
                {label}
              </td>
              <td>
                {info?.status === 'available' ? (
                  <span className="badge badge-local">Local</span>
                ) : (
                  <span className="badge badge-none">Missing</span>
                )}
              </td>
              <td className="r mono" style={{ color: 'var(--text-3)' }}>
                {info?.count != null ? info.count : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

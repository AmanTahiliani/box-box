import type { DatasetInfo } from '../types'

interface Props {
  datasets: Record<string, DatasetInfo>
}

const KNOWN_DATASETS: { key: string; label: string }[] = [
  { key: 'meeting', label: 'Meeting' },
  { key: 'session', label: 'Session' },
  { key: 'drivers', label: 'Drivers' },
  { key: 'results', label: 'Results' },
  { key: 'starting_grid', label: 'Starting Grid' },
]

export function DatasetStatusView({ datasets }: Props) {
  const entries = KNOWN_DATASETS.map(({ key, label }) => ({
    key,
    label,
    info: datasets[key] as DatasetInfo | undefined,
  }))

  const available = entries.filter((e) => e.info?.status === 'available').length
  const total = entries.length

  return (
    <div>
      <div className="ds-legend">
        <span>
          {available}/{total} datasets available locally
        </span>
        {available < total && (
          <span>
            Re-run <code>box-box --ingest-session &lt;key&gt;</code> after backend
            support exists for missing datasets.
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

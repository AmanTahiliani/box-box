import type { WeatherSample } from '../types'

interface Props {
  weather: WeatherSample[]
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

function formatNumber(value: number, digits = 1): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function formatTime(date: string): string {
  if (!date) return '—'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function WeatherView({ weather }: Props) {
  if (weather.length === 0) {
    return (
      <div className="missing-notice">
        Weather samples not ingested. Run <code>box-box --ingest-session &lt;key&gt;</code>{' '}
        to load this dataset.
      </div>
    )
  }

  const rows = [...weather].sort((a, b) => a.date.localeCompare(b.date))
  const latest = rows[rows.length - 1]
  const rainfallSamples = rows.filter((sample) => sample.rainfall > 0).length

  return (
    <div data-testid="weather-view">
      <table className="data-table" style={{ maxWidth: 520, marginBottom: 'var(--s5)' }}>
        <thead>
          <tr>
            <th>Summary</th>
            <th className="r">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Latest sample</td>
            <td className="r">{formatTime(latest.date)}</td>
          </tr>
          <tr>
            <td>Avg air / track</td>
            <td className="r">
              {formatNumber(avg(rows.map((sample) => sample.air_temperature)))}C /{' '}
              {formatNumber(avg(rows.map((sample) => sample.track_temperature)))}C
            </td>
          </tr>
          <tr>
            <td>Rain samples</td>
            <td className="r">{rainfallSamples}</td>
          </tr>
        </tbody>
      </table>

      <div className="scroll-x">
        <table className="data-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th>Time</th>
              <th className="r">Air</th>
              <th className="r">Track</th>
              <th className="r hide-mobile">Humidity</th>
              <th className="r hide-mobile">Rain</th>
              <th className="r hide-mobile">Wind</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(-12).map((sample) => (
              <tr key={sample.date}>
                <td className="mono" style={{ color: 'var(--text-3)' }}>
                  {formatTime(sample.date)}
                </td>
                <td className="r">{formatNumber(sample.air_temperature)}C</td>
                <td className="r">{formatNumber(sample.track_temperature)}C</td>
                <td className="r hide-mobile">{formatNumber(sample.humidity, 0)}%</td>
                <td className="r hide-mobile">{formatNumber(sample.rainfall)}</td>
                <td className="r hide-mobile">{formatNumber(sample.wind_speed)} m/s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import type { LiveWeatherData } from '../../types'
import { windDirectionLabel } from '../../lib/live'

interface Props {
  weather: LiveWeatherData | null | undefined
}

export function WeatherStrip({ weather }: Props) {
  if (!weather) return null
  const hasData =
    weather.AirTemp > 0 ||
    weather.TrackTemp > 0 ||
    weather.Humidity > 0 ||
    weather.WindSpeed > 0 ||
    weather.Rainfall
  if (!hasData) return null

  const windDir = windDirectionLabel(weather.WindDir)

  return (
    <div className="live-weather-strip" data-testid="weather-strip">
      {weather.AirTemp > 0 && (
        <span className="weather-item">
          <span className="weather-k">air</span>
          <span className="weather-v">{weather.AirTemp.toFixed(0)}°C</span>
        </span>
      )}
      {weather.TrackTemp > 0 && (
        <span className="weather-item">
          <span className="weather-k">track</span>
          <span className="weather-v">{weather.TrackTemp.toFixed(0)}°C</span>
        </span>
      )}
      {weather.Humidity > 0 && (
        <span className="weather-item">
          <span className="weather-k">hum</span>
          <span className="weather-v">{weather.Humidity.toFixed(0)}%</span>
        </span>
      )}
      {weather.WindSpeed > 0 && (
        <span className="weather-item">
          <span className="weather-k">wind</span>
          <span className="weather-v">
            {weather.WindSpeed.toFixed(1)} m/s{windDir ? ` ${windDir}` : ''}
          </span>
        </span>
      )}
      {weather.Rainfall && <span className="badge badge-wet">RAIN</span>}
    </div>
  )
}

import type { RaceHub } from '../types'
import { compareFinishPosition, formatDuration, formatGap, formatLapTime } from '../utils'
import { Thermometer, Map, Droplets, Wind, CloudRain } from 'lucide-react'

interface Props {
  data: RaceHub
}

export function OverviewView({ data }: Props) {
  const sortedResults = [...data.results].sort((a, b) =>
    compareFinishPosition(a.position, b.position),
  )
  const winner = sortedResults[0]
  const podium = sortedResults.filter((r) => r.position > 0).slice(0, 3)
  const pole = data.starting_grid.find((g) => g.position === 1)
  const fastest = pickFastestLap(data)
  const latestWeather = data.weather.length > 0 ? data.weather[data.weather.length - 1] : null
  const rcHighlights = data.race_control.slice(-3).reverse()

  const sessionType = (data.session?.session_type ?? '').toLowerCase()
  const isRace = sessionType.includes('race')
  const sessionLabel = isRace ? 'Race' : data.session?.session_type ?? 'Session'

  return (
    <div className="rh-overview" data-testid="rh-overview">
      <div className="rh-stat-grid">
        {winner && winner.position > 0 ? (
          <StatCard
            label={isRace ? 'Winner' : `${sessionLabel} P1`}
            primary={winner.name_acronym || `#${winner.driver_number}`}
            primaryColor={winner.team_colour ? `#${winner.team_colour}` : undefined}
            secondary={winner.full_name}
            tertiary={winner.team_name}
            highlight={
              isRace
                ? formatDuration(winner.duration)
                : winner.duration
                  ? formatDuration(winner.duration)
                  : ''
            }
          />
        ) : (
          <StatCard label={isRace ? 'Winner' : `${sessionLabel} P1`} placeholder />
        )}

        <PodiumCard podium={podium} />

        {pole ? (
          <StatCard
            label={isRace ? 'Pole' : 'P1'}
            primary={pole.name_acronym || `#${pole.driver_number}`}
            primaryColor={pole.team_colour ? `#${pole.team_colour}` : undefined}
            secondary={pole.full_name}
            tertiary={pole.team_name}
            highlight={pole.lap_duration ? formatLapTime(pole.lap_duration) : ''}
          />
        ) : (
          <StatCard label={isRace ? 'Pole' : 'Grid'} placeholder />
        )}

        {fastest ? (
          <StatCard
            label="Fastest Lap"
            primary={fastest.acronym}
            primaryColor={fastest.colour ? `#${fastest.colour}` : undefined}
            secondary={fastest.fullName}
            tertiary={`Lap ${fastest.lap}`}
            highlight={formatLapTime(fastest.time)}
          />
        ) : (
          <StatCard label="Fastest Lap" placeholder />
        )}
      </div>

      <div className="rh-overview-row">
        <section className="rh-panel ui-card">
          <div className="sec-header">
            <span className="sec-title">Conditions</span>
            {latestWeather && (
              <span className="sec-meta mono">{shortTime(latestWeather.date)}</span>
            )}
          </div>
          {latestWeather ? (
            <div className="rh-condition-strip" data-testid="rh-conditions">
              <ConditionChip icon={Thermometer} label="Air" value={`${latestWeather.air_temperature.toFixed(1)}°C`} />
              <ConditionChip
                icon={Map}
                label="Track"
                value={`${latestWeather.track_temperature.toFixed(1)}°C`}
              />
              <ConditionChip icon={Droplets} label="Humidity" value={`${latestWeather.humidity.toFixed(0)}%`} />
              <ConditionChip
                icon={Wind}
                label="Wind"
                value={`${latestWeather.wind_speed.toFixed(1)} m/s`}
              />
              <ConditionChip
                icon={CloudRain}
                label="Rain"
                value={latestWeather.rainfall > 0 ? 'Yes' : 'No'}
                accent={latestWeather.rainfall > 0 ? 'wet' : undefined}
              />
            </div>
          ) : (
            <div className="rh-empty-line">No weather samples ingested.</div>
          )}
        </section>

        <section className="rh-panel ui-card">
          <div className="sec-header">
            <span className="sec-title">Race Control · Latest</span>
            <span className="sec-meta mono">{data.race_control.length}</span>
          </div>
          {rcHighlights.length === 0 ? (
            <div className="rh-empty-line">No race-control messages.</div>
          ) : (
            <ul className="rh-rc-list">
              {rcHighlights.map((m, i) => (
                <li key={i} className="rh-rc-row">
                  <span className="rh-rc-time mono">{shortTime(m.date)}</span>
                  <span className={`rh-rc-flag rh-rc-flag-${(m.flag || 'none').toLowerCase()}`}>
                    {m.flag || m.category || '—'}
                  </span>
                  <span className="rh-rc-msg">{m.message}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

interface StatCardProps {
  label: string
  primary?: string
  primaryColor?: string
  secondary?: string
  tertiary?: string
  highlight?: string
  placeholder?: boolean
}

function StatCard({
  label,
  primary,
  primaryColor,
  secondary,
  tertiary,
  highlight,
  placeholder,
}: StatCardProps) {
  if (placeholder) {
    return (
      <div className="rh-stat-card ui-card rh-stat-empty">
        <div className="rh-stat-label mono">{label}</div>
        <div className="rh-stat-primary">—</div>
        <div className="rh-stat-secondary">No data ingested</div>
      </div>
    )
  }
  return (
    <div className="rh-stat-card ui-card interactive">
      <div className="rh-stat-label mono">{label}</div>
      <div className="rh-stat-primary" style={primaryColor ? { color: primaryColor } : undefined}>
        {primary}
      </div>
      {secondary && <div className="rh-stat-secondary">{secondary}</div>}
      {tertiary && <div className="rh-stat-tertiary">{tertiary}</div>}
      {highlight && <div className="rh-stat-highlight mono">{highlight}</div>}
    </div>
  )
}

function PodiumCard({ podium }: { podium: Array<{ name_acronym: string; team_colour: string; position: number; full_name: string; gap_to_leader: number | string | number[] | null; duration: number | number[] | null; driver_number: number }> }) {
  if (podium.length === 0) {
    return (
      <div className="rh-stat-card ui-card rh-stat-empty">
        <div className="rh-stat-label mono">Podium</div>
        <div className="rh-stat-primary">—</div>
        <div className="rh-stat-secondary">No classified finishers</div>
      </div>
    )
  }
  return (
    <div className="rh-stat-card ui-card interactive">
      <div className="rh-stat-label mono">Podium</div>
      <ol className="rh-podium-list">
        {podium.map((r) => (
          <li key={r.driver_number} className={`rh-podium-row rh-podium-p${r.position}`}>
            <span className="rh-podium-pos mono">P{r.position}</span>
            <span
              className="rh-podium-driver"
              style={r.team_colour ? { color: `#${r.team_colour}` } : undefined}
            >
              {r.name_acronym || `#${r.driver_number}`}
            </span>
            <span className="rh-podium-gap mono">
              {r.position === 1
                ? formatDuration(r.duration)
                : formatGap(r.gap_to_leader)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ConditionChip({
  label,
  value,
  accent,
  icon: Icon,
}: {
  label: string
  value: string
  accent?: 'wet'
  icon?: React.ElementType
}) {
  return (
    <div className={`rh-condition-chip${accent === 'wet' ? ' rh-condition-wet' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {Icon && <Icon size={14} style={{ opacity: 0.7 }} />}
      <span className="rh-condition-label mono">{label}</span>
      <span className="rh-condition-value">{value}</span>
    </div>
  )
}

function shortTime(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function pickFastestLap(
  data: RaceHub,
): { lap: number; time: number; acronym: string; fullName: string; colour: string } | null {
  const candidates = data.laps.filter(
    (l) => l.lap_duration != null && l.lap_duration > 0 && !l.is_pit_out_lap,
  )
  if (candidates.length === 0) return null
  let best = candidates[0]
  for (const lap of candidates) {
    if ((lap.lap_duration ?? 0) < (best.lap_duration ?? Infinity)) {
      best = lap
    }
  }
  const driverInfo = data.results.find((r) => r.driver_number === best.driver_number)
    ?? data.drivers.find((d) => d.driver_number === best.driver_number)
  return {
    lap: best.lap_number,
    time: best.lap_duration ?? 0,
    acronym:
      ('name_acronym' in (driverInfo ?? {}) ? (driverInfo as { name_acronym: string }).name_acronym : '')
        || `#${best.driver_number}`,
    fullName:
      ('full_name' in (driverInfo ?? {}) ? (driverInfo as { full_name: string }).full_name : '') || '',
    colour:
      ('team_colour' in (driverInfo ?? {}) ? (driverInfo as { team_colour: string }).team_colour : '') || '',
  }
}

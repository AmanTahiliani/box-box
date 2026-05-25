export interface DatasetInfo {
  status: 'available' | 'missing'
  source: 'local' | 'openf1' | 'none'
  count?: number
}

export interface Meeting {
  meeting_key: number
  meeting_name: string
  meeting_official_name: string
  location: string
  country_name: string
  country_code: string
  country_flag: string
  circuit_short_name: string
  date_start: string
  date_end: string
  year: number
}

export interface Session {
  session_key: number
  session_name: string
  session_type: string
  meeting_key: number
  date_start: string
  date_end: string
  gmt_offset: string
}

export interface Driver {
  driver_number: number
  name_acronym: string
  full_name: string
  first_name: string
  last_name: string
  team_name: string
  team_colour: string
  headshot_url: string
  broadcast_name: string
  session_key: number
  meeting_key: number
}

export interface EnrichedResult {
  driver_number: number
  position: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
  dnf: boolean
  dns: boolean
  dsq: boolean
  duration: number | number[] | null
  gap_to_leader: number | string | number[] | null
  number_of_laps: number
  points: number
  session_key: number
  meeting_key: number
}

export interface EnrichedGrid {
  driver_number: number
  position: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
  session_key: number
  meeting_key: number
  lap_duration: number | null
}

export interface RaceHub {
  source: 'local' | 'partial' | 'none'
  session_key: number
  datasets: Record<string, DatasetInfo>
  meeting?: Meeting
  session?: Session
  drivers: Driver[]
  results: EnrichedResult[]
  starting_grid: EnrichedGrid[]
  stints: Stint[]
  pit_stops: PitStop[]
  positions: PositionSample[]
  race_control: RaceControlMessage[]
  weather: WeatherSample[]
  laps: Lap[]
}

export interface Stint {
  session_key: number
  driver_number: number
  meeting_key: number
  stint_number: number
  compound: string
  lap_start: number
  lap_end: number
  tyre_age_at_start: number
}

export interface PitStop {
  session_key: number
  driver_number: number
  meeting_key: number
  lap_number: number
  date: string
  pit_duration: number
  lane_duration: number
  stop_duration: number
}

export interface PositionSample {
  session_key: number
  driver_number: number
  meeting_key: number
  date: string
  position: number
}

export interface RaceControlMessage {
  session_key: number
  meeting_key: number
  date: string
  category: string
  flag: string
  message: string
  scope: string
  driver_number: number | null
  lap_number: number | null
  sector: number | null
  qualifying_phase: number | null
}

export interface WeatherSample {
  session_key: number
  meeting_key: number
  date: string
  air_temperature: number
  track_temperature: number
  humidity: number
  pressure: number
  rainfall: number
  wind_direction: number
  wind_speed: number
}

export interface Lap {
  session_key: number
  driver_number: number
  meeting_key: number
  lap_number: number
  date_start: string
  lap_duration: number | null
  is_pit_out_lap: boolean
}

export interface WeekendSession {
  session: Session
  source: 'local' | 'partial' | 'none'
  datasets: Record<string, DatasetInfo>
}

export interface Weekend {
  source: 'local' | 'partial' | 'none'
  meeting_key: number
  meeting: Meeting
  sessions: WeekendSession[]
  default_session_key?: number
}

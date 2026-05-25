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
}

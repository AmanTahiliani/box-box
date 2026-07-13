export interface DatasetInfo {
  status: 'available' | 'missing' | 'skipped'
  source: 'local' | 'openf1' | 'none' | 'na'
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
  circuit_key?: number
  circuit_short_name: string
  date_start: string
  date_end: string
  year: number
  is_cancelled?: boolean
}

export interface Session {
  session_key: number
  session_name: string
  session_type: string
  circuit_key?: number
  meeting_key: number
  date_start: string
  date_end: string
  gmt_offset: string
  is_cancelled?: boolean
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
  source: 'local' | 'partial' | 'none' | 'cancelled'
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
  chapters: Chapter[]
}

export interface Chapter {
  kind: 'start' | 'safety_car' | 'virtual_safety_car' | 'red_flag' | 'pit_phase' | 'decisive_swing' | 'finish' | string
  title: string
  headline: string
  start_lap: number
  end_lap: number
  start_time?: string
  end_time?: string
  driver_numbers: number[]
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

export interface CarDataSample {
  brake: number
  date: string
  driver_number: number
  drs: number
  meeting_key: number
  n_gear: number
  rpm: number
  session_key: number
  speed: number
  throttle: number
}

export interface ComparisonLap extends Lap {
  compound?: string
}

export interface ComparisonDriver {
  driver_number: number
  name_acronym: string
  team_colour: string
  laps: ComparisonLap[]
}

export interface LapsComparisonResponse {
  session_key: number
  sc_periods: unknown[]
  pit_laps: Record<string, number[]>
  drivers: ComparisonDriver[]
}

export interface WeekendSession {
  session: Session
  source: 'local' | 'partial' | 'none' | 'cancelled'
  datasets: Record<string, DatasetInfo>
}

export interface Weekend {
  source: 'local' | 'partial' | 'none' | 'cancelled'
  meeting_key: number
  meeting: Meeting
  sessions: WeekendSession[]
  default_session_key?: number
}

export interface LiveStateResponse {
  is_live: boolean
  data: LiveStreamData | null
  last_snapshot?: LiveStreamData | null
  last_positions?: Record<string, LivePosition> | null
  last_snapshot_at?: string
}

export interface LivePosition {
  x: number
  y: number
  z: number
  status: string
}

export interface LiveTelemetry {
  Speed: number
  Throttle: number
  Brake: number
  DRS: number
  NGear: number
  RPM: number
}

export interface LiveSectorData {
  Value: string
  PersonalFastest: boolean
  OverallFastest: boolean
}

export interface LiveDriverData {
  RacingNumber: string
  Position: number
  PrevPosition: number
  GapToLeader: string
  Interval: string
  LastLapTime: string
  LastLapPB: boolean
  LastLapOB: boolean
  BestLapTime: string
  BestLapPB: boolean
  BestLapOB: boolean
  BestLapNum: number
  InPit: boolean
  PitOut: boolean
  Retired: boolean
  KnockedOut: boolean
  Cutoff: boolean
  OnFlyingLap: boolean
  NumberOfLaps: number
  SpeedTrap: string
  Sectors: LiveSectorData[]
}

export interface LiveDriverInfo {
  RacingNumber: string
  BroadcastName: string
  Tla: string
  TeamName: string
  TeamColour: string
  FirstName: string
  LastName: string
}

export interface LiveTyreData {
  Compound: string
  New: boolean
  Age: number
}

export interface LiveRCMessage {
  Time: string
  Category: string
  Flag: string
  Message: string
  Lap: number
}

export interface LiveWeatherData {
  AirTemp: number
  TrackTemp: number
  Humidity: number
  WindSpeed: number
  WindDir: number
  Rainfall: boolean
}

export interface LiveSessionMeta {
  MeetingName: string
  CircuitName: string
  SessionType: string
  SessionName: string
  Path: string
}

export interface LiveStintData {
  Compound: string
  New: boolean
  Laps: number
}

export interface LiveRadioCapture {
  Utc: string
  RacingNumber: string
  Path: string
}

export interface LiveStreamData {
  Drivers: Record<string, LiveDriverData>
  DriverInfo: Record<string, LiveDriverInfo>
  Tyres: Record<string, LiveTyreData>
  Telemetry?: Record<string, LiveTelemetry>
  RCMessages: LiveRCMessage[]
  Weather: LiveWeatherData
  Session: LiveSessionMeta
  TeamRadio: LiveRadioCapture[]
  SessionStatus?: string
  TrackStatus: string
  CurrentLap: number
  TotalLaps: number
  Clock: string
  ClockRefTime: string
  ClockExtrapolating: boolean
  Stints: Record<string, LiveStintData[]>
}

export interface TrackPoint {
  x: number
  y: number
}

export interface TrackBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export interface TrackOutline {
  circuit_key: number
  points: TrackPoint[]
  bounds: TrackBounds
}

export interface ReplayCarPosition {
  x: number
  y: number
}

export interface ReplayFrame {
  t: number
  cars: Record<string, ReplayCarPosition>
}

export interface ReplayFramesResponse {
  session_key: number
  interval_ms: number
  start_time: string
  frames: ReplayFrame[]
}

export interface ChampHubDriver {
  driver_number: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
  points: number
  position: number
  wins: number
  podiums: number
  poles: number
  form: number[]
  cumulative: number[]
  round_positions: number[]
  teammate_wins: number
  teammate_losses: number
}

export interface ChampHubTeam {
  team_name: string
  team_colour: string
  points: number
  position: number
  wins: number
}

export interface ChampionshipHub {
  season: number
  round: number
  total_rounds: number
  rounds_left: number
  last_race: string
  round_labels: string[]
  drivers: ChampHubDriver[]
  teams: ChampHubTeam[]
}

export interface DriverSummaryRound {
  meeting_key: number
  meeting_name: string
  country_code: string
  country_name: string
  race_position: number
  grid_position: number
  quali_position?: number
  points: number
  dnf: boolean
  dns: boolean
  dsq: boolean
}

export interface DriverSummary {
  season: number
  driver_number: number
  name_acronym: string
  full_name: string
  team_name: string
  team_colour: string
  headshot_url: string
  points: number
  position: number
  wins: number
  podiums: number
  poles: number
  form: number[]
  cumulative: number[]
  round_labels: string[]
  rounds: DriverSummaryRound[]
  /** Data origin: local domain DB or OpenF1 fallback. */
  source?: 'local' | 'openf1'
  /** Optional remote enrichment status — limited means profile still renders. */
  enrichment?: 'full' | 'limited' | 'none'
}

// ── Weekend Context ──
// Canonical local-first contract for the adaptive Weekend home, served verbatim
// by /api/v1/weekend-context (backend story #72, internal/query/context.go).
// The frontend consumes this shape as the single source of truth; view-model
// derivation lives in lib/weekendContext.ts.

// TemporalState mirrors query.TemporalState exactly (the JSON `temporal_state`).
export type TemporalState =
  | 'no_season'
  | 'between_weekends'
  | 'pre_session'
  | 'session_live'
  | 'session_settling'
  | 'between_sessions'
  | 'post_weekend'
  | 'season_complete'

// ContextAvailability mirrors query.ContextAvailability. Every field is present
// in a canonical payload except the optional `observed_at`.
export interface ContextAvailability {
  schedule: string
  live_transport: string
  live_session: string
  archive: string
  local_analysis: string
  freshness: string
  observed_at?: string
  limitations: string[]
}

// ContextSession mirrors query.ContextSession: a session identity coupled with
// its meeting and structured availability contract.
export interface ContextSession {
  session: Session
  meeting?: Meeting
  availability: ContextAvailability
}

// WeekendContext mirrors query.WeekendContext (the canonical endpoint body).
export interface WeekendContext {
  season?: number
  temporal_state: TemporalState
  previous_meeting?: Meeting
  focus_meeting?: Meeting
  next_meeting?: Meeting
  previous_completed_session?: ContextSession
  active_session?: ContextSession
  next_session?: ContextSession
  default_analysis_session?: ContextSession
  championship_round: number
  total_championship_rounds: number
}

// ── Weekend view model (client-only) ──
// The rendered Weekend home layers a small set of non-canonical UI states
// (loading/error) plus supplementary data (championship movers, briefing) on top
// of the canonical context. None of these are part of the #72 contract.
export type WeekendViewState =
  | 'loading'
  | 'error'
  | 'no_season'
  | 'between_weekends'
  | 'pre_session'
  | 'session_live'
  | 'session_settling'
  | 'between_sessions'
  | 'post_weekend'
  | 'season_complete'

export interface WeekendChampionshipMover {
  position: number
  driver_number: number
  name_acronym: string
  team_colour: string
  points: number
  delta?: number
}

export interface WeekendChampionshipImpact {
  leaders: WeekendChampionshipMover[]
  note?: string
}

export interface WeekendBriefingItem {
  category?: string
  title: string
  url: string
  source: string
  published_at?: string
  image_url?: string
}

export interface WeekendPodiumEntry {
  position: number
  driver_number: number
  name_acronym: string
  team_name: string
  team_colour: string
  gap: string
}

export interface NewsItem {
  source: string
  title: string
  url: string
  published_at?: string
  summary?: string
  category?: string
  fetched_at: string
  og_image_url?: string
  og_description?: string
  read_at?: string
}

export interface ArticleContent {
  title: string
  byline?: string
  excerpt?: string
  image_url?: string
  content: string
  site_name?: string
}

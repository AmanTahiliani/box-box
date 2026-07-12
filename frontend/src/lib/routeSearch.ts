/** Shared URL search contracts for deep-linkable Weekend ↔ Race Hub navigation. */

export type WeekendSearch = {
  meeting_key?: number
  session_key?: number
}

export type RaceHubSearch = {
  session_key?: number
}

function parsePositiveInt(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export function parseWeekendSearch(search: Record<string, unknown>): WeekendSearch {
  const meeting_key = parsePositiveInt(search.meeting_key)
  const session_key = parsePositiveInt(search.session_key)
  return {
    ...(meeting_key ? { meeting_key } : {}),
    ...(session_key ? { session_key } : {}),
  }
}

export function parseRaceHubSearch(search: Record<string, unknown>): RaceHubSearch {
  const session_key = parsePositiveInt(search.session_key)
  return session_key ? { session_key } : {}
}

/** Build Weekend `/` search so a Race Hub return is reload-safe and deep-linkable. */
export function weekendFocusSearch(
  meetingKey?: number | null,
  sessionKey?: number | null,
): WeekendSearch {
  return {
    ...(meetingKey && meetingKey > 0 ? { meeting_key: meetingKey } : {}),
    ...(sessionKey && sessionKey > 0 ? { session_key: sessionKey } : {}),
  }
}

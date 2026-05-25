import type { RaceHub } from './types'

export async function fetchRaceHub(sessionKey: number): Promise<RaceHub> {
  const res = await fetch(`/api/v1/race-hub?session_key=${sessionKey}`)
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`)
  }
  return res.json()
}

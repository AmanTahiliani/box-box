import type { ReplayFramesResponse, TrackOutline } from '../types'

/** Whether replay map can render (probe uses existing frames + outline queries). */
export function isReplayMapAvailable(
  replay: ReplayFramesResponse | null | undefined,
  outline: TrackOutline | null | undefined,
  hasError: boolean,
): boolean {
  if (hasError) return false
  const frames = replay?.frames ?? []
  if (frames.length < 2) return false
  if (!outline?.points?.length) return false
  return true
}

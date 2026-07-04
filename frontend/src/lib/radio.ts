import type { LiveRadioCapture, LiveSessionMeta } from '../types'

export const LIVE_TIMING_STATIC_BASE = 'https://livetiming.formula1.com/static/'

export function radioClipUrl(
  session: Pick<LiveSessionMeta, 'Path'> | null | undefined,
  capture: Pick<LiveRadioCapture, 'Path'> | null | undefined,
): string {
  const sessionPath = session?.Path?.trim()
  const capturePath = capture?.Path?.trim()
  if (!sessionPath || !capturePath) return ''
  if (/^https?:\/\//i.test(capturePath)) return capturePath

  const base = LIVE_TIMING_STATIC_BASE.replace(/\/+$/, '')
  const normalizedSession = sessionPath.replace(/^\/+|\/+$/g, '')
  const normalizedCapture = capturePath.replace(/^\/+/g, '')
  return `${base}/${normalizedSession}/${normalizedCapture}`
}

export function radioCaptureKey(capture: LiveRadioCapture): string {
  return `${capture.Utc}-${capture.RacingNumber}-${capture.Path}`
}

import { useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { LiveDriverInfo, LiveRadioCapture, LiveSessionMeta } from '../../types'
import { radioCaptureKey, radioClipUrl } from '../../lib/radio'
import { teamColor } from '../../utils'
import '../../styles/team-radio.css'

interface Props {
  captures?: LiveRadioCapture[]
  driverInfo?: Record<string, LiveDriverInfo>
  session?: LiveSessionMeta
}

function relativeTime(utc: string): string {
  const timestamp = new Date(utc).getTime()
  if (!utc || Number.isNaN(timestamp)) return '--'

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (diffSeconds < 60) return `${diffSeconds}s ago`
  const minutes = Math.floor(diffSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function driverLabel(info: LiveDriverInfo | undefined, racingNumber: string): string {
  return info?.Tla || racingNumber
}

export function TeamRadioTicker({ captures = [], driverInfo = {}, session }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)

  const newestFirst = useMemo(() => [...captures].reverse(), [captures])

  const toggleCapture = (capture: LiveRadioCapture) => {
    const key = radioCaptureKey(capture)
    const audio = audioRef.current
    const url = radioClipUrl(session, capture)
    if (!audio || !url) return

    if (playingKey === key) {
      audio.pause()
      setPlayingKey(null)
      return
    }

    audio.pause()
    audio.src = url
    setPlayingKey(key)
    const play = audio.play()
    if (play) {
      play.catch(() => setPlayingKey(null))
    }
  }

  return (
    <section className="team-radio panel-glass" data-testid="team-radio-ticker">
      <div className="sec-header sticky-header">
        <span className="sec-title">Team Radio</span>
        {captures.length > 0 && <span className="sec-meta">{captures.length} clips</span>}
      </div>

      <audio
        ref={audioRef}
        className="team-radio-audio"
        onEnded={() => setPlayingKey(null)}
      />

      {newestFirst.length === 0 ? (
        <div className="missing-notice">No team radio clips in the current live snapshot.</div>
      ) : (
        <div className="team-radio-list">
          {newestFirst.map((capture) => {
            const key = radioCaptureKey(capture)
            const info = driverInfo[capture.RacingNumber]
            const label = driverLabel(info, capture.RacingNumber)
            const isPlaying = playingKey === key
            const url = radioClipUrl(session, capture)

            return (
              <div className="team-radio-row" key={key}>
                <button
                  className="team-radio-play"
                  type="button"
                  aria-label={`${isPlaying ? 'Pause' : 'Play'} ${label} radio`}
                  disabled={!url}
                  onClick={() => toggleCapture(capture)}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <span
                  className="team-radio-driver"
                  style={{ borderColor: teamColor(info?.TeamColour) }}
                  title={info?.TeamName || undefined}
                >
                  {label}
                </span>
                <span className="team-radio-time">{relativeTime(capture.Utc)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

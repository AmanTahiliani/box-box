import { Link } from '@tanstack/react-router'
import { Activity, ArrowRight, Play } from 'lucide-react'
import { sessionTypeAbbrev } from '../lib/coverage'
import { countryDecal, countryFlag, formatGpDateRange } from '../lib/gpIdentity'
import { classifySessionStatus, type HeroStateKind } from '../lib/hero'
import { sortLiveTimingRows, trackStatusInfo } from '../lib/live'
import {
  formatCountdown,
  formatSessionScheduleTime,
  meetingStartTime,
  sessionStartTime,
  type FocusMeetingKind,
} from '../lib/schedule'
import type { EnrichedResult, LiveStreamData, Meeting, Session, WeekendSession } from '../types'
import '../styles/hero.css'

export interface CommandCenterHeroProps {
  state: HeroStateKind
  now: Date
  accent: string
  liveActive: boolean
  liveData: LiveStreamData | null | undefined
  focusMeeting: Meeting
  focusKind: FocusMeetingKind
  sessions: WeekendSession[]
  currentSession: Session | null
  nextSession: Session | null
  analysisSessionKey?: number
  analysisSessionName?: string
  lastRaceName: string
  lastRacePodium: EnrichedResult[]
  lastRaceSessionKey?: number
  nextMeeting: Meeting | null
}

export function CommandCenterHero({
  state,
  now,
  accent,
  liveActive,
  liveData,
  focusMeeting,
  focusKind,
  sessions,
  currentSession,
  nextSession,
  analysisSessionKey,
  analysisSessionName,
  lastRaceName,
  lastRacePodium,
  lastRaceSessionKey,
  nextMeeting,
}: CommandCenterHeroProps) {
  const accentStyle = {
    '--gp-accent': accent,
    '--hero-accent': accent,
  } as React.CSSProperties

  return (
    <div className="hero-panel cc-hero" data-testid="cc-focus">
      <section className="hero-card ui-card glass-panel" style={accentStyle}>
        <div
          className={`hero-accent${state === 'live' ? ' hero-accent--live' : ''}`}
          aria-hidden="true"
        />
        <div className="hero-body">
          <div className="hero-inner">
            {state === 'live' && (
              <LiveHero
                liveActive={liveActive}
                liveData={liveData}
                currentSession={currentSession}
                focusMeeting={focusMeeting}
              />
            )}
            {state === 'upcoming' && (
              <UpcomingHero
                now={now}
                focusMeeting={focusMeeting}
                focusKind={focusKind}
                sessions={sessions}
                currentSession={currentSession}
                nextSession={nextSession}
                liveActive={liveActive}
                analysisSessionKey={analysisSessionKey}
                analysisSessionName={analysisSessionName}
              />
            )}
            {state === 'between' && (
              <BetweenHero
                now={now}
                lastRaceName={lastRaceName}
                lastRacePodium={lastRacePodium}
                lastRaceSessionKey={lastRaceSessionKey}
                nextMeeting={nextMeeting}
                analysisSessionKey={analysisSessionKey}
                analysisSessionName={analysisSessionName}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function LiveHero({
  liveActive,
  liveData,
  currentSession,
  focusMeeting,
}: {
  liveActive: boolean
  liveData: LiveStreamData | null | undefined
  currentSession: Session | null
  focusMeeting: Meeting
}) {
  const sessionName =
    liveData?.Session?.SessionName ?? currentSession?.session_name ?? 'Live session'
  const trackStatus = trackStatusInfo(liveData?.TrackStatus)
  const topThree = sortLiveTimingRows(liveData).filter((r) => r.Position > 0).slice(0, 3)
  const decal = countryDecal(focusMeeting)

  return (
    <>
      <div className="hero-row">
        <span className="hero-decal mono">{decal}</span>
        <div className="hero-identity">
          <div className="hero-eyebrow hero-eyebrow--live mono">● Live now</div>
          <h1 className="hero-title">{sessionName}</h1>
          <div className="hero-sub mono">
            {[focusMeeting.meeting_name, focusMeeting.circuit_short_name].filter(Boolean).join(' · ')}
          </div>
          <div className={`hero-track-status hero-track-status--${trackStatus.key}`}>
            {trackStatus.label}
          </div>
        </div>
        {topThree.length > 0 && (
          <div className="hero-timing" data-testid="hero-live-timing">
            {topThree.map((row) => (
              <div key={row.RacingNumber} className="hero-timing-row">
                <span className={`hero-timing-pos hero-timing-pos--p${row.Position}`}>
                  P{row.Position}
                </span>
                <span className="hero-timing-driver">
                  <span
                    className="hero-timing-bar"
                    style={{ background: `#${row.Info?.TeamColour ?? '9aa0a6'}` }}
                  />
                  {row.Info?.Tla ?? row.RacingNumber}
                </span>
                <span className="hero-timing-gap">
                  {row.Position === 1 ? 'LEAD' : row.Driver.Interval || row.Driver.GapToLeader || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="hero-countdown">
          <div className="hero-cd-label mono">{liveActive ? 'SignalR' : 'On track'}</div>
          <div className="hero-cd-value hero-cd-value--live mono">LIVE</div>
          <div className="hero-cd-sub mono">{sessionName}</div>
        </div>
      </div>
      <div className="hero-actions">
        <Link to="/live" className="hero-cta hero-cta--primary" data-testid="hero-live-link">
          Open Live Timing <ArrowRight size={16} />
        </Link>
      </div>
    </>
  )
}

function UpcomingHero({
  now,
  focusMeeting,
  focusKind,
  sessions,
  currentSession,
  nextSession,
  liveActive,
  analysisSessionKey,
  analysisSessionName,
}: {
  now: Date
  focusMeeting: Meeting
  focusKind: FocusMeetingKind
  sessions: WeekendSession[]
  currentSession: Session | null
  nextSession: Session | null
  liveActive: boolean
  analysisSessionKey?: number
  analysisSessionName?: string
}) {
  const decal = countryDecal(focusMeeting)
  const countdownTarget =
    nextSession && sessionStartTime(nextSession)
      ? sessionStartTime(nextSession)!
      : meetingStartTime(focusMeeting)

  const kindLabel =
    focusKind === 'current'
      ? 'Current weekend'
      : focusKind === 'next'
        ? 'Next weekend'
        : 'Weekend'

  const sortedSessions = [...sessions].sort((a, b) => {
    const left = sessionStartTime(a.session)?.getTime() ?? 0
    const right = sessionStartTime(b.session)?.getTime() ?? 0
    return left - right
  })

  return (
    <>
      <div className="hero-row">
        <span className="hero-decal mono">{decal}</span>
        <div className="hero-identity">
          <div className="hero-eyebrow mono">{kindLabel}</div>
          <h1 className="hero-title">{focusMeeting.meeting_name}</h1>
          <div className="hero-sub mono">
            {[focusMeeting.location, focusMeeting.circuit_short_name].filter(Boolean).join(' · ')}
          </div>
          <div className="hero-sub mono">{formatGpDateRange(focusMeeting)}</div>
        </div>
        <div className="hero-countdown" data-testid="hero-countdown">
          {nextSession ? (
            <>
              <div className="hero-cd-label mono">Next · {nextSession.session_name}</div>
              {countdownTarget && (
                <div className="hero-cd-value mono">{formatCountdown(countdownTarget, now)}</div>
              )}
              <div className="hero-cd-sub mono">{formatSessionScheduleTime(nextSession.date_start)}</div>
            </>
          ) : (
            <>
              <div className="hero-cd-label mono">Status</div>
              <div className="hero-cd-value mono">Complete</div>
              <div className="hero-cd-sub mono">Weekend finished</div>
            </>
          )}
        </div>
      </div>

      {sortedSessions.length > 0 && (
        <div className="hero-schedule-strip" data-testid="hero-schedule-strip" role="list">
          {sortedSessions.map(({ session }) => {
            const status = classifySessionStatus(session, now)
            const isNext = nextSession?.session_key === session.session_key
            const isCurrent = currentSession?.session_key === session.session_key
            const isLive = isCurrent && liveActive
            return (
              <Link
                key={session.session_key}
                to="/race-hub"
                search={{ session_key: session.session_key }}
                className={`hero-schedule-card${isNext ? ' is-next' : ''}${
                  status === 'done' ? ' is-done' : ''
                }${isLive ? ' is-live' : ''}`}
                role="listitem"
              >
                <div className="hero-schedule-abbrev mono">
                  {sessionTypeAbbrev(session.session_type, session.session_name)}
                </div>
                <div className="hero-schedule-name">{session.session_name}</div>
                <div className="hero-schedule-time mono">
                  {formatSessionScheduleTime(session.date_start)}
                </div>
                <div
                  className={`hero-schedule-marker mono${
                    isLive ? ' hero-schedule-marker--live' : isNext ? ' hero-schedule-marker--next' : ''
                  }`}
                >
                  {isCurrent ? 'On track' : status === 'done' ? 'Done' : isNext ? 'Next' : 'Upcoming'}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <div className="hero-actions">
        <Link
          to="/live"
          className="hero-secondary-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Play size={14} /> Watch Live
        </Link>
        {analysisSessionKey != null && (
          <Link
            to="/race-hub"
            search={{ session_key: analysisSessionKey }}
            className="hero-secondary-link"
            data-testid="hero-analysis-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Activity size={14} /> Open Analysis
            {analysisSessionName ? ` · ${analysisSessionName}` : ''}
          </Link>
        )}
      </div>
    </>
  )
}

function BetweenHero({
  now,
  lastRaceName,
  lastRacePodium,
  lastRaceSessionKey,
  nextMeeting,
  analysisSessionKey,
  analysisSessionName,
}: {
  now: Date
  lastRaceName: string
  lastRacePodium: EnrichedResult[]
  lastRaceSessionKey?: number
  nextMeeting: Meeting | null
  analysisSessionKey?: number
  analysisSessionName?: string
}) {
  const nextStart = nextMeeting ? meetingStartTime(nextMeeting) : null
  const podium = lastRacePodium
    .filter((r) => r.position >= 1 && r.position <= 3)
    .sort((a, b) => a.position - b.position)

  return (
    <>
      <div className="hero-row">
        <div className="hero-identity">
          <div className="hero-eyebrow mono">Between race weekends</div>
          {lastRaceName && (
            <h1 className="hero-title" data-testid="hero-last-race">
              After {lastRaceName}
            </h1>
          )}
          {!lastRaceName && <h1 className="hero-title">Season pause</h1>}
        </div>

        {podium.length > 0 && (
          <div className="hero-podium" data-testid="hero-podium">
            {podium.map((r) => (
              <div key={r.driver_number} className="hero-podium-row">
                <span className={`hero-podium-pos hero-podium-pos--p${r.position} mono`}>
                  P{r.position}
                </span>
                <span className="hero-podium-driver">
                  <span
                    className="hero-timing-bar"
                    style={{ background: `#${r.team_colour}` }}
                  />
                  {r.name_acronym}
                </span>
              </div>
            ))}
          </div>
        )}

        {nextMeeting && (
          <div className="hero-countdown" data-testid="hero-next-gp-countdown">
            <div className="hero-between-next">
              {countryFlag(nextMeeting) && (
                <span className="hero-flag" aria-hidden="true">
                  {countryFlag(nextMeeting)}
                </span>
              )}
              <div>
                <div className="hero-cd-label mono">Next GP</div>
                <div className="hero-title" style={{ fontSize: '20px' }}>
                  {nextMeeting.meeting_name}
                </div>
              </div>
            </div>
            {nextStart && (
              <>
                <div className="hero-cd-value mono" style={{ marginTop: 'var(--s3)' }}>
                  {formatCountdown(nextStart, now)}
                </div>
                <div className="hero-cd-sub mono">{formatGpDateRange(nextMeeting)}</div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="hero-actions">
        {lastRaceSessionKey != null && (
          <Link
            to="/race-hub"
            search={{ session_key: lastRaceSessionKey }}
            className="hero-secondary-link"
            data-testid="hero-last-race-link"
          >
            View {lastRaceName || 'last race'} results →
          </Link>
        )}
        {analysisSessionKey != null && analysisSessionKey !== lastRaceSessionKey && (
          <Link
            to="/race-hub"
            search={{ session_key: analysisSessionKey }}
            className="hero-secondary-link"
            data-testid="hero-analysis-link"
          >
            Open Analysis{analysisSessionName ? ` · ${analysisSessionName}` : ''}
          </Link>
        )}
        <Link to="/live" className="hero-secondary-link">
          Live Timing →
        </Link>
      </div>
    </>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLapsComparison, fetchTelemetry } from '../api'
import {
  buildBestLapTraceSeries,
  compareDriverOptions,
  comparisonToDeltaSeries,
  defaultCompareDriverNumbers,
  formatPitLapsCaption,
} from '../lib/compare'
import type { Driver, EnrichedResult } from '../types'
import { teamColor } from '../utils'
import { DriverCell } from './DriverCell'
import { TelemetryTraceChart } from './charts/TelemetryTraceChart'
import { DeltaTimeGraph } from './charts/DeltaTimeGraph'
import '../styles/compare-view.css'

interface Props {
  sessionKey: number
  results: EnrichedResult[]
  drivers: Driver[]
}

function SectionState({
  loading,
  error,
  empty,
  emptyMessage,
  children,
}: {
  loading: boolean
  error: Error | null
  empty: boolean
  emptyMessage: string
  children: React.ReactNode
}) {
  if (loading) {
    return <div className="loading-state">loading…</div>
  }
  if (error) {
    return <div className="error-box">{error.message}</div>
  }
  if (empty) {
    return <div className="missing-notice">{emptyMessage}</div>
  }
  return <>{children}</>
}

export function CompareView({ sessionKey, results, drivers }: Props) {
  const driverOptions = useMemo(
    () => compareDriverOptions(drivers, results),
    [drivers, results],
  )

  const initialPair = useMemo(
    () => defaultCompareDriverNumbers(results, drivers),
    [results, drivers],
  )

  const previousSessionKey = useRef(sessionKey)
  const [driverA, setDriverA] = useState<number | null>(initialPair?.[0] ?? null)
  const [driverB, setDriverB] = useState<number | null>(initialPair?.[1] ?? null)

  useEffect(() => {
    if (previousSessionKey.current !== sessionKey) {
      previousSessionKey.current = sessionKey
      setDriverA(initialPair?.[0] ?? null)
      setDriverB(initialPair?.[1] ?? null)
      return
    }

    if (driverA != null && driverB != null) return
    if (!initialPair) return
    setDriverA(initialPair[0])
    setDriverB(initialPair[1])
  }, [sessionKey, initialPair, driverA, driverB])

  const pair = useMemo((): [number, number] | null => {
    if (driverA == null || driverB == null || driverA === driverB) return null
    return [driverA, driverB]
  }, [driverA, driverB])

  const comparisonQuery = useQuery({
    queryKey: ['laps-comparison', sessionKey, pair?.[0], pair?.[1]],
    queryFn: () => fetchLapsComparison(sessionKey, pair!),
    enabled: pair != null,
    staleTime: 60_000,
  })

  const telemetryAQuery = useQuery({
    queryKey: ['telemetry', sessionKey, pair?.[0]],
    queryFn: () => fetchTelemetry(sessionKey, pair![0]),
    enabled: pair != null,
    staleTime: 60_000,
  })

  const telemetryBQuery = useQuery({
    queryKey: ['telemetry', sessionKey, pair?.[1]],
    queryFn: () => fetchTelemetry(sessionKey, pair![1]),
    enabled: pair != null,
    staleTime: 60_000,
  })

  const comparison = comparisonQuery.data
  const referenceLabel = useMemo(() => {
    if (!pair) return undefined
    const meta = comparison?.drivers.find((d) => d.driver_number === pair[0])
    const session = drivers.find((d) => d.driver_number === pair[0])
    return meta?.name_acronym || session?.name_acronym
  }, [pair, comparison, drivers])

  const deltaSeries = useMemo(() => {
    if (!comparison || !pair) return []
    return comparisonToDeltaSeries(comparison, pair, drivers)
  }, [comparison, pair, drivers])

  const pitCaption = useMemo(() => {
    if (!comparison || !pair) return null
    return formatPitLapsCaption(comparison.pit_laps, pair, comparison, drivers)
  }, [comparison, pair, drivers])

  const traceSeries = useMemo(() => {
    if (!pair || !comparison) return []
    const out = []

    for (const dn of pair) {
      const comp = comparison.drivers.find((d) => d.driver_number === dn)
      const session = drivers.find((d) => d.driver_number === dn)
      const label = comp?.name_acronym || session?.name_acronym || `#${dn}`
      const color = teamColor(comp?.team_colour || session?.team_colour)

      const carData =
        dn === pair[0] ? (telemetryAQuery.data ?? []) : (telemetryBQuery.data ?? [])
      const series = buildBestLapTraceSeries(carData, comp?.laps ?? [], label, color)
      if (series) out.push(series)
    }

    return out
  }, [pair, comparison, drivers, telemetryAQuery.data, telemetryBQuery.data])

  const telemetryLoading = telemetryAQuery.isLoading || telemetryBQuery.isLoading
  const telemetryError = telemetryAQuery.error ?? telemetryBQuery.error

  if (driverOptions.length < 2) {
    return (
      <div className="missing-notice" data-testid="compare-view-empty">
        Need at least two drivers in this session to compare.
      </div>
    )
  }

  const driverAInfo = driverOptions.find((d) => d.driver_number === driverA)
  const driverBInfo = driverOptions.find((d) => d.driver_number === driverB)

  return (
    <div className="compare-view" data-testid="compare-view">
      <div className="compare-pickers">
        <div className="compare-picker">
          <span className="compare-picker-label">Reference</span>
          <select
            className="compare-picker-select"
            value={driverA ?? ''}
            onChange={(e) => setDriverA(Number(e.target.value))}
            data-testid="compare-picker-a"
          >
            {driverOptions.map((d) => (
              <option key={d.driver_number} value={d.driver_number}>
                {d.name_acronym} · #{d.driver_number}
              </option>
            ))}
          </select>
          {driverAInfo && (
            <DriverCell
              acronym={driverAInfo.name_acronym}
              number={driverAInfo.driver_number}
              colour={driverAInfo.team_colour}
            />
          )}
        </div>

        <div className="compare-picker">
          <span className="compare-picker-label">Challenger</span>
          <select
            className="compare-picker-select"
            value={driverB ?? ''}
            onChange={(e) => setDriverB(Number(e.target.value))}
            data-testid="compare-picker-b"
          >
            {driverOptions.map((d) => (
              <option key={d.driver_number} value={d.driver_number}>
                {d.name_acronym} · #{d.driver_number}
              </option>
            ))}
          </select>
          {driverBInfo && (
            <DriverCell
              acronym={driverBInfo.name_acronym}
              number={driverBInfo.driver_number}
              colour={driverBInfo.team_colour}
            />
          )}
        </div>
      </div>

      {driverA === driverB && (
        <div className="analysis-notice">
          <strong>Pick two different drivers</strong> to run a comparison.
        </div>
      )}

      <section className="compare-section" data-testid="compare-telemetry-section">
        <div>
          <div className="compare-section-title">Best lap telemetry</div>
          <div className="compare-section-meta">
            Speed, throttle, and brake traces for each driver&apos;s fastest lap
          </div>
        </div>
        <SectionState
          loading={telemetryLoading}
          error={telemetryError instanceof Error ? telemetryError : null}
          empty={!telemetryLoading && !telemetryError && traceSeries.length === 0}
          emptyMessage="No telemetry samples for the best laps. Car data may not be available for this session."
        >
          <TelemetryTraceChart series={traceSeries} />
        </SectionState>
      </section>

      <section className="compare-section" data-testid="compare-pace-section">
        <div>
          <div className="compare-section-title">Race pace</div>
          <div className="compare-section-meta">
            Cumulative lap-time delta vs {referenceLabel ?? 'reference'}. Deltas are plotted
            only where the reference lap is valid; gaps appear when the reference has no lap
            time.
          </div>
        </div>
        <SectionState
          loading={comparisonQuery.isLoading}
          error={comparisonQuery.error instanceof Error ? comparisonQuery.error : null}
          empty={!comparisonQuery.isLoading && !comparisonQuery.error && deltaSeries.length < 2}
          emptyMessage="No lap comparison data for the selected drivers."
        >
          <DeltaTimeGraph series={deltaSeries} referenceLabel={referenceLabel} />
          {pitCaption && (
            <p className="compare-pit-caption" data-testid="compare-pit-caption">
              {pitCaption}
            </p>
          )}
        </SectionState>
      </section>
    </div>
  )
}

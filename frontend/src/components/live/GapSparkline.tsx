import { gapTrend, sparklinePoints } from '../../lib/gapHistory'

interface Props {
  samples: number[] | undefined
  width?: number
  height?: number
}

export function GapSparkline({ samples, width = 56, height = 14 }: Props) {
  if (!samples || samples.length < 2) {
    return <span className="gap-spark gap-spark-empty">·</span>
  }

  const trend = gapTrend(samples)
  const points = sparklinePoints(samples, width, height)

  return (
    <span className={`gap-spark trend-${trend ?? 'steady'}`} data-testid="gap-spark">
      <svg
        className="gap-spark-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
      {trend === 'closing' && (
        <span className="trend-arrow trend-arrow-closing" title="Gap closing">▼</span>
      )}
      {trend === 'opening' && (
        <span className="trend-arrow trend-arrow-opening" title="Gap opening">▲</span>
      )}
    </span>
  )
}

import { trackStatusInfo } from '../../lib/live'

interface Props {
  status: string | null | undefined
}

export function TrackStatusBanner({ status }: Props) {
  if (!status) return null
  const info = trackStatusInfo(status)

  return (
    <div className={`track-banner track-banner-${info.key}`} role="status" data-testid="track-banner">
      <span className="track-banner-label">{info.label}</span>
      {info.detail && <span className="track-banner-detail">{info.detail}</span>}
    </div>
  )
}

type Source = 'local' | 'partial' | 'none' | 'cancelled'

interface Props {
  source: Source
  label?: string
}

export function SourceBadge({ source, label }: Props) {
  switch (source) {
    case 'local':
      return <span className="badge badge-local">{label ?? 'Local'}</span>
    case 'partial':
      return <span className="badge badge-partial">{label ?? 'Partial'}</span>
    case 'cancelled':
      return <span className="badge badge-cancelled">{label ?? 'Cancelled'}</span>
    default:
      return <span className="badge badge-none">{label ?? 'None'}</span>
  }
}

export function weekendStatusLabel(source: Source): string {
  switch (source) {
    case 'local':
      return 'Full'
    case 'partial':
      return 'Partial'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Missing'
  }
}

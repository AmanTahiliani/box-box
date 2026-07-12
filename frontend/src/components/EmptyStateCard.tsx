import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  title: string
  hint: ReactNode
  testId?: string
  className?: string
}

export function EmptyStateCard({ icon: Icon, title, hint, testId, className = '' }: Props) {
  return (
    <div className={`empty-state ui-card ${className}`.trim()} data-testid={testId}>
      <Icon size={32} className="empty-state-icon" aria-hidden />
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{hint}</div>
    </div>
  )
}

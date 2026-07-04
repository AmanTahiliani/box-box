import type { ReactNode } from 'react'
import '../styles/meaning.css'

export interface MeaningProps {
  value: ReactNode
  meaning?: string | null
  /** Long-form explanation for the native tooltip; falls back to meaning. */
  title?: string | null
  tone?: 'good' | 'bad' | 'neutral' | 'warn'
}

export function Meaning({ value, meaning, title, tone }: MeaningProps) {
  if (!meaning) {
    return <>{value}</>
  }

  const tooltip = title ?? meaning
  const toneClass = tone ? `meaning-caption--${tone}` : ''

  return (
    <span className="meaning" title={tooltip}>
      <span className="meaning-value">{value}</span>
      <span className={`meaning-caption ${toneClass}`.trim()}>{meaning}</span>
    </span>
  )
}

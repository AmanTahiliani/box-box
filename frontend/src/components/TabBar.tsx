export type Tab =
  | 'results'
  | 'grid'
  | 'strategy'
  | 'positions'
  | 'laps'
  | 'race_control'
  | 'weather'
  | 'datasets'

const TABS: { id: Tab; label: string }[] = [
  { id: 'results', label: 'Results' },
  { id: 'grid', label: 'Grid' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'positions', label: 'Positions' },
  { id: 'laps', label: 'Laps' },
  { id: 'race_control', label: 'Race Control' },
  { id: 'weather', label: 'Weather' },
  { id: 'datasets', label: 'Datasets' },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div className="tab-bar" role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab-btn${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export type Tab =
  | 'overview'
  | 'race_story'
  | 'strategy'
  | 'lap_data'
  | 'conditions'
  | 'race_control'
  | 'data_status'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'race_story', label: 'Race Story' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'lap_data', label: 'Lap Data' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'race_control', label: 'Race Control' },
  { id: 'data_status', label: 'Data Status' },
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

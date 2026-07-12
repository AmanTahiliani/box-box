export type Tab =
  | 'overview'
  | 'race_story'
  | 'strategy'
  | 'compare'
  | 'lap_data'
  | 'conditions'
  | 'race_control'
  | 'data_status'

interface TabDef {
  id: Tab
  label: string
}

interface TabGroup {
  id: string
  label: string
  tabs: TabDef[]
}

// Fan-facing hierarchy: Story first, then Analysis, then Data/Context. Every
// existing capability is preserved — only the grouping and ordering change.
const TAB_GROUPS: TabGroup[] = [
  {
    id: 'story',
    label: 'Story',
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'race_story', label: 'Race Story' },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    tabs: [
      { id: 'strategy', label: 'Strategy' },
      { id: 'compare', label: 'Compare' },
      { id: 'lap_data', label: 'Lap Data' },
    ],
  },
  {
    id: 'context',
    label: 'Data & Context',
    tabs: [
      { id: 'conditions', label: 'Conditions' },
      { id: 'race_control', label: 'Race Control' },
      { id: 'data_status', label: 'Diagnostics' },
    ],
  },
]

interface Props {
  active: Tab
  onChange: (tab: Tab) => void
}

export function TabBar({ active, onChange }: Props) {
  return (
    <div className="tab-bar tab-bar-grouped" role="tablist" data-testid="rh-tabbar">
      {TAB_GROUPS.map((group) => (
        <div key={group.id} className="tab-group" data-testid={`rh-tabgroup-${group.id}`}>
          <span className="tab-group-label mono" aria-hidden="true">
            {group.label}
          </span>
          <div className="tab-group-btns">
            {group.tabs.map((t) => (
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
        </div>
      ))}
    </div>
  )
}

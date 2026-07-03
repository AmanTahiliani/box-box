import type { Battle } from '../../lib/battles'
import { battleLabel } from '../../lib/battles'

interface Props {
  battles: Battle[]
}

export function BattleChips({ battles }: Props) {
  if (battles.length === 0) return null

  return (
    <div className="battle-chips" data-testid="battle-chips">
      <span className="battle-chips-label">Battles</span>
      {battles.map((battle) => (
        <span className="battle-chip mono" key={battle.drivers.map((d) => d.racingNumber).join('-')}>
          {battleLabel(battle)}
        </span>
      ))}
    </div>
  )
}

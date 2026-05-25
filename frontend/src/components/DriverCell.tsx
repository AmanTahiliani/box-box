import { teamColor } from '../utils'

interface Props {
  acronym: string
  number: number
  colour: string
}

export function DriverCell({ acronym, number, colour }: Props) {
  return (
    <div className="drv-cell">
      <div className="drv-bar" style={{ background: teamColor(colour) }} />
      <span className="drv-code">{acronym}</span>
      <span className="drv-num">{number}</span>
    </div>
  )
}

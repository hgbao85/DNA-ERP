import type { BeCutMachineStats } from '../../../../services/floor-api'
import { typeCardView } from '../cutMachineStats'
import { card, muted } from '../qlsxUi'

/** Mỗi loại máy một thẻ: số to là cây/ngày trung vị. */
export default function TypeCards({ types }: { types: BeCutMachineStats['byMachineType'] }) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))' }}>
      {types.map((t) => {
        const v = typeCardView(t)
        return (
          <div key={t.machineType} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--surface2)' }}>
            <span style={{ ...muted, fontSize: 13, fontWeight: 600 }}>{v.title}</span>
            <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>{v.value}</span>
            <span style={muted}>{v.unit}</span>
            <span style={{ ...muted, fontVariantNumeric: 'tabular-nums' }}>{v.detail}</span>
          </div>
        )
      })}
    </div>
  )
}

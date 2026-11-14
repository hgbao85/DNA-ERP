import type { BeCutMachineStats } from '../../../../services/floor-api'
import { methodLines, statsSummaryParts } from '../cutMachineStats'
import { card, muted, stack } from '../qlsxUi'
import DayTable from './DayTable'
import MachineTable from './MachineTable'
import MaterialTable from './MaterialTable'
import TypeCards from './TypeCards'

function Summary({ data }: { data: BeCutMachineStats }) {
  const s = statsSummaryParts(data)
  return (
    <div style={{ ...muted, fontSize: 13 }}>
      {s.workshop} · <b style={{ color: 'var(--text)' }}>{s.range}</b> · {s.updated}
    </div>
  )
}

function MethodNotes({ method }: { method: BeCutMachineStats['method'] }) {
  return (
    <div style={stack(2)}>
      <b style={{ ...muted, color: 'var(--text)' }}>Cách tính</b>
      {methodLines(method).map((l) => <span key={l} style={muted}>{l}</span>)}
    </div>
  )
}

/** Phần thân khi đã có số: thẻ loại máy, bảng theo máy / ngày / loại sắt và ghi chú cách tính. */
export default function StatsBody({ data }: { data: BeCutMachineStats }) {
  const hasData = data.days.length > 0
  return (
    <div style={stack(14)}>
      <Summary data={data} />
      {hasData ? (
        <>
          <TypeCards types={data.byMachineType} />
          <MachineTable data={data} />
          <DayTable data={data} />
          <MaterialTable rows={data.byMaterial} />
        </>
      ) : (
        <div style={{ ...card, textAlign: 'center', color: 'var(--text2)', padding: '24px 16px' }}>
          Chưa có lần báo nào ở máy cắt của xưởng trong khoảng này.
        </div>
      )}
      <MethodNotes method={data.method} />
    </div>
  )
}

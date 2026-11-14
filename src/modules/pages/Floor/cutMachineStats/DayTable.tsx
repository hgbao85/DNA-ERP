import type { BeCutMachineStats } from '../../../../services/floor-api'
import { fmt1, fmtDayShort, fmtOrDash, machineById, reportWindowText, sortedDays, topMaterialLabel } from '../cutMachineStats'
import { Fold, headLine, numTd, numTh, rowLine, TableScroll, td, th } from '../qlsxUi'

const timeTd = { ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } as const

/** Khối gập "Chi tiết theo ngày": mỗi dòng là một máy trong một ngày. */
export default function DayTable({ data }: { data: BeCutMachineStats }) {
  const byId = machineById(data.machines)
  return (
    <Fold title="Chi tiết theo ngày">
      <TableScroll minWidth={820}>
        <thead>
          <tr style={headLine}>
            <th style={th}>Ngày</th><th style={th}>Máy</th><th style={numTh}>Lần báo</th><th style={th}>Báo đầu–cuối</th>
            <th style={numTh}>Phút tính</th><th style={numTh}>Đoạn</th><th style={numTh}>Mét</th><th style={numTh}>Cây</th>
            <th style={numTh}>Cây/giờ</th><th style={th}>Loại sắt nhiều nhất</th>
          </tr>
        </thead>
        <tbody>
          {sortedDays(data).map((d) => (
            <tr key={`${d.day}|${d.machineId}`} style={rowLine}>
              <td style={td}>{fmtDayShort(d.day)}</td>
              <td style={td}>{byId.get(d.machineId)?.code ?? ''}</td>
              <td style={numTd}>{d.reports}</td>
              <td style={timeTd}>{reportWindowText(d)}</td>
              <td style={numTd}>{d.rateMinutes}</td>
              <td style={numTd}>{d.segments.toLocaleString('vi-VN')}</td>
              <td style={numTd}>{fmt1(d.meters)}</td>
              <td style={{ ...numTd, fontWeight: 700 }}>{fmt1(d.bars)}</td>
              <td style={numTd}>{fmtOrDash(d.barsPerHour)}</td>
              <td style={{ ...td, overflowWrap: 'anywhere' }}>{topMaterialLabel(d.materials) || '—'}</td>
            </tr>
          ))}
        </tbody>
      </TableScroll>
    </Fold>
  )
}

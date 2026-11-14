import type { BeCutMachineStats } from '../../../../services/floor-api'
import { fmt1, fmtOrDash, machineNameSuffix, machineRows, machineTypeLabel } from '../cutMachineStats'
import { headLine, numTd, numTh, rowLine, sectionTitle, TableScroll, td, th } from '../qlsxUi'

/** Bảng "Theo máy": mọi máy của xưởng, kể cả máy chưa có số. */
export default function MachineTable({ data }: { data: BeCutMachineStats }) {
  return (
    <div>
      <h3 style={{ ...sectionTitle, fontSize: 14, marginBottom: 6 }}>Theo máy</h3>
      <TableScroll minWidth={620}>
        <thead>
          <tr style={headLine}>
            <th style={th}>Máy</th><th style={th}>Loại</th>
            <th style={numTh}>Ngày có số</th><th style={numTh}>Tổng cây</th><th style={numTh}>Cây/ngày TB</th>
            <th style={numTh}>Cây/ngày trung vị</th><th style={numTh}>Cây/giờ</th>
          </tr>
        </thead>
        <tbody>
          {machineRows(data).map(({ machine: m, stat: s }) => (
            <tr key={m.id} style={{ ...rowLine, opacity: s ? 1 : 0.55 }}>
              <td style={td}><b>{m.code}</b>{machineNameSuffix(m)}</td>
              <td style={td}>{machineTypeLabel(m.machineType)}</td>
              {s ? (
                <>
                  <td style={numTd}>{s.daysWithData}</td><td style={numTd}>{fmt1(s.totalBars)}</td>
                  <td style={numTd}>{fmt1(s.barsPerDayAvg)}</td>
                  <td style={{ ...numTd, fontWeight: 700 }}>{fmt1(s.barsPerDayMedian)}</td>
                  <td style={numTd}>{fmtOrDash(s.barsPerHour)}</td>
                </>
              ) : (
                <td style={{ ...td, textAlign: 'right' }} colSpan={5}>chưa có số</td>
              )}
            </tr>
          ))}
        </tbody>
      </TableScroll>
    </div>
  )
}

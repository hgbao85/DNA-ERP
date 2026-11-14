import type { BeCutMachineStats } from '../../../../services/floor-api'
import { fmt1, fmtOrDash, machineTypeLabel } from '../cutMachineStats'
import { Fold, headLine, numTd, numTh, rowLine, TableScroll, td, th } from '../qlsxUi'

/** Khối gập "Theo loại sắt": cây và cây/giờ theo loại máy + loại sắt. */
export default function MaterialTable({ rows }: { rows: BeCutMachineStats['byMaterial'] }) {
  return (
    <Fold title="Theo loại sắt">
      <TableScroll minWidth={520}>
        <thead>
          <tr style={headLine}>
            <th style={th}>Loại máy</th><th style={th}>Loại sắt</th><th style={numTh}>Cây</th>
            <th style={numTh}>Phút tính</th><th style={numTh}>Cây/giờ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={`${x.machineType}|${x.materialId}`} style={rowLine}>
              <td style={td}>{machineTypeLabel(x.machineType)}</td>
              <td style={{ ...td, overflowWrap: 'anywhere' }}>{x.label}</td>
              <td style={numTd}>{fmt1(x.bars)}</td><td style={numTd}>{x.rateMinutes}</td>
              <td style={numTd}>{fmtOrDash(x.barsPerHour)}</td>
            </tr>
          ))}
        </tbody>
      </TableScroll>
    </Fold>
  )
}

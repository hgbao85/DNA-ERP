import { FileSpreadsheet } from 'lucide-react'
import DatePicker from '../../../../components/DatePicker'
import RefreshButton from '../../../../components/RefreshButton'
import { QueueWorkshopPicker, type QueueWorkshop } from '../queueWorkshop'
import { btn, rowWrap } from '../qlsxUi'

interface Props {
  ws: QueueWorkshop
  range: { from: string; to: string }
  onRange: (r: { from: string; to: string }) => void
  onRefresh: () => void
  refreshing: boolean
  canExport: boolean
  onExport: () => void
}

/** Hàng chọn xưởng, khoảng ngày, làm mới và tải Excel. */
export default function StatsToolbar({ ws, range, onRange, onRefresh, refreshing, canExport, onExport }: Props) {
  return (
    <div style={{ ...rowWrap, gap: 12 }}>
      <QueueWorkshopPicker ws={ws} />
      <div style={rowWrap}>
        <div style={{ width: 150 }}>
          <DatePicker value={range.from} onChange={(v) => v && onRange({ ...range, from: v })} title="Từ ngày" minHeight={36} />
        </div>
        <span aria-hidden style={{ color: 'var(--text2)' }}>–</span>
        <div style={{ width: 150 }}>
          <DatePicker value={range.to} onChange={(v) => v && onRange({ ...range, to: v })} title="Đến ngày" minHeight={36} />
        </div>
      </div>
      <div style={{ ...rowWrap, gap: 8, marginLeft: 'auto' }}>
        <RefreshButton onRefresh={onRefresh} loading={refreshing} />
        <button type="button" style={btn('secondary', !canExport)} disabled={!canExport} onClick={onExport}>
          <FileSpreadsheet size={15} /> Tải Excel
        </button>
      </div>
    </div>
  )
}

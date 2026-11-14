import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { floorAdmin, type BeCutAllocationLog } from '../../../../services/floor-api'
import { useFetch } from '../../../../hooks/useFetch'
import { useIsMobile } from '../../../../hooks/useMediaQuery'
import LoadingState from '../../../../components/LoadingState'
import LoadErrorState from '../../../../components/LoadErrorState'
import { defaultLogRange, isValidLogRange, ordersWithMoves } from '../cutAllocationModel'
import { btn, card, muted, Notice, stack } from '../qlsxUi'
import { HistoryFilters, LogList, LogTable, OrdersTable } from './HistoryParts'

const HEADER_BTN = { ...btn('ghost'), minHeight: 28, padding: '0 4px', fontSize: 15, fontWeight: 700, color: 'var(--text)' } as const
const subTitle = { fontSize: 14, fontWeight: 700, marginBottom: 4 } as const

function LogContent({ data }: { data: BeCutAllocationLog }) {
  const isMobile = useIsMobile()
  const orders = ordersWithMoves(data.byOrder)
  return (
    <>
      <div>
        <div style={subTitle}>Lệnh có điều chuyển</div>
        {orders.length === 0
          ? <div style={muted}>Không có lệnh nào đổi máy hoặc tách trong khoảng này.</div>
          : <OrdersTable orders={orders} />}
      </div>
      <div>
        <div style={subTitle}>Nhật ký</div>
        {data.entries.length === 0
          ? <div style={muted}>Chưa có thay đổi nào trong khoảng này.</div>
          : isMobile ? <LogList entries={data.entries} /> : <LogTable entries={data.entries} />}
      </div>
    </>
  )
}

function HistoryBody({ workshopId, tick }: { workshopId: string | null; tick: number }) {
  const [range, setRange] = useState(() => defaultLogRange())
  const { from, to } = range
  const valid = isValidLogRange(from, to)
  const { data, isLoading, error, refetch } = useFetch<BeCutAllocationLog | null>(
    () => (valid ? floorAdmin.getCutAllocationLog({ workshopId, from, to }) : Promise.resolve(null)), [workshopId, from, to, tick],
  )
  return (
    <div style={{ ...stack(12), marginTop: 8 }}>
      <HistoryFilters from={from} to={to} onChange={setRange} />
      {!valid && <Notice tone="warn">Chọn ngày bắt đầu không sau ngày kết thúc.</Notice>}
      {valid && isLoading && <LoadingState />}
      {valid && !isLoading && (error || !data) && <LoadErrorState error={error ?? 'Không có dữ liệu'} onRetry={() => void refetch()} />}
      {valid && data && <LogContent data={data} />}
    </div>
  )
}

/** Khối thu gọn "Lịch sử chia tay": nhật ký thêm / tách / đổi máy / đổi số cây / xoá và các lệnh có điều chuyển. */
export default function ChangeHistory({ workshopId, tick }: { workshopId: string | null; tick: number }) {
  const [open, setOpen] = useState(false)
  return (
    <section style={card} aria-label="Lịch sử chia tay">
      <button type="button" style={HEADER_BTN} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} Lịch sử chia tay
      </button>
      {open && <HistoryBody workshopId={workshopId} tick={tick} />}
    </section>
  )
}

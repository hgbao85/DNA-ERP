'use client'

/**
 * Khối "Sản lượng theo lệnh" ở đầu màn Khung hàn / Mảnh chờ đan (23/11/2026, bỏ hàng đợi xưởng): các lệnh tổ Hàn / Sơn đang
 * làm được ở xưởng đã chọn (đúng tập công nhân thấy trên màn quét) + lệnh vừa đủ số trong 7 ngày, mỗi lệnh có %, còn thiếu bao
 * nhiêu mảnh. Mở lệnh thì ra ngăn chi tiết (QlsxPiDetail): theo SKU → mảnh, Cần · Đã báo · KCS đạt · Lỗi · Còn thiếu.
 * Chỉ đọc. Nguồn: GET /floor/stage-progress và /floor/stage-progress/:stage/:piId. QLSX gắn xưởng thì cố định xưởng mình.
 */

import { useState } from 'react'
import { floorAdmin, type BeStageProgressRow } from '../../../services/floor-api'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import LenhCode from '../../../components/LenhCode'
import { QueueWorkshopPicker, useQueueWorkshop } from './queueWorkshop'
import QlsxPiDetail from './QlsxPiDetail'
import PiProgressCard from './PiProgressCard'
import { stageEmptyText, stageMissingText } from './stageOutputModel'

const TOPICS = ['floor', 'production-batches', 'qc-reviews'] as const

export default function StageOutputBlock({ stage }: { stage: 'HAN' | 'SON' }) {
  const ws = useQueueWorkshop()
  // Tài khoản tổ có thể không đọc được danh sách xưởng: khi đó bỏ ô chọn xưởng, để máy chủ tự lọc theo quyền.
  const wsId = ws.error ? null : ws.workshopId
  const ready = !ws.isLoading
  const list = useFetch<BeStageProgressRow[]>(() => (ready ? floorAdmin.stageProgress(stage, wsId) : Promise.resolve([])), [stage, wsId, ready])
  const { refetch } = list
  useRealtimeRefetch(TOPICS, () => { void refetch() })
  const [open, setOpen] = useState<BeStageProgressRow | null>(null)
  const showPicker = !ws.error && (ws.scoped || ws.list.length > 0)

  return (
    <section aria-label="Sản lượng theo lệnh" style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '12px 0 var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Sản lượng theo lệnh</h3>
        {showPicker && <QueueWorkshopPicker ws={ws} />}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: -4 }}>% và còn thiếu tính theo số đã báo trừ lỗi (gồm phần KCS chưa chấm).</div>
      {list.isLoading ? <LoadingState />
        : list.error || !list.data ? <LoadErrorState error={list.error ?? 'Không có dữ liệu'} onRetry={refetch} />
          : list.data.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {stageEmptyText(stage)}
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.data.map((r) => (
                <li key={r.productionInvoiceId}>
                  <PiProgressCard title={<LenhCode piCode={r.code} />} status={stageMissingText(r)} statusTone={r.complete ? 'green' : 'amber'}
                    deadline={r.deadline} percent={r.percent} onClick={() => setOpen(r)} />
                </li>
              ))}
            </ul>
          )}
      {open && <QlsxPiDetail stage={stage} productionInvoiceId={open.productionInvoiceId} piCode={open.code} onClose={() => setOpen(null)} />}
    </section>
  )
}

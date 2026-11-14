'use client'

/**
 * Khối "Năng suất máy cắt" trong tab "Báo cáo" của màn QLSX "Sản lượng xưởng".
 * Chỉ ĐO: số cây mỗi ngày / mỗi giờ của từng máy cắt, từ giờ công nhân báo qua mã QR. Xưởng chọn như tab "Chia máy cắt"
 * (QLSX gắn xưởng thì cố định). Tự tải lại khi có báo mới.
 */

import { useState } from 'react'
import LoadErrorState from '../../../components/LoadErrorState'
import LoadingState from '../../../components/LoadingState'
import { useQueueWorkshop } from './queueWorkshop'
import { card, Notice, sectionTitle, stack } from './qlsxUi'
import { defaultRange, rangeError, statsErrorText } from './cutMachineStats'
import { exportCutStatsXlsx } from './cutMachineStats/exportXlsx'
import StatsBody from './cutMachineStats/StatsBody'
import StatsToolbar from './cutMachineStats/StatsToolbar'
import { useCutMachineStats } from './cutMachineStats/useCutMachineStats'

export default function QlsxCutMachineStats() {
  const ws = useQueueWorkshop()
  const [range, setRange] = useState(() => defaultRange())
  const [exportErr, setExportErr] = useState<string | null>(null)
  const rangeProblem = rangeError(range.from, range.to)
  const workshopId = ws.workshopId
  const stats = useCutMachineStats(workshopId, range.from, range.to, !rangeProblem && !!workshopId)
  const { data, error } = stats

  const exportXlsx = async () => {
    if (!data) return
    setExportErr(null)
    try { await exportCutStatsXlsx(data) } catch (e) { setExportErr(statsErrorText(e, 'Không xuất được file Excel')) }
  }

  return (
    <section style={{ ...card, ...stack(14) }} aria-label="Năng suất máy cắt">
      <div>
        <h2 style={{ ...sectionTitle, fontSize: 16 }}>Năng suất máy cắt</h2>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Đo từ giờ công nhân báo qua mã QR tại máy cắt. Dùng để chốt số cây mỗi ca cho từng loại máy.
        </div>
      </div>
      <StatsToolbar ws={ws} range={range} onRange={setRange} onRefresh={stats.reload} refreshing={stats.loading || stats.fetching}
        canExport={!!data && data.days.length > 0} onExport={() => void exportXlsx()} />
      {rangeProblem && <Notice tone="warn">{rangeProblem}</Notice>}
      {exportErr && <Notice tone="err">{exportErr}</Notice>}
      {ws.isLoading && <LoadingState />}
      {ws.error && <LoadErrorState error={ws.error} onRetry={ws.retry} />}
      {!ws.isLoading && !ws.error && !workshopId && (
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 16, fontSize: 13 }}>Chọn xưởng để xem năng suất máy cắt.</div>
      )}
      {stats.loading && !ws.isLoading && <LoadingState />}
      {error && <LoadErrorState error={error} onRetry={stats.reload} />}
      {data && !error && <StatsBody data={data} />}
    </section>
  )
}

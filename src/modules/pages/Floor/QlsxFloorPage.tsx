'use client'

/**
 * "Sản lượng xưởng" - màn chung của QLSX cho QR tại máy (2026-10-13, changelog BE
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 24): công nhân Phôi/Hàn/Sơn quét mã tại máy và tự báo số,
 * QLSX ở đây (1) xem PI đang chạy + hàng đợi của từng tổ, (2) kiểm các đợt chưa gửi KCS rồi "Gửi KCS" hoặc đảo lần
 * báo sai, (3) báo cáo số đạt/lỗi KCS đã chốt theo ngày/tháng/năm (2026-10-15), (4) quản lý máy + in tem QR, (5) quản lý
 * tài khoản công nhân.
 */

import { useCallback, useEffect, useState } from 'react'
import { floorAdmin, type BeFloorReview, type BeFloorSummary, type BeQueueEntry, type FloorStage } from '../../../services/floor-api'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { tabBtn } from '../../../styles/buttons'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import QlsxQueue from './QlsxQueue'
import QlsxReview from './QlsxReview'
import QlsxSetup from './QlsxSetup'
import QlsxStats from './QlsxStats'
import { Pill, STAGE_LABEL } from './qlsxUi'

type Tab = 'output' | 'stats' | 'machines' | 'workers'
const STAGES: FloorStage[] = ['PHOI', 'HAN', 'SON']
const TOPICS = ['floor', 'steel-issues', 'production-batches', 'qc-reviews'] as const
const LAST_STAGE_KEY = 'qlsx.floor.stage'

function StageView({ stage, summary, refreshSummary }: { stage: FloorStage; summary: BeFloorSummary | null; refreshSummary: () => void }) {
  const queue = useFetch<BeQueueEntry[]>(() => floorAdmin.queue(stage), [stage])
  const review = useFetch<BeFloorReview>(() => floorAdmin.review(stage), [stage])
  const refetchAll = useCallback(() => { void queue.refetch(); void review.refetch(); refreshSummary() }, [queue, review, refreshSummary])
  useRealtimeRefetch(TOPICS, refetchAll)

  // Tab mở nền lâu có thể lỡ sự kiện (mất mạng) - tự tải lại khi người dùng quay lại tab.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refetchAll() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refetchAll])

  if (queue.isLoading || review.isLoading) return <LoadingState />
  if (queue.error || review.error || !queue.data || !review.data) {
    return <LoadErrorState error={queue.error ?? review.error ?? 'Không có dữ liệu'} onRetry={refetchAll} />
  }
  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
      <QlsxQueue stage={stage} entries={queue.data} openCount={summary?.[stage].open ?? 0} onChanged={refetchAll} />
      <QlsxReview stage={stage} data={review.data} onChanged={refetchAll} />
    </div>
  )
}

export default function QlsxFloorPage() {
  const [tab, setTab] = useState<Tab>('output')
  // Nhớ tổ đang xem (localStorage chỉ là tiện ích, bọc try/catch).
  const [stage, setStageState] = useState<FloorStage>(() => {
    try {
      const v = localStorage.getItem(LAST_STAGE_KEY)
      return v === 'HAN' || v === 'SON' ? v : 'PHOI'
    } catch { return 'PHOI' }
  })
  const summary = useFetch<BeFloorSummary>(() => floorAdmin.summary(), [])
  const { refetch: refetchSummary } = summary
  const refreshSummary = useCallback(() => { void refetchSummary() }, [refetchSummary])
  useRealtimeRefetch(TOPICS, refreshSummary)

  const setStage = (s: FloorStage) => {
    setStageState(s)
    try { localStorage.setItem(LAST_STAGE_KEY, s) } catch { /* bỏ qua */ }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'output', label: 'Sản lượng & gửi KCS' },
    { id: 'stats', label: 'Báo cáo' },
    { id: 'machines', label: 'Máy & tem QR' },
    { id: 'workers', label: 'Công nhân' },
  ]

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sản lượng xưởng</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Công nhân quét mã tại máy và tự báo số; bạn kiểm rồi gửi KCS, xếp PI cho từng tổ.
        </div>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)} style={tabBtn(tab === t.id, 'var(--blue)')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'output' && (
        <>
          <div role="tablist" aria-label="Tổ" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STAGES.map((s) => {
              const n = summary.data?.[s].open ?? 0
              const on = stage === s
              return (
                <button key={s} role="tab" aria-selected={on} type="button" onClick={() => setStage(s)} style={{
                  minHeight: 40, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: on ? 700 : 500,
                  border: `1px solid ${on ? 'var(--blue)' : 'var(--border2)'}`,
                  background: on ? 'var(--blue-bg)' : 'var(--surface)', color: on ? 'var(--blue-text)' : 'var(--text)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}>
                  Tổ {STAGE_LABEL[s]} {n > 0 && <Pill tone="amber">{n} chờ gửi</Pill>}
                </button>
              )
            })}
          </div>
          <StageView key={stage} stage={stage} summary={summary.data} refreshSummary={refreshSummary} />
        </>
      )}
      {tab === 'stats' && <QlsxStats />}
      {tab === 'machines' && <QlsxSetup section="machines" />}
      {tab === 'workers' && <QlsxSetup section="workers" />}
    </div>
  )
}

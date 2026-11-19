'use client'

/**
 * "Sản lượng xưởng" - màn chung của QLSX cho QR tại máy (2026-10-13, changelog BE
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 24): công nhân Phôi/Hàn/Sơn quét mã tại máy và tự báo số,
 * QLSX ở đây (1) xem PI đang chạy + hàng đợi của từng tổ, (2) theo dõi các đợt "Đang chờ KCS chấm" và hủy lần báo sai
 * (KCS tự chấm - P1 18/11/2026, QLSX không còn "Gửi KCS"), (3) báo cáo số đạt/lỗi KCS đã chốt theo ngày/tháng/năm
 * (2026-10-15), (4) quản lý máy + in tem QR, (5) quản lý tài khoản công nhân.
 */

import { useCallback, useEffect, useState } from 'react'
import { floorAdmin, type BeFloorReview, type BeFloorSummary, type BeQueueEntry, type FloorStage } from '../../../services/floor-api'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { useMaxWidth } from '../../../hooks/useMediaQuery'
import { tabBtn } from '../../../styles/buttons'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import QlsxCutAllocation from './QlsxCutAllocation'
import { useQueueWorkshop, type QueueWorkshop } from './queueWorkshop'
import QlsxQueue from './QlsxQueue'
import QlsxReview from './QlsxReview'
import QlsxSetup from './QlsxSetup'
import QlsxStats from './QlsxStats'
import QlsxCutMachineStats from './QlsxCutMachineStats'
import { Pill, STAGE_LABEL, qlsxStageFromFocus, startPolling, summaryPillText } from './qlsxUi'
import { useUrlParamValue } from '../../../hooks/useUrlState'

type Tab = 'output' | 'cut' | 'stats' | 'machines' | 'workers'
const STAGES: FloorStage[] = ['PHOI', 'HAN', 'SON']
const TOPICS = ['floor', 'steel-issues', 'production-batches', 'qc-reviews'] as const
const LAST_STAGE_KEY = 'qlsx.floor.stage'

function StageView({ stage, refreshSummary, ws }: { stage: FloorStage; refreshSummary: () => void; ws: QueueWorkshop }) {
  // Lưới 2 cột (mỗi cột ≥ 420px) chỉ đủ chỗ khi phần nội dung ≥ ~860px = màn ≥ ~1180px (trừ thanh bên + đệm); dưới đó lưới
  // tự xếp 1 cột → coi là "hẹp" để đưa "Đang chờ KCS chấm" lên trước (1024px của laptop vẫn là 1 cột).
  const compact = useMaxWidth(1180)
  // Hàng đợi theo xưởng (14/11/2026): người chưa có xưởng nào để chọn thì không hỏi hàng đợi.
  const wsId = ws.workshopId
  const queue = useFetch<BeQueueEntry[]>(() => (ws.isLoading || ws.error ? Promise.resolve([]) : floorAdmin.queue(stage, wsId)), [stage, wsId, ws.isLoading, ws.error])
  const review = useFetch<BeFloorReview>(() => floorAdmin.review(stage), [stage])
  const refetchAll = useCallback(() => { void queue.refetch(); void review.refetch(); refreshSummary() }, [queue, review, refreshSummary])
  useRealtimeRefetch(TOPICS, refetchAll)

  // Tab mở nền lâu có thể lỡ sự kiện (mất mạng) - tự tải lại khi người dùng quay lại tab.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') refetchAll() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refetchAll])

  if (ws.error) return <LoadErrorState error={ws.error} onRetry={ws.retry} />
  if (ws.isLoading || queue.isLoading || review.isLoading) return <LoadingState />
  if (queue.error || review.error || !queue.data || !review.data) {
    return <LoadErrorState error={queue.error ?? review.error ?? 'Không có dữ liệu'} onRetry={refetchAll} />
  }
  const reviewId = `qlsx-review-${stage}`
  const goToReview = () => {
    const el = document.getElementById(reviewId)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el?.focus({ preventScroll: true })
  }
  // Màn hẹp (< 900px, 1 cột): "Đang chờ KCS chấm" là việc hằng ngày của QLSX nên lên TRƯỚC thẻ PI + hàng đợi (2026-10-20, mục 53);
  // màn rộng giữ 2 cột như cũ (thẻ PI trái, đang chờ KCS chấm phải).
  const queueBlock = (
    <QlsxQueue stage={stage} entries={queue.data} workshop={ws} review={review.data}
      onChanged={refetchAll} onGoToReview={goToReview} />
  )
  const reviewBlock = (
    <div id={reviewId} tabIndex={-1} style={{ outline: 'none', scrollMarginTop: 16 }}>
      <QlsxReview stage={stage} data={review.data} onChanged={refetchAll} />
    </div>
  )
  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
      {compact ? <>{reviewBlock}{queueBlock}</> : <>{queueBlock}{reviewBlock}</>}
    </div>
  )
}

export default function QlsxFloorPage() {
  const [tab, setTab] = useState<Tab>('output')
  // P1 (19/11): bấm tin "đợt chờ KCS quá 4 giờ" của tổ Hàn / Sơn -> mở đúng tab tổ đó (focus FLOOR_STAGE:<tổ>:<xưởng>).
  const focusStage = qlsxStageFromFocus(useUrlParamValue('focus'))
  // Nhớ tổ đang xem (localStorage chỉ là tiện ích, bọc try/catch).
  const [stage, setStageState] = useState<FloorStage>(() => {
    if (focusStage) return focusStage
    try {
      const v = localStorage.getItem(LAST_STAGE_KEY)
      return v === 'HAN' || v === 'SON' ? v : 'PHOI'
    } catch { return 'PHOI' }
  })
  const queueWorkshop = useQueueWorkshop()
  const summary = useFetch<BeFloorSummary>(() => floorAdmin.summary(), [])
  const { refetch: refetchSummary } = summary
  const refreshSummary = useCallback(() => { void refetchSummary() }, [refetchSummary])
  useRealtimeRefetch(TOPICS, refreshSummary)
  // Hỏi lại số đếm mỗi 5 phút khi đang xem tab này (bỏ qua lúc tab trình duyệt ẩn): pill "M quá 4 giờ" tự tăng khi
  // không có sự kiện nào (AC16 / AC17). Sự kiện thật (qc-reviews, floor...) vẫn tải lại ngay như trên.
  useEffect(() => (tab === 'output' ? startPolling(refreshSummary) : undefined), [tab, refreshSummary])

  const setStage = (s: FloorStage) => {
    setStageState(s)
    try { localStorage.setItem(LAST_STAGE_KEY, s) } catch { /* bỏ qua */ }
  }
  // Đang mở sẵn màn này mà bấm tin của tổ khác: đổi tab theo focus mới (chỉ khi focus đổi).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (focusStage) { setTab('output'); setStageState(focusStage) }
  }, [focusStage])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'output', label: 'Sản lượng & hàng đợi' },
    { id: 'cut', label: 'Chia máy cắt' },
    { id: 'stats', label: 'Báo cáo' },
    { id: 'machines', label: 'Máy & tem QR' },
    { id: 'workers', label: 'Công nhân' },
  ]

  return (
    <div style={{ padding: 'clamp(12px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sản lượng xưởng</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          Công nhân quét mã tại máy và tự báo số, KCS tự chấm; bạn theo dõi, hủy lần báo sai (trước khi KCS chấm) và xếp lệnh cho từng tổ.
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
              // N đang mở · K KCS đang chấm · M quá 4 giờ (chỉ phần khác 0); đỏ khi có đợt quá 4 giờ.
              const pill = summaryPillText(summary.data?.[s])
              const on = stage === s
              return (
                <button key={s} role="tab" aria-selected={on} type="button" onClick={() => setStage(s)} style={{
                  minHeight: 40, padding: '0 16px', borderRadius: 999, fontSize: 14, fontWeight: on ? 700 : 500,
                  border: `1px solid ${on ? 'var(--blue)' : 'var(--border2)'}`,
                  background: on ? 'var(--blue-bg)' : 'var(--surface)', color: on ? 'var(--blue-text)' : 'var(--text)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%',
                }}>
                  Tổ {STAGE_LABEL[s]} {pill && <Pill tone={(summary.data?.[s].stale ?? 0) > 0 ? 'red' : 'amber'}>{pill}</Pill>}
                </button>
              )
            })}
          </div>
          <StageView key={stage} stage={stage} refreshSummary={refreshSummary} ws={queueWorkshop} />
        </>
      )}
      {tab === 'cut' && <QlsxCutAllocation />}
      {tab === 'stats' && (
        <>
          <QlsxStats />
          <QlsxCutMachineStats />
        </>
      )}
      {tab === 'machines' && <QlsxSetup section="machines" />}
      {tab === 'workers' && <QlsxSetup section="workers" />}
    </div>
  )
}

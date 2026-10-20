'use client'

/**
 * Ngăn "còn thiếu gì" mở từ thẻ PI của tổ ở "Sản lượng xưởng" (2026-10-19, changelog BE 10-08 mục 45.4/48): QLSX trả lời
 * "PI này còn thiếu đúng cái gì, có bất thường không, chuyển PI tiếp được chưa" mà không phải sang "Tổng hợp lệnh SX".
 * Số lấy từ GET /floor/queue/:stage/detail/:piId (cùng nguồn BE dùng cho thẻ) + progressModel → khớp thẻ và Tổng hợp.
 * Hé lộ dần: tổng (thanh 3 ngăn) → tab "Còn thiếu" (mặc định) → "Tất cả" (bảng đầy đủ dùng lại bảng của Tổng hợp)
 * → "Bất thường". Ngăn phải ~720px, < 900px thì toàn màn hình; Esc đóng, giữ focus trong ngăn, đóng thì trả focus.
 */

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { floorAdmin, type BeFloorReview, type BeStageDetail, type FloorStage } from '../../../services/floor-api'
import { useFetch } from '../../../hooks/useFetch'
import { useIsCompact } from '../../../hooks/useMediaQuery'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { PhoiMaterialBoard } from '../../../components/sanxuat/PhoiMaterialBoard'
import { HAN_CFG, SON_CFG, VAT_TU_TP_CFG, VatTuDetailBoard, type ProcLine } from '../../../components/sanxuat/core'
import {
  abnormalities, phoiMaterialsOf, piecesOf, shortMaterials, shortPieces, summarize,
  type Abnormal, type OrderFilter, type PieceView, type ShortMaterial,
} from './piDetailModel'
import { btn, Notice, Pill, STAGE_LABEL, StackedProgress } from './qlsxUi'

const TOPICS = ['floor', 'steel-issues', 'production-batches', 'qc-reviews'] as const
type DetailTab = 'short' | 'all' | 'abnormal'

const fmt = (n: number) => n.toLocaleString('vi-VN')

export default function QlsxPiDetail({ stage, productionInvoiceId, piCode, review, initialTab = 'short', onClose, onGoToReview }: {
  stage: FloorStage
  productionInvoiceId: string
  piCode: string
  /** Danh sách "Chờ gửi KCS" của tổ - để đếm đợt chờ quá lâu của PI này (null = chưa tải). */
  review: BeFloorReview | null
  initialTab?: DetailTab
  onClose: () => void
  /** Đóng ngăn và cuộn tới danh sách "Chờ gửi KCS". */
  onGoToReview: () => void
}) {
  const compact = useIsCompact()
  const { data, error, refetch } = useFetch<BeStageDetail>(() => floorAdmin.stageDetail(stage, productionInvoiceId), [stage, productionInvoiceId])
  useRealtimeRefetch(TOPICS, refetch)
  const [tab, setTab] = useState<DetailTab>(initialTab)
  const [orderId, setOrderId] = useState<OrderFilter>(null)

  // Focus: vào ngăn thì focus nút đóng, đóng thì trả về nút đã mở ngăn; Tab không thoát ra ngoài ngăn.
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus?.()
  }, [])
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'Tab' || !panelRef.current) return
    const f = [...panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select, [href], input, [tabindex]:not([tabindex="-1"])')]
    if (f.length === 0) return
    const first = f[0], last = f[f.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  const view = useMemo(() => {
    if (!data) return null
    const materials = phoiMaterialsOf(data, orderId)
    const pieces = piecesOf(data, orderId)
    return {
      materials, pieces,
      total: summarize(materials, pieces),
      shortM: shortMaterials(materials),
      shortP: shortPieces(pieces),
      abnormal: abnormalities(materials, pieces, review, productionInvoiceId, stage),
      steps: stepSummary(materials, pieces),
    }
  }, [data, orderId, review, productionInvoiceId, stage])

  const titleId = `pi-detail-${stage}-${productionInvoiceId}`
  const orders = data?.orders ?? []
  const shortCount = view ? view.shortM.length + view.shortP.length : 0

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 2500, display: 'flex', justifyContent: 'flex-end' }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} onClick={(e) => e.stopPropagation()}
        style={{
          width: compact ? '100vw' : 'min(760px, 92vw)', height: '100%', background: 'var(--bg)', color: 'var(--text)',
          display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,.18)',
        }}>
        <header style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 id={titleId} style={{ fontSize: 18, fontWeight: 700 }}>{piCode} · tổ {STAGE_LABEL[stage]}</h2>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {orders.length === 1 ? `${orders[0].productName} · ${orders[0].poNumber}` : orders.length > 1 ? `${orders.length} SKU` : ''}
            </div>
          </div>
          {orders.length > 1 && (
            <select aria-label="Xem theo SKU" value={orderId ?? ''} onChange={(e) => setOrderId(e.target.value || null)}
              style={{ padding: '6px 8px', fontSize: 13, border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', maxWidth: 220 }}>
              <option value="">Cả PI</option>
              {orders.map((o) => <option key={o.productionOrderId} value={o.productionOrderId}>{o.productName} · {o.poNumber}</option>)}
            </select>
          )}
          <button ref={closeRef} type="button" aria-label="Đóng" onClick={onClose} style={btn('ghost')}><X size={20} /></button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {!data && !error && <LoadingState />}
          {error && !data && <LoadErrorState error={error} onRetry={refetch} />}
          {view && (
            <>
              <section aria-label="Tổng" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                <StackedProgress parts={view.total} percent={view.total.percent} />
                {view.steps.length > 1 && (
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 6 }}>
                    {view.steps.map((s) => `${s.label} ${s.percent}%`).join(' · ')}
                  </div>
                )}
                {orderId !== null && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Đang xem riêng 1 SKU - % của thẻ PI là của cả PI.</div>}
              </section>

              <div role="tablist" aria-label="Xem" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  ['short', `Còn thiếu${shortCount ? ` (${shortCount})` : ''}`],
                  ['all', 'Tất cả'],
                  ['abnormal', `Bất thường${view.abnormal.length ? ` (${view.abnormal.length})` : ''}`],
                ] as const).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                    style={{
                      minHeight: 34, padding: '0 14px', borderRadius: 999, fontSize: 13, fontWeight: tab === id ? 700 : 500, cursor: 'pointer',
                      border: `1px solid ${tab === id ? 'var(--blue)' : 'var(--border2)'}`,
                      background: tab === id ? 'var(--blue-bg)' : 'var(--surface)', color: tab === id ? 'var(--blue-text)' : 'var(--text)',
                    }}>
                    {label}
                  </button>
                ))}
              </div>

              <div role="tabpanel">
                {tab === 'short' && <ShortList materials={view.shortM} pieces={view.shortP} stage={stage} />}
                {tab === 'all' && <AllBoards stage={stage} materials={view.materials} pieces={view.pieces} />}
                {tab === 'abnormal' && <AbnormalList items={view.abnormal} onGoToReview={onGoToReview} onShowAll={() => setTab('all')} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/** % theo công đoạn (Cắt/Uốn/… và Mảnh) của SKU đang chọn - cùng công thức tổng. */
function stepSummary(materials: ReturnType<typeof phoiMaterialsOf>, pieces: PieceView[]) {
  const acc = new Map<string, { need: number; done: number }>()
  for (const m of materials) for (const st of m.steps) {
    const a = acc.get(st.label) ?? { need: 0, done: 0 }
    a.need += st.need; a.done += st.done; acc.set(st.label, a)
  }
  if (pieces.length) acc.set('Mảnh', { need: pieces.reduce((a, p) => a + p.required, 0), done: pieces.reduce((a, p) => a + p.reported, 0) })
  return [...acc.entries()].map(([label, a]) => ({
    label,
    percent: a.need > 0 ? Math.min(100, Math.max(a.done > 0 ? 1 : 0, Math.floor((Math.min(a.done, a.need) / a.need) * 100))) : 0,
  }))
}

const SEG_PREVIEW = 6

function ShortList({ materials, pieces, stage }: { materials: ShortMaterial[]; pieces: PieceView[]; stage: FloorStage }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  if (materials.length === 0 && pieces.length === 0) {
    return <Notice tone="ok">Không còn thiếu gì - tổ {STAGE_LABEL[stage]} đã báo đủ số cần (đã trừ số KCS chấm lỗi).</Notice>
  }
  const unit = stage === 'PHOI' ? 'đoạn' : 'cái'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {materials.map((m) => {
        const open = expanded.has(m.materialId)
        const segs = open ? m.segments : m.segments.slice(0, SEG_PREVIEW)
        return (
          <div key={m.materialId} style={{ background: 'var(--surface)', border: `1px solid ${m.notReceived ? 'var(--amber)' : 'var(--border)'}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14 }}>{m.name}</b>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{m.code}</span>
              {m.notReceived && <Pill tone="amber">Chưa nhận sắt</Pill>}
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>thiếu {fmt(m.remaining)} đoạn</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>
              {m.steps.map((s) => `${s.label} ${fmt(s.done)}/${fmt(s.need)}`).join(' · ')}
            </div>
            <ul style={{ listStyle: 'none', marginTop: 6, display: 'grid', gap: 2 }}>
              {segs.map((s) => (
                <li key={`${s.step}-${s.cutLengthMm}`} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span style={{ width: 70, color: 'var(--text2)' }}>{fmt(s.cutLengthMm)} mm</span>
                  <span style={{ flex: 1 }}>{s.label} {fmt(s.good)}/{fmt(s.required)}</span>
                  <span style={{ color: 'var(--amber)', fontWeight: 600 }}>
                    thiếu {fmt(s.remaining)}{s.failed > 0 ? ` (KCS lỗi ${fmt(s.failed)})` : ''}
                  </span>
                </li>
              ))}
            </ul>
            {m.segments.length > SEG_PREVIEW && (
              <button type="button" onClick={() => setExpanded((x) => { const n = new Set(x); if (open) n.delete(m.materialId); else n.add(m.materialId); return n })}
                style={{ ...btn('ghost'), padding: 0, fontSize: 12, marginTop: 4 }}>
                {open ? 'Thu gọn' : `… và ${m.segments.length - SEG_PREVIEW} dòng khác`}
              </button>
            )}
          </div>
        )
      })}
      {pieces.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
          <b style={{ fontSize: 14 }}>{stage === 'PHOI' ? 'Mảnh Phôi / vật tư thành phẩm' : 'Mảnh'}</b>
          <ul style={{ listStyle: 'none', marginTop: 6, display: 'grid', gap: 4 }}>
            {pieces.map((p) => (
              <li key={p.key} style={{ display: 'flex', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 140 }}>{p.name} <span style={{ fontSize: 11, color: 'var(--text3)' }}>{p.code}</span></span>
                <span>{fmt(p.reported)}/{fmt(p.required)}</span>
                {p.awaiting > 0 && <span style={{ color: 'var(--text2)' }}>chờ KCS {fmt(p.awaiting)}</span>}
                {p.open > 0 && <span style={{ color: 'var(--text2)' }}>chưa gửi {fmt(p.open)}</span>}
                <span style={{ color: 'var(--amber)', fontWeight: 600 }}>thiếu {fmt(p.remaining)} {unit}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function pieceProcLines(pieces: PieceView[]): ProcLine[] {
  return pieces.map((p, i) => ({
    id: i + 1, itemName: p.name, spec: p.code, needQty: p.required, doneQty: p.reported,
    kcs: { awaiting: p.awaiting, open: p.open }, lastInputAt: null,
  }))
}

function AllBoards({ stage, materials, pieces }: { stage: FloorStage; materials: ReturnType<typeof phoiMaterialsOf>; pieces: PieceView[] }) {
  if (stage !== 'PHOI') {
    const cfg = stage === 'HAN' ? HAN_CFG : SON_CFG
    return (
      <VatTuDetailBoard lines={pieceProcLines(pieces)} cfg={cfg} readOnly showThucCo={false} fullHeight
        title={stage === 'HAN' ? 'Chi tiết hàn khung' : 'Chi tiết sơn'} subtitle="Cùng bảng với “Tổng hợp lệnh SX” — chỉ xem" bannerLabel="Đồng bộ" />
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {materials.length > 0 && <PhoiMaterialBoard materials={materials} />}
      {pieces.length > 0 && (
        <VatTuDetailBoard lines={pieceProcLines(pieces)} cfg={VAT_TU_TP_CFG} readOnly showThucCo={false} showSpec={false} fullHeight
          title="Mảnh Phôi / vật tư thành phẩm" subtitle="Phôi tự báo theo mảnh — chỉ xem" bannerLabel="Đồng bộ" />
      )}
      {materials.length === 0 && pieces.length === 0 && <Notice tone="info">PI này chưa có định mức nào cho tổ Phôi.</Notice>}
    </div>
  )
}

function AbnormalList({ items, onGoToReview, onShowAll }: { items: Abnormal[]; onGoToReview: () => void; onShowAll: () => void }) {
  if (items.length === 0) return <Notice tone="ok"><CheckCircle2 size={14} style={{ verticalAlign: -2 }} /> Không có bất thường.</Notice>
  return (
    <ul style={{ listStyle: 'none', display: 'grid', gap: 8 }}>
      {items.map((a) => (
        <li key={a.kind + a.text} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--amber-bg)', color: 'var(--amber)', borderRadius: 8, padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>
          <AlertTriangle size={16} aria-hidden />
          <span style={{ flex: 1, minWidth: 180 }}>{a.text}</span>
          {(a.kind === 'steel-over' || a.kind === 'stale')
            ? <button type="button" onClick={onGoToReview} style={btn('secondary')}>Đến danh sách chờ gửi KCS</button>
            : <button type="button" onClick={onShowAll} style={btn('secondary')}>Xem bảng đầy đủ</button>}
        </li>
      ))}
    </ul>
  )
}

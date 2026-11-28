'use client'

/**
 * Giao nhận giữa tổ (24/11/2026, docs THIET-KE-GIAO-NHAN-GIUA-TO mục 2.1 / 2.2) - 2 tab con của "Phân phối nội bộ":
 *  - kind SEGMENT: kho Phôi "Giao đoạn cho Hàn" - theo mã đoạn của lệnh (mảnh không qua Hàn thì đoạn giao cho Sơn).
 *  - kind FRAME:   kho Hàn (xưởng có kho Sơn) "Giao khung cho Sơn" - theo mảnh đã hàn của lệnh.
 * Chọn lệnh ở hàng chip -> nhập "Giao lần này" -> "Thêm vào phiếu" (giỏ "Phiếu đang lập") -> tab "Phiếu xuất" tạo phiếu, in, công
 * nhân tổ nhận ký, tải ảnh, "Xác nhận xuất" (lúc đó mới chuyển tồn). BE kiểm lại trần lúc lập và lúc xác nhận.
 */
import { useMemo, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  getFramePlan, getSegmentPlan,
  type FramePlanRow, type HandoverKind, type HandoverPlanDetail, type HandoverPlanList, type SegmentPlanRow,
} from '../../../services/stage-handover-api'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { useIssueSlipCart } from './IssueSlipCart'
import OpeningWaitingSection from './OpeningWaitingSection'
import {
  HANDOVER_STAGE_LABEL, buildFrameCartLine, buildSegmentCartLine, effectiveQty, frameDefaults, frameRowKey, frameRowMax,
  handoverCartKey, parseQty, qtyDigits, qtyError, segmentCartConflict, segmentDefaults, segmentHandoverRows, segmentRowMax,
  type HandoverCartLine,
} from './handoverModel'

const ACCENT = 'var(--fg-4527a0)'
const ACCENT_BG = 'var(--bg-ede7f6)'
const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '9px 14px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const numInput = (bad: boolean): React.CSSProperties => ({
  width: 80, padding: '4px 8px', border: `1px solid ${bad ? 'var(--fg-dc2626)' : 'var(--border)'}`, borderRadius: 6, fontSize: 13,
  textAlign: 'right', background: 'var(--surface)', color: 'var(--text)',
})
const fmt = (n: number) => n.toLocaleString('vi-VN')

const TEXT: Record<HandoverKind, { desc: string; unit: 'đoạn' | 'mảnh'; empty: string }> = {
  SEGMENT: {
    desc: 'Công nhân Hàn qua kho lấy đoạn: chọn lệnh, nhập số giao theo từng mã đoạn, bấm “Thêm vào phiếu” → tab “Phiếu xuất” tạo phiếu, in, công nhân Hàn ký, tải ảnh, xác nhận xuất. Mảnh không qua Hàn thì đoạn giao cho Sơn.',
    unit: 'đoạn',
    empty: 'Kho chưa có lệnh nào có đoạn Phôi đạt KCS để giao.',
  },
  FRAME: {
    desc: 'Công nhân Sơn qua kho lấy mảnh đã hàn: chọn lệnh, nhập số giao theo từng mảnh, bấm “Thêm vào phiếu” → tab “Phiếu xuất” tạo phiếu, in, công nhân Sơn ký, tải ảnh, xác nhận xuất.',
    unit: 'mảnh',
    empty: 'Kho chưa có lệnh nào có mảnh Hàn đạt KCS để giao cho Sơn.',
  },
}

export default function GiaoNhanToPage({ kind, list, refetchList }: {
  kind: HandoverKind
  list: HandoverPlanList
  refetchList: () => void
}) {
  const [piId, setPiId] = useState<string | null>(null)
  // Phiếu tạo / xác nhận, KCS chấm làm đổi số ở kho: tải lại danh sách lệnh (chip).
  useRealtimeRefetch(['issue-slips', 'stock', 'qc-reviews'], refetchList)
  const text = TEXT[kind]
  const pi = list.pis.find(p => p.productionInvoiceId === piId) ?? null

  return (
    <div>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '0 0 12px' }}>{text.desc}</div>
      {/* Đầu kỳ ngày bật (28/11/2026): khung Hàn đạt trước ngày bật đang chờ ở tổ Sơn - BE tự ẩn khi không áp dụng. */}
      {kind === 'FRAME' && <OpeningWaitingSection />}
      {list.pis.length === 0 ? (
        <div style={{ ...card, padding: 16, fontSize: 13, color: 'var(--text3)' }}>{text.empty}</div>
      ) : (
        <div role="group" aria-label="Chọn lệnh" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {list.pis.map(p => {
            const on = p.productionInvoiceId === piId
            return (
              <button key={p.productionInvoiceId} type="button" aria-pressed={on} onClick={() => setPiId(on ? null : p.productionInvoiceId)}
                title={`Còn ở kho ${fmt(p.inStockQty)} ${text.unit} · giao được ${fmt(p.availableQty)}${p.draftQty > 0 ? ` · chờ ký ${fmt(p.draftQty)}` : ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, borderRadius: 20,
                  border: '1px solid', borderColor: on ? ACCENT : 'var(--border)', background: on ? ACCENT_BG : 'var(--surface)',
                  color: on ? ACCENT : 'var(--text2)', cursor: 'pointer',
                }}>
                <span style={{ fontFamily: 'monospace' }}>{p.lenhCode}</span>
                <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{fmt(p.inStockQty)} {text.unit}</span>
              </button>
            )
          })}
        </div>
      )}
      {pi && (kind === 'SEGMENT'
        ? <SegmentDetail key={pi.productionInvoiceId} piId={pi.productionInvoiceId} />
        : <FrameDetail key={pi.productionInvoiceId} piId={pi.productionInvoiceId} />)}
      {!pi && list.pis.length > 0 && <div style={{ fontSize: 13, color: 'var(--text3)' }}>Chọn lệnh ở trên để xem số giao.</div>}
    </div>
  )
}

function usePlan<R>(fetcher: (id: string) => Promise<HandoverPlanDetail<R>>, piId: string) {
  const res = useFetch(() => fetcher(piId), [piId])
  useRealtimeRefetch(['issue-slips', 'stock', 'qc-reviews'], () => { res.refetch() })
  return res
}

/** Thêm các dòng có số vào giỏ; trả câu báo (xanh khi thêm được, đỏ khi lỗi). */
function useAddToCart() {
  const cart = useIssueSlipCart()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const add = (lines: HandoverCartLine[]) => {
    for (const l of lines) {
      const conflict = segmentCartConflict(cart.lines, l)
      if (conflict) { setMsg({ ok: false, text: `${l.materialName}: ${conflict}` }); return }
    }
    for (const l of lines) cart.add(l)
    setMsg({ ok: true, text: `Đã thêm ${lines.length} dòng vào phiếu đang lập - sang tab “Phiếu xuất” để tạo phiếu.` })
  }
  const inCart = (l: Parameters<typeof handoverCartKey>[0]) => {
    const key = handoverCartKey(l)
    return cart.lines.find(c => c.key === key) ?? null
  }
  return { add, msg, setMsg, inCart }
}

function AddBar({ count, blocked, onAdd, msg }: { count: number; blocked: boolean; onAdd: () => void; msg: { ok: boolean; text: string } | null }) {
  const enabled = count > 0 && !blocked
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
      {msg && <span role={msg.ok ? 'status' : 'alert'} style={{ fontSize: 12, color: msg.ok ? 'var(--fg-16a34a)' : 'var(--fg-dc2626)' }}>{msg.text}</span>}
      {!msg && blocked && <span style={{ fontSize: 12, color: 'var(--fg-dc2626)' }}>Sửa các ô báo đỏ trước khi thêm vào phiếu.</span>}
      <div style={{ flex: 1 }} />
      <button type="button" onClick={onAdd} disabled={!enabled}
        style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, whiteSpace: 'nowrap',
          background: enabled ? ACCENT : 'var(--surface2)', color: enabled ? '#fff' : 'var(--text3)', cursor: enabled ? 'pointer' : 'not-allowed' }}>
        Thêm vào phiếu{count > 0 ? ` (${count} dòng)` : ''}
      </button>
    </div>
  )
}

function QtyCell({ label, value, max, unit, onChange, inCartQty }: {
  label: string; value: string; max: number; unit: 'đoạn' | 'mảnh'; onChange: (v: string) => void; inCartQty: number | null
}) {
  const err = qtyError(parseQty(value), max, unit)
  return (
    <td style={{ ...td, textAlign: 'right' }}>
      <input aria-label={label} aria-invalid={!!err} inputMode="numeric" value={value} placeholder="0"
        onChange={e => onChange(qtyDigits(e.target.value))} style={numInput(!!err)} />
      {err && <div role="alert" style={{ marginTop: 4, fontSize: 11, color: 'var(--fg-dc2626)' }}>{err}</div>}
      {!err && inCartQty != null && <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)' }}>Trên phiếu đang lập: {fmt(inCartQty)}</div>}
    </td>
  )
}

function SegmentDetail({ piId }: { piId: string }) {
  const { data, isLoading, error, refetch } = usePlan<SegmentPlanRow>(getSegmentPlan, piId)
  const rows = useMemo(() => segmentHandoverRows(data?.rows ?? []), [data])
  const defaults = useMemo(() => segmentDefaults(rows), [rows])
  const [qty, setQty] = useState<Record<string, string>>({})
  const { add, msg, setMsg, inCart } = useAddToCart()

  if (isLoading) return <LoadingState />
  if (error || !data) return <LoadErrorState error={error ?? 'Không có dữ liệu'} onRetry={refetch} />
  if (rows.length === 0) return <div style={{ ...card, padding: 16, fontSize: 13, color: 'var(--text3)' }}>Lệnh này không có mã đoạn nào để giao.</div>

  const eff = effectiveQty(qty, defaults)
  const allHan = rows.every(r => r.stage === 'HAN')
  const chosen = rows.filter(r => parseQty(eff[r.key]) > 0)
  const blocked = rows.some(r => qtyError(parseQty(eff[r.key]), segmentRowMax(r, rows, eff), 'đoạn') != null)
  const pi = { productionInvoiceId: data.productionInvoiceId, lenhCode: data.lenhCode }

  return (
    <div style={card}>
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
        Lệnh <b style={{ fontFamily: 'monospace' }}>{data.lenhCode}</b> · kho {data.warehouse.name}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead>
            <tr>
              <th style={th}>Mã đoạn</th>
              {!allHan && <th style={th}>Giao cho</th>}
              <th style={thR}>{allHan ? 'Hàn cần' : 'Tổ cần'}</th>
              <th style={thR}>Đạt KCS</th>
              <th style={thR}>Đã giao</th>
              <th style={thR}>Còn ở kho</th>
              <th style={{ ...thR, width: 150 }}>Giao lần này</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const line = buildSegmentCartLine(pi, r, 0)
              return (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.row.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Cắt {fmt(r.row.cutLengthMm)} mm · {r.row.stepsLabel}</div>
                  </td>
                  {!allHan && <td style={td}><StageBadge stage={r.stage} /></td>}
                  <td style={tdR}>{fmt(r.requiredQty)}</td>
                  <td style={tdR}>{fmt(r.row.passedQty)}</td>
                  <td style={tdR}>
                    {fmt(r.handedOverQty)}
                    {r.draftQty > 0 && <div style={{ fontSize: 11, color: 'var(--fg-e65100)' }}>chờ ký {fmt(r.draftQty)}</div>}
                  </td>
                  <td style={{ ...tdR, fontWeight: 700 }}>
                    {fmt(r.row.inStockQty)}
                    {r.row.availableQty !== r.row.inStockQty && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>giao được {fmt(r.row.availableQty)}</div>}
                  </td>
                  <QtyCell label={`Giao lần này ${r.row.label} cho ${HANDOVER_STAGE_LABEL[r.stage]}`} unit="đoạn"
                    value={eff[r.key] ?? ''} max={segmentRowMax(r, rows, eff)}
                    inCartQty={(() => { const c = inCart(line); return c && c.stage === r.stage ? c.qty : null })()}
                    onChange={v => { setMsg(null); setQty(q => ({ ...q, [r.key]: v })) }} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <AddBar count={chosen.length} blocked={blocked} msg={msg}
        onAdd={() => add(chosen.map(r => buildSegmentCartLine(pi, r, parseQty(eff[r.key]))))} />
    </div>
  )
}

function FrameDetail({ piId }: { piId: string }) {
  const { data, isLoading, error, refetch } = usePlan<FramePlanRow>(getFramePlan, piId)
  const rows = useMemo(() => data?.rows ?? [], [data])
  const defaults = useMemo(() => frameDefaults(rows), [rows])
  const [qty, setQty] = useState<Record<string, string>>({})
  const { add, msg, setMsg, inCart } = useAddToCart()

  if (isLoading) return <LoadingState />
  if (error || !data) return <LoadErrorState error={error ?? 'Không có dữ liệu'} onRetry={refetch} />
  if (rows.length === 0) return <div style={{ ...card, padding: 16, fontSize: 13, color: 'var(--text3)' }}>Lệnh này không có mảnh nào qua cả Hàn và Sơn.</div>

  const eff = effectiveQty(qty, defaults)
  const chosen = rows.filter(r => parseQty(eff[frameRowKey(r)]) > 0)
  const blocked = rows.some(r => qtyError(parseQty(eff[frameRowKey(r)]), frameRowMax(r, rows, eff), 'mảnh') != null)
  const showSku = new Set(rows.map(r => r.productionOrderId)).size > 1

  return (
    <div style={card}>
      <div style={{ padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
        Lệnh <b style={{ fontFamily: 'monospace' }}>{data.lenhCode}</b> · kho {data.warehouse.name}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Mảnh</th>
              <th style={thR}>Sơn cần</th>
              <th style={thR}>Hàn đạt</th>
              <th style={thR}>Đã giao</th>
              <th style={thR}>Còn ở kho</th>
              <th style={{ ...thR, width: 150 }}>Giao lần này</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const k = frameRowKey(r)
              const c = inCart(buildFrameCartLine(data, r, 0))
              return (
                <tr key={k} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{r.pieceName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{r.pieceCode}{showSku && r.sku ? ` · SKU ${r.sku}` : ''}</div>
                  </td>
                  <td style={tdR}>{fmt(r.requiredQty)}</td>
                  <td style={tdR}>{fmt(r.passedQty)}</td>
                  <td style={tdR}>
                    {fmt(r.handedOverQty)}
                    {r.draftQty > 0 && <div style={{ fontSize: 11, color: 'var(--fg-e65100)' }}>chờ ký {fmt(r.draftQty)}</div>}
                  </td>
                  <td style={{ ...tdR, fontWeight: 700 }}>
                    {fmt(r.inStockQty)}
                    {r.availableQty !== r.inStockQty && <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>giao được {fmt(r.availableQty)}</div>}
                  </td>
                  <QtyCell label={`Giao lần này ${r.pieceName}`} unit="mảnh" value={eff[k] ?? ''} max={frameRowMax(r, rows, eff)}
                    inCartQty={c ? c.qty : null}
                    onChange={v => { setMsg(null); setQty(q => ({ ...q, [k]: v })) }} />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 14px 0', fontSize: 11, color: 'var(--text3)' }}>“Còn ở kho” là tồn mảnh ở kho Hàn, tính chung mọi lệnh cùng mảnh.</div>
      <AddBar count={chosen.length} blocked={blocked} msg={msg}
        onAdd={() => add(chosen.map(r => buildFrameCartLine(data, r, parseQty(eff[frameRowKey(r)]))))} />
    </div>
  )
}

function StageBadge({ stage }: { stage: 'HAN' | 'SON' }) {
  const son = stage === 'SON'
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: son ? 'var(--bg-fffbeb)' : ACCENT_BG, color: son ? 'var(--fg-e65100)' : ACCENT }}>
      {HANDOVER_STAGE_LABEL[stage]}
    </span>
  )
}

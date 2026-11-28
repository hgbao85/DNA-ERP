'use client'

/**
 * Tab "Giao nhận giữa tổ" của Sản lượng xưởng (QLSX, 24/11/2026 - docs THIET-KE-GIAO-NHAN-GIUA-TO 3.3b / 3.4). Chỉ hiện khi BE bật
 * công tắc (board.enabled). Bảng theo lệnh + chặng: đoạn Phôi đạt KCS còn ở kho chờ giao, đã giao chưa làm, có bị chặn không.
 * Bấm lệnh: chi tiết từng mảnh (đã nhận / đã làm / còn / mở chặn / còn báo được) + cân bằng sắt Phôi (chặn ở 102%), nút "Mở chặn"
 * (lý do bắt buộc, BE ghi nhật ký và báo Sếp). Link thông báo STAGE_HANDOVER_OVERRIDE mở thẳng lệnh (focus=PI_CODE:<mã>).
 */
import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useUrlParamValue } from '../../../hooks/useUrlState'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import {
  createHandoverOpeningDone, createHandoverOverride, getHandoverBoardDetail, getHandoverOpening,
  type BoardStage, type HandoverBoardDetail, type HandoverBoardList, type HandoverOverrideKind,
} from '../../../services/stage-handover-api'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import Modal from '../../../components/Modal'
import { backBtn } from '../../../styles/buttons'
import { errMsg } from '../../../utils/errors'
import { focusAttr } from '../../../utils/notificationLink'
import {
  OVERRIDE_NOTE, OVERRIDE_STAGE_LABEL, boardSummaryRows, canOverridePiece, overrideTargetText, overrideUnit, overrideValid,
  parseOverrideQty, piCodeFromFocus, pieceOverrideRoom, pieceStatus, sortBoardPis, steelPercent, steelStatus, validateOverride,
  type BoardStatus, type OverrideTarget,
} from './handoverBoardModel'

const th: React.CSSProperties = { padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }
const cardHead: React.CSSProperties = { padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)', fontSize: 14, fontWeight: 700 }
const smallBtn: React.CSSProperties = { padding: '4px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', whiteSpace: 'nowrap' }
const fmt = (n: number) => n.toLocaleString('vi-VN')
const dash = <span style={{ color: 'var(--text3)' }}>—</span>

function StatusBadge({ status }: { status: BoardStatus }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      background: status.blocked ? 'var(--red-bg)' : 'var(--green-bg)', color: status.blocked ? 'var(--red)' : 'var(--green)',
    }}>{status.text}</span>
  )
}

export default function QlsxHandoverBoard({ list, refetchList }: { list: HandoverBoardList; refetchList: () => void }) {
  // Link thông báo: ?focus=PI_CODE:<mã PI> - nhớ lúc mở màn (NotificationFocus xoá focus khỏi URL sau khi nháy dòng).
  const focus = useUrlParamValue('focus')
  const [focusCode] = useState(() => piCodeFromFocus(focus))
  const [piId, setPiId] = useState<string | null>(() => list.pis.find((p) => p.code === focusCode)?.productionInvoiceId ?? null)
  useRealtimeRefetch(['issue-slips', 'production-batches', 'qc-reviews', 'steel-issues'], refetchList)

  if (piId) return <BoardDetail piId={piId} onBack={() => { setPiId(null); refetchList() }} />

  const rows = boardSummaryRows(sortBoardPis(list.pis))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <OpeningCard onDone={refetchList} />
      <div style={{ fontSize: 13, color: 'var(--text2)' }}>
        Hàn / Sơn chỉ báo trong số hàng đã nhận qua phiếu giao của kho; Phôi báo cắt không vượt 102% sắt đã nhận. Bấm lệnh để xem từng mảnh và mở chặn.
      </div>
      <div style={{ ...card, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={th}>Lệnh</th>
              <th style={th}>Chặng</th>
              <th style={thR}>Ở kho chờ giao</th>
              <th style={thR}>Đã giao chưa làm</th>
              <th style={th}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} onClick={() => setPiId(r.pi.productionInvoiceId)} {...(r.first ? focusAttr('PI_CODE', r.pi.code) : {})}
                style={{ borderTop: r.first ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}>
                {r.first && (
                  <td rowSpan={2} style={{ ...td, fontFamily: 'monospace', fontWeight: 700, verticalAlign: 'top' }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPiId(r.pi.productionInvoiceId) }}
                      style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--blue-text)', textDecoration: 'underline', cursor: 'pointer' }}>
                      {r.pi.lenhCode}
                    </button>
                  </td>
                )}
                <td style={td}>{r.chang}</td>
                <td style={tdR}>{r.awaitingQty == null ? dash : `${fmt(r.awaitingQty)} đoạn`}</td>
                <td style={tdR}>{r.handedNotUsedQty == null ? dash : `${fmt(r.handedNotUsedQty)} đoạn`}</td>
                <td style={td}><StatusBadge status={r.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 28, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Không có lệnh nào đang chạy.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BoardDetail({ piId, onBack }: { piId: string; onBack: () => void }) {
  const { data, isLoading, error, refetch } = useFetch(() => getHandoverBoardDetail(piId), [piId])
  useRealtimeRefetch(['issue-slips', 'production-batches', 'qc-reviews', 'steel-issues'], refetch)
  const [target, setTarget] = useState<OverrideTarget | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" onClick={onBack} style={backBtn}><ChevronLeft size={15} /> Quay lại</button>
        {data && <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Lệnh <span style={{ fontFamily: 'monospace' }}>{data.lenhCode}</span></h2>}
      </div>
      {isLoading ? <LoadingState /> : error || !data ? <LoadErrorState error={error ?? 'Không có dữ liệu'} onRetry={refetch} /> : (
        <>
          <PhoiSection data={data} onOverride={setTarget} />
          {data.stages.map((s) => <StageSection key={s.stage} stage={s} onOverride={setTarget} />)}
          <OverridesSection data={data} />
        </>
      )}
      {target && data && (
        <OverrideDialog target={target} productionInvoiceId={data.productionInvoiceId}
          onClose={() => setTarget(null)} onDone={() => { setTarget(null); refetch() }} />
      )}
    </div>
  )
}

function PhoiSection({ data, onOverride }: { data: HandoverBoardDetail; onOverride: (t: OverrideTarget) => void }) {
  const { segments, steel } = data.phoi
  return (
    <div style={card}>
      <div style={cardHead}>Phôi <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12 }}>· kho {data.phoi.warehouseCode}</span></div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Loại sắt</th><th style={thR}>Cây đã nhận</th><th style={thR}>Dùng được (mm)</th><th style={thR}>Đoạn đã báo (mm)</th>
              <th style={thR}>Đã dùng</th><th style={thR}>Mở chặn (mm)</th><th style={thR}>Giới hạn (mm)</th><th style={th}>Trạng thái</th><th style={th} />
            </tr>
          </thead>
          <tbody>
            {steel.map((s) => {
              const pct = steelPercent(s)
              return (
                <tr key={s.materialId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{s.materialCode}</td>
                  <td style={tdR}>{fmt(s.receivedBarCount)}</td>
                  <td style={tdR}>{fmt(s.usableMm)}</td>
                  <td style={tdR}>{fmt(s.reportedMm)}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: pct != null && pct > 100 ? 'var(--red)' : undefined }}>{pct == null ? dash : `≈ ${pct.toLocaleString('vi-VN')}%`}</td>
                  <td style={tdR}>{s.overrideMm > 0 ? fmt(s.overrideMm) : dash}</td>
                  <td style={tdR}>{fmt(s.limitMm)}</td>
                  <td style={td}><StatusBadge status={steelStatus(s)} /></td>
                  <td style={td}>
                    {s.receivedBarCount > 0 && (
                      <button type="button" style={smallBtn}
                        onClick={() => onOverride({ stage: 'PHOI', materialId: s.materialId, label: `Sắt ${s.materialCode}`, room: null })}>
                        Mở chặn
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {steel.length === 0 && <tr><td colSpan={9} style={{ ...td, color: 'var(--text3)' }}>Lệnh chưa có loại sắt nào.</td></tr>}
          </tbody>
        </table>
      </div>
      {segments.length > 0 && (
        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={th}>Mã đoạn</th><th style={thR}>Cần</th><th style={thR}>Phôi đạt KCS</th><th style={thR}>Ở kho Phôi chờ giao</th>
                <th style={thR}>Đã giao</th><th style={thR}>Chờ ký</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((g) => (
                <tr key={`${g.segmentSpecId}|${g.segmentSteps}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{g.label}</td>
                  <td style={tdR}>{fmt(g.requiredQty)}</td>
                  <td style={tdR}>{fmt(g.passedQty)}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{fmt(g.inKhoPhoiQty)}</td>
                  <td style={tdR}>{fmt(g.handedOverQty)}</td>
                  <td style={tdR}>{g.draftQty > 0 ? fmt(g.draftQty) : dash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StageSection({ stage, onOverride }: { stage: BoardStage; onOverride: (t: OverrideTarget) => void }) {
  const label = OVERRIDE_STAGE_LABEL[stage.stage]
  const showSku = new Set(stage.pieces.map((p) => p.productionOrderId)).size > 1
  return (
    <div style={card}>
      <div style={cardHead}>Tổ {label}{stage.warehouseCode && <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 12 }}> · kho {stage.warehouseCode}</span>}</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead>
            <tr>
              <th style={th}>Mảnh</th><th style={thR}>Kế hoạch</th><th style={thR}>Đã báo</th><th style={thR}>Đã nhận</th><th style={thR}>Đã làm</th>
              <th style={thR}>Còn</th><th style={thR}>Mở chặn</th><th style={thR}>Còn báo được</th><th style={th}>Trạng thái</th><th style={th} />
            </tr>
          </thead>
          <tbody>
            {stage.pieces.map((p) => (
              <tr key={`${p.productionOrderId}|${p.pieceId}`} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{p.pieceName}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.pieceCode}{showSku && p.sku ? ` · SKU ${p.sku}` : ''}{p.mode === 'FRAME' ? ' · mảnh đã hàn' : ''}</div>
                </td>
                <td style={tdR}>{fmt(p.plannedQty)}</td>
                <td style={tdR}>{fmt(p.reportedQty)}</td>
                <td style={tdR}>{p.receivedQty == null ? dash : fmt(p.receivedQty)}</td>
                <td style={tdR}>{p.usedQty == null ? dash : fmt(p.usedQty)}</td>
                <td style={{ ...tdR, fontWeight: 700, color: p.receivedLeft != null && p.receivedLeft <= 0 ? 'var(--red)' : undefined }}>{p.receivedLeft == null ? dash : fmt(p.receivedLeft)}</td>
                <td style={tdR}>{p.overrideQty > 0 ? fmt(p.overrideQty) : dash}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{fmt(p.effectiveMaxNow)}</td>
                <td style={td}><StatusBadge status={pieceStatus(p)} /></td>
                <td style={td}>
                  {canOverridePiece(p) && (
                    <button type="button" style={smallBtn}
                      onClick={() => onOverride({
                        stage: stage.stage, productionOrderId: p.productionOrderId, pieceId: p.pieceId,
                        label: `${p.pieceName}${p.sku ? ` (SKU ${p.sku})` : ''} · tổ ${label}`, room: pieceOverrideRoom(p),
                      })}>
                      Mở chặn
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {stage.pieces.length === 0 && <tr><td colSpan={10} style={{ ...td, color: 'var(--text3)' }}>Lệnh không có mảnh nào qua tổ {label}.</td></tr>}
          </tbody>
        </table>
      </div>
      {stage.pool.length > 0 && (
        <div style={{ overflowX: 'auto', borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '8px 12px 0', fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Đoạn tổ {label} đã nhận</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr><th style={th}>Mã đoạn</th><th style={thR}>Đã nhận</th><th style={thR}>Mở chặn</th><th style={thR}>Đã làm</th><th style={thR}>Đã giao chưa làm</th><th style={thR}>Ở kho {label}</th></tr>
            </thead>
            <tbody>
              {stage.pool.map((r) => (
                <tr key={`${r.segmentSpecId}|${r.segmentSteps}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.label}</td>
                  <td style={tdR}>{fmt(r.receivedQty)}</td>
                  <td style={tdR}>{r.overrideQty > 0 ? fmt(r.overrideQty) : dash}</td>
                  <td style={tdR}>{fmt(r.usedQty)}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: r.leftQty < 0 ? 'var(--red)' : undefined }}>{fmt(r.leftQty)}</td>
                  <td style={tdR}>{fmt(r.inStageWarehouseQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const KIND_LABEL: Record<HandoverOverrideKind, string> = {
  OVERRIDE: 'Mở chặn',
  OPENING_DONE: 'Đầu kỳ (đã báo trước ngày bật)',
  OPENING_WAITING: 'Đầu kỳ (khung chờ Sơn)',
}

/**
 * Đầu kỳ ngày bật (câu 2, chốt 28/11/2026 cách 1): QLSX bấm 1 lần ngay sau khi bật giao nhận - số đã báo Hàn / Sơn của mọi lệnh
 * đang chạy thành "đã nhận đầu kỳ", công nhân không bị chặn oan. Ghi rồi thì chỉ hiện đã ghi lúc nào.
 */
function OpeningCard({ onDone }: { onDone: () => void }) {
  const { data, error, refetch } = useFetch(() => getHandoverOpening())
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  if (error || !data || !data.enabled) return null
  const run = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await createHandoverOpeningDone()
      setResult(`Đã ghi đầu kỳ ${fmt(r.created)} dòng của ${fmt(r.lenh)} lệnh.`)
      setAsking(false); refetch(); onDone()
    } catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div style={{ ...card, padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 240, fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 2 }}>Đầu kỳ ngày bật giao nhận</div>
        {data.done ? (
          <span style={{ color: 'var(--text2)' }}>
            Đã ghi {data.doneAt ? format(new Date(data.doneAt), 'dd/MM/yyyy HH:mm') : ''}{data.doneByName ? ` (${data.doneByName})` : ''}: {fmt(data.doneCount)} dòng đã báo trước ngày bật · thủ kho Hàn đã nhập {fmt(data.waitingCount)} dòng khung chờ Sơn.
          </span>
        ) : (
          <span style={{ color: 'var(--text2)' }}>
            Chưa ghi. Bấm 1 lần NGAY sau khi bật: số đã báo Hàn / Sơn trước ngày bật của mọi lệnh đang chạy được tính là đã nhận, công nhân không bị chặn oan. Thanh phôi còn ở tổ Hàn vẫn lập phiếu giao đoạn; khung Hàn đạt đang chờ Sơn do thủ kho Hàn nhập.
          </span>
        )}
        {result && <div style={{ color: 'var(--green)', marginTop: 4 }}>{result}</div>}
      </div>
      {!data.done && <button type="button" style={{ ...smallBtn, padding: '6px 14px' }} onClick={() => { setErr(null); setAsking(true) }}>Ghi đầu kỳ</button>}
      {asking && (
        <Modal open onClose={() => { if (!busy) setAsking(false) }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Ghi đầu kỳ ngày bật giao nhận</div>
            <div>Số đã báo Hàn / Sơn tới lúc này của mọi lệnh đang chạy sẽ được tính là <b>đã nhận</b>. Chỉ ghi được 1 lần cho cả nhà máy.</div>
            <div style={{ color: 'var(--red)' }}>Chỉ bấm ngay sau khi bật, trước khi công nhân báo tiếp - ghi muộn sẽ tính cả phần báo sau ngày bật.</div>
            {err && <div style={{ color: 'var(--red)' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={smallBtn} disabled={busy} onClick={() => setAsking(false)}>Huỷ</button>
              <button type="button" style={{ ...smallBtn, background: 'var(--bg-3949ab)', color: '#fff', borderColor: 'var(--bg-3949ab)' }} disabled={busy} onClick={() => void run()}>
                {busy ? 'Đang ghi…' : 'Ghi đầu kỳ'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function OverridesSection({ data }: { data: HandoverBoardDetail }) {
  return (
    <div style={card}>
      <div style={cardHead}>Mở chặn / đầu kỳ ({data.overrides.length})</div>
      {data.overrides.length === 0 ? (
        <div style={{ padding: 14, fontSize: 13, color: 'var(--text3)' }}>Chưa mở chặn lần nào.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead><tr><th style={th}>Lúc</th><th style={th}>Loại</th><th style={th}>Tổ</th><th style={th}>Mục</th><th style={thR}>Số</th><th style={th}>Lý do</th><th style={th}>Người ghi</th></tr></thead>
            <tbody>
              {data.overrides.map((o) => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{format(new Date(o.createdAt), 'dd/MM HH:mm')}</td>
                  <td style={td}>{KIND_LABEL[o.kind ?? 'OVERRIDE']}</td>
                  <td style={td}>{OVERRIDE_STAGE_LABEL[o.stage] ?? o.stage}</td>
                  <td style={td}>{overrideTargetText(o)}</td>
                  <td style={{ ...tdR, fontWeight: 700 }}>{fmt(o.qty)} {o.unit}</td>
                  <td style={td}>{o.reason}</td>
                  <td style={td}>{o.createdByName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function OverrideDialog({ target, productionInvoiceId, onClose, onDone }: {
  target: OverrideTarget; productionInvoiceId: string; onClose: () => void; onDone: () => void
}) {
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const sending = useRef(false)
  const unit = overrideUnit(target)
  const errors = validateOverride(target, qty, reason)
  const qtyRef = useRef<HTMLInputElement>(null)
  useEffect(() => { qtyRef.current?.focus() }, [])

  const submit = async () => {
    setTouched(true)
    if (!overrideValid(errors) || sending.current) return
    sending.current = true
    setBusy(true); setErr('')
    try {
      await createHandoverOverride({
        productionInvoiceId,
        stage: target.stage,
        ...(target.stage === 'PHOI'
          ? { materialId: target.materialId }
          : { productionOrderId: target.productionOrderId, pieceId: target.pieceId }),
        qty: parseOverrideQty(qty),
        reason: reason.trim(),
      })
      onDone()
    } catch (e) {
      setErr(errMsg(e, 'Không mở chặn được'))
    } finally {
      sending.current = false
      setBusy(false)
    }
  }

  const field: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
  const errStyle: React.CSSProperties = { marginTop: 4, fontSize: 12, color: 'var(--red)' }
  return (
    <Modal open onClose={busy ? undefined : onClose} maxWidth={460}>
      <div role="dialog" aria-modal="true" aria-labelledby="handover-override-title" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h3 id="handover-override-title" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Mở chặn</h3>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>{target.label}</div>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Số {unit} cho làm thêm
          <input ref={qtyRef} inputMode={target.stage === 'PHOI' ? 'decimal' : 'numeric'} value={qty} aria-invalid={touched && !!errors.qty}
            onChange={(e) => setQty(e.target.value)} style={{ ...field, marginTop: 4 }}
            placeholder={target.room != null ? `tối đa ${target.room}` : 'mm'} />
          {touched && errors.qty && <div role="alert" style={errStyle}>{errors.qty}</div>}
        </label>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Lý do <span style={{ color: 'var(--red)' }}>*</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} aria-invalid={touched && !!errors.reason}
            placeholder="Vd: kho vắng người, số tồn sai đang kiểm lại" style={{ ...field, marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
          {touched && errors.reason && <div role="alert" style={errStyle}>{errors.reason}</div>}
        </label>
        <div style={{ fontSize: 12, color: 'var(--amber)', background: 'var(--amber-bg)', borderRadius: 8, padding: '8px 10px' }}>{OVERRIDE_NOTE}</div>
        {err && <div role="alert" style={{ fontSize: 13, color: 'var(--red)' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...smallBtn, padding: '7px 14px', fontSize: 13 }}>Huỷ</button>
          <button type="button" onClick={() => void submit()} disabled={busy}
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8, background: 'var(--blue)', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}>
            {busy ? 'Đang ghi…' : 'Mở chặn'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

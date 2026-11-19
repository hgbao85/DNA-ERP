'use client'

/**
 * CORE dùng chung cho màn KCS duyệt Hàn/Sơn (2 tầng: PO → Vật liệu) — chỉ xem + duyệt, không nhập
 * sản lượng. Phôi có màn KCS riêng (KcsPhoiPage.tsx, viết lại hoàn toàn 2026-08-24), không dùng
 * component này nữa.
 * Tái dùng types/helpers/orchestrator-shell từ `core.tsx`; thêm "chờ kiểm" + duyệt đạt/không đạt (số lượng + nguyên nhân + ảnh).
 * KcsStagePage.tsx là caller duy nhất, luôn gọi qua API thật (production-batches-api.ts).
 *
 * P1 (18/11/2026): KCS tự thấy lô công nhân vừa báo (dòng ĐANG MỞ) và bấm "Chấm" - màn gọi lệnh chốt rồi mở hộp chấm.
 * Hộp chấm có Đã báo / Thực có (≤ Đã báo) / Không đạt; số thiếu = Đã báo - Thực có, ghi riêng, không tính lỗi.
 * Dòng của lệnh đang tạm dừng / đã kết thúc (hoặc dữ liệu cũ chưa gắn SKU) tô xám + khoá nút, không tính vào số chờ.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ClipboardCheck, AlertTriangle, Upload, X, Plus, Check, History } from 'lucide-react'
import LenhSanXuatBoard, { type BoardColumn } from './LenhSanXuatBoard'
import AuditLogTimeline from '../AuditLogTimeline'
import type { AuditLogEntry } from '../../context/AuditLogContext'
import { useFetch } from '../../hooks/useFetch'
import * as api from '../../services/api'
import { errMsg } from '../../utils/errors'
import {
  MSG_ACTUAL_CLAMPED, buildFlatPayload, calcRow, clampActual, doneText, sumRows, totalsText,
} from '../../modules/pages/Kcs/kcsReviewModel'
import {
  type ProcLine, type ProcRow, type StageCfg,
  fmt, timeVN, lechOf,
} from './core'

const ACCENT = 'var(--fg-e65100)'

// ── Types ──────────────────────────────────────────────────────────
export interface KcsLine extends ProcLine {
  pendingQty: number          // chờ kiểm — SL vừa báo, chưa duyệt
  /** Khoá mở-thẳng-đúng-mục từ thông báo (vd 'PRODUCTION_BATCH:12') - xem utils/notificationLink.ts. */
  focusKey?: string
  approvedQty?: number        // SL đã KCS duyệt ĐẠT (lô DA_CAT)
  /** Tổng không đạt CỘNG DỒN LỊCH SỬ qua các lần duyệt (2026-09-08 lần 2, xem changelog "Bù đủ dồn
   *  về bảng tổng") - KHÔNG tự giảm khi tổ bù đủ (Bù đủ = 1 lô HOÀN TOÀN MỚI gửi duyệt lại, không
   *  sửa lại con số này). */
  failedQty?: number
  defectReason?: string
  reviewNote?: string
  defectPhotoUrl?: string
  history?: AuditLogEntry[]   // lịch sử lô (xuất → báo → duyệt) dựng từ data thật để hiện timeline
  /** P1: đợt ĐANG MỞ (công nhân vừa báo, chưa chốt) - bấm Chấm thì chốt trước rồi mới mở hộp chấm. */
  open?: boolean
  /** P1: có câu = dòng xám + khoá nút Chấm + không tính vào số chờ (lệnh dừng / dữ liệu cũ chưa gắn SKU). */
  blockedMessage?: string | null
  /** P1: đích gọi API do caller dựng sẵn (bền qua lần tải lại, không phụ thuộc id đánh số lại mỗi lần vẽ). */
  ref?: unknown
  /** P1: "Báo lúc" (dòng mở) / "Chốt lúc" (dòng đã chốt) + thời điểm. */
  timeLabel?: string
  timeAt?: string
}
export interface KcsRow extends Omit<ProcRow, 'manhs' | 'lines'> { lines?: KcsLine[] }

interface DefectReason { id: number; label: string; stageType?: string | null }

export interface ReviewPayload {
  failedQty: number
  /** KCS ghi thiếu = Đã báo - Thực có (P1) - ghi riêng, không cộng vào failedQty. */
  shortQty?: number
  /** Đã báo của đợt lúc chấm (để dựng câu báo xong). */
  reportedQty: number
  defectReasonId?: number; reviewNote?: string; defectPhotoUrl?: string
}

/** Kết quả chốt 1 đợt đang mở: số Đã báo của đợt vừa chốt + đích chấm (id đợt mới) do BE trả. */
export interface OpenReviewResult { reportedQty: number; ref: unknown }

const allKcsLines = (r: KcsRow): KcsLine[] => r.lines ?? []
/** Dòng tính vào số chờ chấm: còn chờ và không xám. */
const isCounted = (l: KcsLine) => l.pendingQty > 0 && !l.blockedMessage
const pendingOf = (lines: KcsLine[]) => lines.reduce((s, l) => s + (isCounted(l) ? l.pendingQty : 0), 0)

// ── Modal chấm: Đã báo / Thực có / Không đạt (+ nguyên nhân + ảnh) - P1 (18/11/2026). Thực có không lớn hơn Đã báo;
// thiếu = Đã báo - Thực có, ghi riêng (không tính lỗi, không cần làm bù). Vẫn CHỈ 2 kết quả Đạt / Không đạt (2026-09-08 lần 2). ──
function KcsReviewModal({ stageType, line, reportedQty, onClose, onSubmit }: {
  stageType: string; line: KcsLine; reportedQty: number; onClose: () => void; onSubmit: (p: ReviewPayload) => Promise<void>
}) {
  const { data: reasons, refetch } = useFetch<DefectReason[]>(() => api.getDefectReasons(stageType), [stageType])
  const list = Array.isArray(reasons) ? reasons : []

  const [actual, setActual] = useState('')
  const [clamped, setClamped] = useState(false)
  const [failedQty, setFailedQty] = useState('')
  const [reasonId, setReasonId] = useState<number | ''>('')
  const [reviewNote, setReviewNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  // busy (2026-09-11, QA audit): chờ API xong mới đóng hộp; lỗi hiện ngay trong hộp, giữ nguyên dữ liệu đã nhập.
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Không kẹp im lặng: số sai thì báo đỏ + khoá nút (test tay 09/11 điểm 33). Riêng Thực có > Đã báo thì tự về Đã báo kèm câu nhắc (S2).
  const calc = calcRow('FLAT', { reported: reportedQty, actual, failed: failedQty })
  const totals = sumRows([calc])
  const quaSo = calc.error !== null
  const failed = calc.failed

  const addReason = async () => {
    if (!newLabel.trim()) return
    setAdding(true); setErr('')
    try {
      const created = await api.createDefectReason({ label: newLabel.trim(), stageType }) as DefectReason
      setNewLabel('')
      await refetch()
      setReasonId(created.id)
    } catch { setErr('Không thêm được loại lỗi') }
    finally { setAdding(false) }
  }

  const onPickPhoto = async (file?: File) => {
    if (!file) return
    setUploading(true); setErr('')
    try { setPhotoUrl(await api.uploadImage(file)) }
    catch { setErr('Tải ảnh thất bại') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    if (quaSo) return
    if (failed > 0 && !reasonId) { setErr('Có SL không đạt → phải chọn nguyên nhân'); return }
    setBusy(true); setErr('')
    try {
      await onSubmit({
        ...buildFlatPayload(calc), reportedQty,
        defectReasonId: reasonId ? Number(reasonId) : undefined, reviewNote: reviewNote || undefined, defectPhotoUrl: photoUrl || undefined,
      })
      onClose()
    } catch (e) { setErr(errMsg(e, 'Không duyệt được')) }
    finally { setBusy(false) }
  }

  const numInp: React.CSSProperties = { ...inp, width: 90, textAlign: 'right', marginTop: 0 }
  return (
    <div onClick={onClose} className="dna-modal-overlay-in" style={overlay}>
      <div onClick={e => e.stopPropagation()} className="dna-modal-card-in" style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, minWidth: 0, wordBreak: 'break-word' }}>Chấm — {line.itemName}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '10px 16px' }}>
          <div>
            <div style={{ ...lbl, margin: '0 0 4px' }}>Đã báo</div>
            <div style={{ fontSize: 15, fontWeight: 700, padding: '8px 0' }}>{fmt(reportedQty)}</div>
          </div>
          <div>
            <label style={{ ...lbl, margin: '0 0 4px' }}>Thực có</label>
            <input type="number" min={0} max={reportedQty} inputMode="numeric" placeholder={String(reportedQty)} value={actual} autoFocus
              onChange={e => { const c = clampActual(e.target.value, reportedQty); setActual(c.value); setClamped(c.clamped) }}
              style={numInp} />
          </div>
          <div>
            <label style={{ ...lbl, margin: '0 0 4px' }}>Không đạt</label>
            <input type="number" min={0} max={reportedQty} inputMode="numeric" placeholder="0" value={failedQty}
              onChange={e => setFailedQty(e.target.value)}
              style={quaSo ? { ...numInp, borderColor: 'var(--fg-c62828)', color: 'var(--fg-c62828)' } : numInp} />
          </div>
        </div>
        {clamped && <div style={{ fontSize: 12, color: 'var(--fg-d97706)', marginTop: 6 }}>{MSG_ACTUAL_CLAMPED}</div>}
        {quaSo && <div style={{ fontSize: 12, color: 'var(--fg-c62828)', marginTop: 6 }}>{calc.error}</div>}
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>
          {totalsText('FLAT', totals)}
        </div>

        {failed > 0 && <>
          <label style={lbl}>Nguyên nhân không đạt *</label>
          <select value={reasonId} onChange={e => setReasonId(e.target.value ? Number(e.target.value) : '')} style={inp}>
            <option value="">— chọn nguyên nhân —</option>
            {list.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>

          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addReason() }}
              placeholder="+ Thêm loại lỗi mới…" style={{ ...inp, marginTop: 0, flex: 1, minWidth: 0 }} />
            <button onClick={addReason} disabled={adding || !newLabel.trim()} style={btnGhost}><Plus size={14} /> Thêm</button>
          </div>

          <label style={lbl}>Ghi chú</label>
          <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} />

          <label style={lbl}>Hình ảnh</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ ...btnGhost, cursor: 'pointer' }}>
              <Upload size={14} /> {uploading ? 'Đang tải…' : 'Chọn ảnh'}
              <input type="file" accept="image/*" hidden onChange={e => onPickPhoto(e.target.files?.[0])} />
            </label>
            {photoUrl && <img src={photoUrl} alt="lỗi" style={{ height: 40, borderRadius: 4, border: '1px solid var(--border)' }} />}
          </div>
        </>}

        {err && <div style={{ color: 'var(--fg-c62828)', fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{
          position: 'sticky', bottom: -20, display: 'flex', gap: 8, justifyContent: 'flex-end',
          margin: '16px -20px -20px', padding: '12px 20px',
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={btnGhost} disabled={busy}>Hủy</button>
          <button onClick={submit} disabled={uploading || busy || quaSo} style={quaSo ? { ...btnPrimary, opacity: 0.5, cursor: 'not-allowed' } : btnPrimary}>{busy ? 'Đang lưu…' : 'Xác nhận chấm'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Popup lịch sử (read-only ngoại trừ ảnh - 2026-09-11 lần 2, xem EditPhotoActions) — gộp mọi đợt
// của PO, xem không cần vào luồng duyệt ─────
function KcsHistoryModal({ title, entries, onClose, onEditPhoto, onDeletePhoto }: {
  title: ReactNode; entries: AuditLogEntry[]; onClose: () => void
  onEditPhoto?: (entry: AuditLogEntry, file: File) => void | Promise<void>
  onDeletePhoto?: (entry: AuditLogEntry) => void | Promise<void>
}) {
  return (
    <div onClick={onClose} className="dna-modal-overlay-in" style={overlay}>
      <div onClick={e => e.stopPropagation()} className="dna-modal-card-in" style={{ ...card, width: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Lịch sử — {title}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <AuditLogTimeline entries={entries} title="Diễn biến các đợt" onEditPhoto={onEditPhoto} onDeletePhoto={onDeletePhoto} />
      </div>
    </div>
  )
}

// ── Tầng: Vật tư — chờ chấm / chấm (dùng chung Phôi/Hàn/Sơn) ─────
const noticeBox: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', margin: '14px 0 0', borderRadius: 'var(--radius)', fontSize: 13 }

function KcsVatTuReviewBoard({ lines, cfg, stageType, title, subtitle, backLabel, notice, onBack, onReview, onOpenReview, onReload, showToast, onEditPhoto, onDeletePhoto }: {
  lines: KcsLine[]; cfg: StageCfg; stageType: string; title: string; subtitle: string; backLabel: string
  notice?: ReactNode
  onBack: () => void
  onReview: (line: KcsLine, p: ReviewPayload, ref: unknown) => Promise<void>
  onOpenReview?: (line: KcsLine) => Promise<OpenReviewResult>
  onReload?: () => void
  showToast: (msg: string) => void
  onEditPhoto?: (entry: AuditLogEntry, file: File) => void | Promise<void>
  onDeletePhoto?: (entry: AuditLogEntry) => void | Promise<void>
}) {
  // Hộp chấm giữ ĐÚNG đợt vừa chốt (số Đã báo + đích chấm do lệnh chốt trả về), không đọc lại dòng trong danh sách đang tự tải lại.
  const [target, setTarget] = useState<{ line: KcsLine; reportedQty: number; ref: unknown } | null>(null)
  const [closingId, setClosingId] = useState<number | null>(null)
  const [actionErr, setActionErr] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const lech = lechOf(lines)
  // Lịch sử gộp cả PO: mọi đợt của mọi vật liệu, xếp theo thời gian.
  const poHistory = lines.flatMap(l => l.history ?? []).sort((a, b) => a.at.localeCompare(b.at))

  // Bấm "Chấm": dòng đang mở thì chốt trước (lỗi 409 / 400 -> hiện đúng câu BE, tải lại danh sách, KHÔNG mở hộp).
  const startReview = async (l: KcsLine) => {
    if (l.blockedMessage || closingId !== null) return
    setActionErr('')
    if (!l.open) { setTarget({ line: l, reportedQty: l.pendingQty, ref: l.ref }); return }
    if (!onOpenReview) return
    setClosingId(l.id)
    try {
      const r = await onOpenReview(l)
      setTarget({ line: l, reportedQty: r.reportedQty, ref: r.ref })
    } catch (e) {
      setActionErr(errMsg(e, 'Không chốt được để chấm - tải lại trang'))
      onReload?.()
    } finally { setClosingId(null) }
  }

  const cols: BoardColumn<KcsLine>[] = [
    {
      key: 'item', header: 'Mảnh', cell: l => (
        <div>
          <span style={{ fontWeight: 600 }}>{l.itemName}</span>
          {l.blockedMessage && <div style={{ fontSize: 11, color: 'var(--fg-c62828)', marginTop: 2 }}>{l.blockedMessage}</div>}
        </div>
      ),
    },
    { key: 'spec', header: 'Quy cách', cell: l => <span style={{ color: 'var(--text3)' }}>{l.spec}</span> },
    {
      key: 'pending', header: 'Đã báo (chờ chấm)', align: 'right', cell: l => l.pendingQty > 0
        ? (
          <div>
            <span style={{ fontWeight: 700, color: l.blockedMessage ? 'var(--text3)' : ACCENT }}>{fmt(l.pendingQty)}</span>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{l.open ? 'đang mở' : 'đã chốt'}</div>
          </div>
        )
        : <span style={{ color: 'var(--text3)' }}>—</span>
    },
    {
      key: 'time', header: 'Thời điểm', cell: l => l.timeAt
        ? <span style={{ color: 'var(--text3)' }}>{l.timeLabel} {timeVN(l.timeAt)}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>,
    },
    {
      key: 'approved', header: 'Đã duyệt', align: 'right', cell: l => l.approvedQty
        ? <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(l.approvedQty)}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>
    },
    {
      // Lỗi CỘNG DỒN LỊCH SỬ (2026-09-08 lần 2, xem changelog "Bù đủ dồn về bảng tổng") - KHÔNG tự
      // giảm khi tổ bù đủ (Bù đủ = 1 lô HOÀN TOÀN MỚI gửi duyệt lại bình thường, không sửa dòng cũ).
      key: 'failed', header: 'Lỗi', align: 'right', cell: l => l.failedQty
        ? <span style={{ fontWeight: 700, color: 'var(--fg-c62828)' }}>{fmt(l.failedQty)}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>,
    },
    {
      key: 'action', header: '', width: 150, cell: l => {
        if (l.pendingQty > 0) {
          const locked = !!l.blockedMessage
          const closing = closingId === l.id
          return (
            <div onClick={e => e.stopPropagation()}>
              <button onClick={() => startReview(l)} disabled={locked || closingId !== null} className="primary"
                title={l.blockedMessage ?? undefined}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12, cursor: locked ? 'not-allowed' : 'pointer' }}>
                <ClipboardCheck size={13} /> {closing ? 'Đang chốt…' : 'Chấm'}
              </button>
            </div>
          )
        }
        return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}><Check size={13} /> đã duyệt</span>
      }
    },
  ]

  return (
    <>
      <LenhSanXuatBoard<KcsLine>
        onBack={onBack} backLabel={backLabel}
        title={title} subtitle={subtitle}
        headerRight={poHistory.length > 0 ? (
          <button onClick={() => setShowHistory(true)} title="Xem lịch sử các đợt của lệnh"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
            <History size={14} /> Lịch sử
          </button>
        ) : undefined}
        beforeTable={(notice || actionErr || lech) ? (
          <>
            {notice}
            {actionErr && (
              <div role="alert" style={{ ...noticeBox, background: 'var(--red-bg)', color: 'var(--red)' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} /> <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{actionErr}</span>
              </div>
            )}
            {lech && (
              <div style={{ ...noticeBox, background: 'var(--red-bg)', color: 'var(--red)' }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} /> Các {cfg.itemLabel.toLowerCase()} chưa cân đối sản lượng — đối chiếu trước khi duyệt hết.
              </div>
            )}
          </>
        ) : undefined}
        columns={cols}
        rows={lines}
        rowKey={l => l.id}
        rowFocus={l => l.focusKey}
        rowTone={l => l.blockedMessage ? 'muted' : l.pendingQty > 0 ? 'alert' : 'default'}
        emptyText="Không còn lô chờ kiểm."
      />
      {target && (
        <KcsReviewModal
          stageType={stageType}
          line={target.line}
          reportedQty={target.reportedQty}
          onClose={() => setTarget(null)}
          onSubmit={async p => {
            await onReview(target.line, p, target.ref)
            const failed = p.failedQty
            const short = p.shortQty ?? 0
            showToast(`Đã chấm ${target.line.itemName}: ${doneText('FLAT', {
              reported: p.reportedQty, passed: p.reportedQty - failed - short, failed, rework: 0, scrap: 0, short,
            })}`)
          }}
        />
      )}
      {showHistory && (
        <KcsHistoryModal title={title} entries={poHistory} onClose={() => setShowHistory(false)}
          onEditPhoto={onEditPhoto} onDeletePhoto={onDeletePhoto} />
      )}
    </>
  )
}

// ── Tầng 1: hàng đợi KCS theo lô/SKU — chờ kiểm + đã duyệt + lỗi ──
interface KcsPoView { r: KcsRow; soLoCho: number; soLoXam: number; choKiem: number; slXam: number; daDuyet: number; loi: number }

function KcsPoListBoard({ rows, cfg, notice, onEnter }: { rows: KcsRow[]; cfg: StageCfg; notice?: ReactNode; onEnter: (id: number) => void }) {
  const views: KcsPoView[] = rows.map(r => {
    const ls = allKcsLines(r)
    return {
      r,
      soLoCho: ls.filter(isCounted).length,
      // Dòng xám (lệnh dừng / dữ liệu cũ chưa gắn SKU) vẫn hiện nhưng không tính vào số chờ (AC10 / AC11).
      soLoXam: ls.filter(l => l.pendingQty > 0 && l.blockedMessage).length,
      choKiem: pendingOf(ls),
      // P1 (19/11, QA nghiệm thu): tổng SL của dòng xám, hiện cùng kiểu cột số lô để không lệch với tiêu đề màn chi tiết.
      slXam: ls.reduce((s, l) => s + (l.pendingQty > 0 && l.blockedMessage ? l.pendingQty : 0), 0),
      daDuyet: ls.reduce((s, l) => s + (l.approvedQty ?? 0), 0),
      loi: ls.reduce((s, l) => s + (l.failedQty ?? 0), 0),
    }
  })

  const unit = <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text3)' }}>{cfg.unit}</span>
  // "SKU nhà máy" (cột cũ) đã bỏ (2026-09-08) - BE chưa từng trả mã SKU thật cho ProductionBatch/
  // PieceStepBundle, cột đó chỉ lặp lại đúng giá trị cột "PI" (r.sku bị gán tạm = poNumber ở
  // KcsStagePage.tsx) - phát hiện khi người dùng hỏi "sao SKU lại trống".
  const cols: BoardColumn<KcsPoView>[] = [
    { key: 'po', header: 'Lệnh', cell: v => <span style={{ fontWeight: 700 }}>{v.r.poNumber}</span> },
    {
      key: 'soLo', header: 'Số lô chờ chấm', align: 'right', cell: v => (
        <span>
          <span style={{ fontWeight: 700, color: v.soLoCho > 0 ? ACCENT : 'var(--text3)' }}>{fmt(v.soLoCho)}</span>
          {v.soLoXam > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}> (+{fmt(v.soLoXam)} chưa chấm được)</span>}
        </span>
      )
    },
    {
      key: 'pending', header: 'Tổng SL chờ chấm', align: 'right', cell: v => (
        <span>
          <span style={{ fontWeight: 700, color: v.choKiem > 0 ? ACCENT : 'var(--text3)' }}>{fmt(v.choKiem)} {unit}</span>
          {v.slXam > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}> (+{fmt(v.slXam)} chưa chấm được)</span>}
        </span>
      )
    },
    {
      key: 'daDuyet', header: 'Đã duyệt', align: 'right', cell: v => v.daDuyet > 0
        ? <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(v.daDuyet)} {unit}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>
    },
    {
      key: 'loi', header: 'Lỗi', align: 'right', cell: v => v.loi > 0
        ? <span style={{ fontWeight: 700, color: 'var(--fg-c62828)' }}>{fmt(v.loi)} {unit}</span>
        : <span style={{ color: 'var(--text3)' }}>0</span>
    },
    { key: 'reportedAt', header: 'Báo lúc', cell: v => timeVN(v.r.deadline) },
  ]

  const Icon = cfg.Icon
  return (
    <LenhSanXuatBoard<KcsPoView>
      icon={<Icon size={18} />}
      title={`Màn hình KCS — Công đoạn ${cfg.label}`}
      subtitle="Kiểm tra chất lượng theo lệnh — bấm vào dòng có hàng chờ chấm để chấm."
      beforeTable={notice}
      columns={cols}
      rows={views}
      rowKey={v => v.r.id}
      rowFocus={v => (v.r.lines ?? []).map(l => l.focusKey).filter(Boolean).join(' ') || undefined}
      rowTone={v => v.choKiem > 0 ? 'alert' : 'default'}
      clickable={() => true}
      onRowClick={v => onEnter(v.r.id)}
      rowTitle={v => v.choKiem > 0 ? `Có ${fmt(v.choKiem)} chờ chấm — nhấn để chấm` : 'Nhấn để xem chi tiết'}
      emptyText="Không còn lô chờ kiểm."
    />
  )
}

// ── Orchestrator: KCS Phôi/Hàn/Sơn (2 tầng) ─────────────────────────
// Controlled: caller truyền `rows` + `onReview` (đọc/ghi API thật) — nhánh mock cục bộ
// (seed/localRows) đã xoá 2026-09-18 vì KcsStagePage.tsx là caller duy nhất và luôn truyền cả
// hai (KcsPhoiPage.tsx viết lại riêng, không dùng component này).
export function KcsTwoTierScreen({ cfg, stageType, rows, notice, onReview, onOpenReview, onReload, onEditPhoto, onDeletePhoto }: {
  cfg: StageCfg
  /** Loại lỗi lấy theo tổ của lô (PHOI cho Vật tư TP, HAN, SON) - KHÔNG suy từ cfg.label (Vật tư TP từng lấy nhầm lỗi của Sơn). */
  stageType: 'PHOI' | 'HAN' | 'SON'
  rows: KcsRow[]
  /** Câu hiện phía trên danh sách (vd 403 của danh sách đợt đang mở). */
  notice?: ReactNode
  /** Chấm 1 dòng; ref là đích do lệnh chốt trả về (dòng đang mở) - undefined thì dùng line.ref. */
  onReview: (poId: number, line: KcsLine, p: ReviewPayload, ref: unknown) => Promise<void>
  /** Chốt 1 dòng đang mở để chấm; ném lỗi (409 / 400) thì màn hiện đúng câu BE, KHÔNG mở hộp chấm. */
  onOpenReview?: (poId: number, line: KcsLine) => Promise<OpenReviewResult>
  /** Tải lại danh sách (sau khi chốt lỗi). */
  onReload?: () => void
  /** Sửa/xóa ảnh lỗi 1 review ĐÃ CHẤM (2026-09-11 lần 2, theo Sếp: "cho người nhập được sửa
   *  luôn") - xem AuditLogTimeline.EditPhotoActions. */
  onEditPhoto?: (entry: AuditLogEntry, file: File) => void | Promise<void>
  onDeletePhoto?: (entry: AuditLogEntry) => void | Promise<void>
}) {
  const [selPoId, setSelPoId] = useState<number | null>(null)
  const selPo = rows.find(r => r.id === selPoId) ?? null

  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = window.setTimeout(() => setToast(null), 5000)
  }

  // 2026-09-11 (QA audit): PHẢI await xong onReview trước khi báo "đã chấm" - lỗi BE ném lại cho hộp chấm hiện trong hộp,
  // giữ nguyên dữ liệu vừa nhập. Toast do hộp chấm gọi sau khi onReview thành công.
  const toastEl = toast && (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1200,
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
      background: 'var(--bg-1f2937)', color: '#fff', borderRadius: 10, fontSize: 13,
      boxShadow: '0 8px 24px rgba(0,0,0,.25)', maxWidth: 'calc(100vw - 32px)',
    }}>
      <Check size={16} color="var(--fg-4ade80)" />
      <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{toast}</span>
      <button onClick={() => setToast(null)} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--fg-9ca3af)' }} title="Đóng">
        <X size={15} />
      </button>
    </div>
  )

  return (
    <>
      {selPo ? (
        <KcsVatTuReviewBoard
          lines={selPo.lines ?? []} cfg={cfg} stageType={stageType} notice={notice}
          title={selPo.poNumber}
          subtitle={`${selPo.productName} · SL ${fmt(selPo.soLuong)} · báo lúc ${timeVN(selPo.deadline)}`}
          backLabel="Quay lại danh sách lệnh"
          onBack={() => setSelPoId(null)}
          onReview={(line, p, ref) => onReview(selPo.id, line, p, ref)}
          onOpenReview={onOpenReview ? (line => onOpenReview(selPo.id, line)) : undefined}
          onReload={onReload}
          showToast={showToast}
          onEditPhoto={onEditPhoto}
          onDeletePhoto={onDeletePhoto}
        />
      ) : (
        <KcsPoListBoard rows={rows} cfg={cfg} notice={notice} onEnter={id => setSelPoId(id)} />
      )}
      {toastEl}
    </>
  )
}

// ── styles (modal) ───────────────────────────────────────────────────
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }
const card: React.CSSProperties = { width: 440, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }

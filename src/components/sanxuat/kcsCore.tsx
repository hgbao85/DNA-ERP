'use client'

/**
 * CORE dùng chung cho màn KCS duyệt (Phôi / Hàn / Sơn, đều 2 tầng: PO → Vật liệu) — chỉ xem + duyệt, không nhập sản lượng.
 * Phôi chưa có "mảnh" (mảnh chỉ hình thành từ công đoạn Hàn trở đi) nên dùng chung orchestrator 2 tầng với Hàn/Sơn.
 * Tái dùng types/helpers/orchestrator-shell từ `core.tsx`; thêm "chờ kiểm" + duyệt đạt/không đạt (số lượng + nguyên nhân + ảnh).
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend, giống các màn Lệnh sản xuất khác.
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
  type ProcLine, type ProcRow, type StageCfg,
  fmt, dateVN, timeVN, lechOf,
} from './core'

const ACCENT = '#e65100'

// ── Types ──────────────────────────────────────────────────────────
export interface KcsLine extends ProcLine {
  pendingQty: number          // chờ kiểm — SL vừa báo, chưa duyệt
  approvedQty?: number        // SL đã KCS duyệt ĐẠT (lô DA_CAT)
  /** Tổng không đạt CỘNG DỒN LỊCH SỬ qua các lần duyệt (2026-09-08 lần 2, xem changelog "Bù đủ dồn
   *  về bảng tổng") - KHÔNG tự giảm khi tổ bù đủ (Bù đủ = 1 lô HOÀN TOÀN MỚI gửi duyệt lại, không
   *  sửa lại con số này). */
  failedQty?: number
  defectReason?: string
  reviewNote?: string
  defectPhotoUrl?: string
  history?: AuditLogEntry[]   // lịch sử lô (xuất → báo → duyệt) dựng từ data thật để hiện timeline
}
export interface KcsRow extends Omit<ProcRow, 'manhs' | 'lines'> { lines?: KcsLine[] }

interface DefectReason { id: number; label: string; stageType?: string | null }

export interface ReviewPayload { failedQty: number; defectReasonId?: number; reviewNote?: string; defectPhotoUrl?: string }

const allKcsLines = (r: KcsRow): KcsLine[] => r.lines ?? []
const pendingOf = (lines: KcsLine[]) => lines.reduce((s, l) => s + l.pendingQty, 0)

// ── Modal duyệt: nhập SL không đạt + nguyên nhân + ảnh (số còn lại tự tính đạt) - CHỈ 2 kết quả
// Đạt/Không đạt (2026-09-08 lần 2, xem changelog "Bù đủ dồn về bảng tổng") - bỏ hẳn phân loại "Sửa
// được/Phế" (đã đơn giản hoá bước duyệt theo công đoạn từ 2026-09-07, giờ đồng bộ luôn bước "Chốt &
// gửi KCS" cuối cùng dùng chung Hàn/Sơn/VTTP). ─────────────────────────────────────────────────
function KcsReviewModal({ stageType, line, onClose, onSubmit }: {
  stageType: string; line: KcsLine; onClose: () => void; onSubmit: (p: ReviewPayload) => Promise<void>
}) {
  const { data: reasons, refetch } = useFetch<DefectReason[]>(() => api.getDefectReasons(stageType), [stageType])
  const list = Array.isArray(reasons) ? reasons : []

  const [failedQty, setFailedQty] = useState('0')
  const [reasonId, setReasonId] = useState<number | ''>('')
  const [reviewNote, setReviewNote] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  // busy (2026-09-11, QA audit): trước đây submit() đồng bộ, đóng modal NGAY khi bấm - không chờ
  // biết API có thành công không (fire-and-forget ở KcsTwoTierScreen.review()). Lỗi backend (vd PI
  // đã "Kết thúc"/"Tạm dừng") chỉ hiện alert() vài trăm ms SAU khi modal đã đóng và mất hết dữ liệu
  // vừa nhập (nguyên nhân/ghi chú/ảnh) - mirror KcsPhoiPage.tsx's QcReviewModal.submit() (đã làm
  // đúng: await, chỉ đóng khi thành công, lỗi hiện inline + giữ nguyên form).
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const failed = Math.max(0, Math.min(line.pendingQty, Math.floor(Number(failedQty) || 0)))
  const passed = line.pendingQty - failed

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
    try { setPhotoUrl(await api.uploadContractFile(file)) }
    catch { setErr('Tải ảnh thất bại') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    if (failed > 0 && !reasonId) { setErr('Có SL không đạt → phải chọn nguyên nhân'); return }
    setBusy(true); setErr('')
    try {
      await onSubmit({ failedQty: failed, defectReasonId: reasonId ? Number(reasonId) : undefined, reviewNote: reviewNote || undefined, defectPhotoUrl: photoUrl || undefined })
      onClose()
    } catch (e) { setErr(errMsg(e, 'Không duyệt được')) }
    finally { setBusy(false) }
  }

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Tiến hành duyệt — {line.itemName}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Chờ duyệt: <b style={{ color: 'var(--text)' }}>{fmt(line.pendingQty)}</b></div>

        <label style={lbl}>Số lượng chưa đạt</label>
        <input type="number" min={0} max={line.pendingQty} value={failedQty}
          onChange={e => setFailedQty(e.target.value)} style={inp} autoFocus />
        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
          Đạt: <b style={{ color: 'var(--green)' }}>{fmt(passed)}</b> · Không đạt: <b style={{ color: failed > 0 ? '#c62828' : 'var(--text3)' }}>{fmt(failed)}</b>
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
              placeholder="+ Thêm loại lỗi mới…" style={{ ...inp, marginTop: 0, flex: 1 }} />
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

        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 10 }}>{err}</div>}

        <div style={{
          position: 'sticky', bottom: -20, display: 'flex', gap: 8, justifyContent: 'flex-end',
          margin: '16px -20px -20px', padding: '12px 20px',
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
        }}>
          <button onClick={onClose} style={btnGhost} disabled={busy}>Hủy</button>
          <button onClick={submit} disabled={uploading || busy} style={btnPrimary}>{busy ? 'Đang duyệt…' : 'Xác nhận duyệt'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Popup lịch sử (read-only) — gộp mọi đợt của PO, xem không cần vào luồng duyệt ─────
function KcsHistoryModal({ title, entries, onClose }: { title: ReactNode; entries: AuditLogEntry[]; onClose: () => void }) {
  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, width: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Lịch sử — {title}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <AuditLogTimeline entries={entries} title="Diễn biến các đợt" />
      </div>
    </div>
  )
}

// ── Tầng: Vật tư — chờ duyệt / tiến hành duyệt (dùng chung Phôi/Hàn/Sơn) ─────
function KcsVatTuReviewBoard({ lines, cfg, title, subtitle, backLabel, onBack, onReview }: {
  lines: KcsLine[]; cfg: StageCfg; title: string; subtitle: string; backLabel: string
  onBack: () => void; onReview: (lineId: number, p: ReviewPayload) => Promise<void>
}) {
  const [target, setTarget] = useState<KcsLine | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const lech = lechOf(lines)
  // Lịch sử gộp cả PO: mọi đợt của mọi vật liệu, xếp theo thời gian.
  const poHistory = lines.flatMap(l => l.history ?? []).sort((a, b) => a.at.localeCompare(b.at))

  const cols: BoardColumn<KcsLine>[] = [
    { key: 'item', header: 'Vật liệu', cell: l => <span style={{ fontWeight: 600 }}>{l.itemName}</span> },
    { key: 'spec', header: 'Quy cách', cell: l => <span style={{ color: 'var(--text3)' }}>{l.spec}</span> },
    {
      key: 'pending', header: 'Chờ duyệt', align: 'right', cell: l => l.pendingQty > 0
        ? <span style={{ fontWeight: 700, color: ACCENT }}>{fmt(l.pendingQty)}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>
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
        ? <span style={{ fontWeight: 700, color: '#c62828' }}>{fmt(l.failedQty)}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>,
    },
    {
      key: 'action', header: '', width: 150, cell: l => {
        if (l.pendingQty > 0) return (
          <div onClick={e => e.stopPropagation()}>
            <button onClick={() => setTarget(l)} className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
              <ClipboardCheck size={13} /> Tiến hành duyệt
            </button>
          </div>
        )
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
        beforeTable={lech ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', margin: '14px 0 0', borderRadius: 'var(--radius)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: 13 }}>
            <AlertTriangle size={16} /> Các {cfg.itemLabel.toLowerCase()} chưa cân đối sản lượng — đối chiếu trước khi duyệt hết.
          </div>
        ) : undefined}
        columns={cols}
        rows={lines}
        rowKey={l => l.id}
        rowTone={l => l.pendingQty > 0 ? 'alert' : 'default'}
      />
      {target && (
        <KcsReviewModal
          stageType={cfg.label === 'Phôi' ? 'PHOI' : cfg.label === 'Hàn' ? 'HAN' : 'SON'}
          line={target}
          onClose={() => setTarget(null)}
          onSubmit={p => onReview(target.id, p)}
        />
      )}
      {showHistory && <KcsHistoryModal title={title} entries={poHistory} onClose={() => setShowHistory(false)} />}
    </>
  )
}

// ── Tầng 1: hàng đợi KCS theo lô/SKU — chờ kiểm + đã duyệt + lỗi ──
interface KcsPoView { r: KcsRow; soLoCho: number; choKiem: number; daDuyet: number; loi: number }

function KcsPoListBoard({ rows, cfg, onEnter }: { rows: KcsRow[]; cfg: StageCfg; onEnter: (id: number) => void }) {
  const views: KcsPoView[] = rows.map(r => {
    const ls = allKcsLines(r)
    return {
      r,
      soLoCho: ls.filter(l => l.pendingQty > 0).length,
      choKiem: pendingOf(ls),
      daDuyet: ls.reduce((s, l) => s + (l.approvedQty ?? 0), 0),
      loi: ls.reduce((s, l) => s + (l.failedQty ?? 0), 0),
    }
  })

  const unit = <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text3)' }}>{cfg.unit}</span>
  // "SKU nhà máy" (cột cũ) đã bỏ (2026-09-08) - BE chưa từng trả mã SKU thật cho ProductionBatch/
  // PieceStepBundle, cột đó chỉ lặp lại đúng giá trị cột "PI" (r.sku bị gán tạm = poNumber ở
  // KcsStagePage.tsx) - phát hiện khi người dùng hỏi "sao SKU lại trống".
  const cols: BoardColumn<KcsPoView>[] = [
    { key: 'po', header: 'PI', cell: v => <span style={{ fontWeight: 700 }}>{v.r.poNumber}</span> },
    {
      key: 'soLo', header: 'Số lô chờ kiểm', align: 'right', cell: v => (
        <span style={{ fontWeight: 700, color: v.soLoCho > 0 ? ACCENT : 'var(--text3)' }}>{fmt(v.soLoCho)}</span>
      )
    },
    {
      key: 'pending', header: 'Tổng SL chờ kiểm', align: 'right', cell: v => (
        <span style={{ fontWeight: 700, color: v.choKiem > 0 ? ACCENT : 'var(--text3)' }}>{fmt(v.choKiem)} {unit}</span>
      )
    },
    {
      key: 'daDuyet', header: 'Đã duyệt', align: 'right', cell: v => v.daDuyet > 0
        ? <span style={{ fontWeight: 700, color: 'var(--green)' }}>{fmt(v.daDuyet)} {unit}</span>
        : <span style={{ color: 'var(--text3)' }}>—</span>
    },
    {
      key: 'loi', header: 'Lỗi', align: 'right', cell: v => v.loi > 0
        ? <span style={{ fontWeight: 700, color: '#c62828' }}>{fmt(v.loi)} {unit}</span>
        : <span style={{ color: 'var(--text3)' }}>0</span>
    },
    { key: 'reportedAt', header: 'Báo lúc', cell: v => timeVN(v.r.deadline) },
  ]

  const Icon = cfg.Icon
  return (
    <LenhSanXuatBoard<KcsPoView>
      icon={<Icon size={18} />}
      title={`Màn hình KCS — Công đoạn ${cfg.label}`}
      subtitle="Kiểm tra chất lượng theo PI — bấm vào dòng có hàng chờ kiểm để duyệt."
      columns={cols}
      rows={views}
      rowKey={v => v.r.id}
      rowTone={v => v.choKiem > 0 ? 'alert' : 'default'}
      clickable={() => true}
      onRowClick={v => onEnter(v.r.id)}
      rowTitle={v => v.choKiem > 0 ? `Có ${fmt(v.choKiem)} chờ kiểm — nhấn để duyệt` : 'Nhấn để xem chi tiết'}
    />
  )
}

// ── Orchestrator: KCS Phôi/Hàn/Sơn (2 tầng) ─────────────────────────
// 2 chế độ:
//  - Mock cục bộ: truyền `seed` (Hàn/Sơn hiện tại — chưa nối store).
//  - Controlled:  truyền `rows` + `onReview` (Phôi — đọc/ghi phoi-sat.service thật).
export function KcsTwoTierScreen({ cfg, seed, rows: rowsProp, onReview }: {
  cfg: StageCfg
  seed?: () => KcsRow[]
  rows?: KcsRow[]
  onReview?: (poId: number, lineId: number, p: ReviewPayload) => Promise<void>
}) {
  const controlled = !!onReview
  const [localRows, setLocalRows] = useState<KcsRow[]>(() => seed ? seed() : [])
  const rows = rowsProp ?? localRows
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

  // 2026-09-11 (QA audit): PHẢI await xong onReview (controlled/thật) trước khi báo "đã duyệt" -
  // trước đây hiện toast NGAY rồi mới gọi onReview không await (fire-and-forget), nên khi BE từ
  // chối (vd PI đã "Kết thúc"/"Tạm dừng"), toast xanh "đã duyệt" đã hiện xong xuôi trước khi alert
  // lỗi xuất hiện vài trăm ms sau - mâu thuẫn, và modal (KcsReviewModal) đã đóng luôn nên mất hết dữ
  // liệu vừa nhập. Giờ review() chờ xong (hoặc ném lại lỗi cho modal tự hiện inline) rồi mới toast.
  const review = async (poId: number, lineId: number, p: ReviewPayload) => {
    if (controlled) { await onReview!(poId, lineId, p) }
    const line = rows.flatMap(r => r.lines ?? []).find(l => l.id === lineId)
    if (line) {
      const failed = Math.min(line.pendingQty, p.failedQty)
      const passed = line.pendingQty - failed
      const parts = [`${fmt(passed)} đạt`]
      if (failed > 0) parts.push(`${fmt(failed)} không đạt`)
      showToast(`Đã duyệt ${line.itemName}: ${parts.join(' · ')}`)
    }
    if (controlled) return
    setLocalRows(rs => rs.map(r => r.id !== poId ? r : {
      ...r, lines: r.lines?.map(l => l.id !== lineId ? l : {
        ...l, pendingQty: 0, failedQty: (l.failedQty ?? 0) + p.failedQty,
        defectReason: p.defectReasonId ? String(p.defectReasonId) : l.defectReason,
        reviewNote: p.reviewNote ?? l.reviewNote, defectPhotoUrl: p.defectPhotoUrl ?? l.defectPhotoUrl,
      }),
    }))
  }

  const toastEl = toast && (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1200,
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
      background: '#1f2937', color: '#fff', borderRadius: 10, fontSize: 13,
      boxShadow: '0 8px 24px rgba(0,0,0,.25)', maxWidth: 'calc(100vw - 32px)',
    }}>
      <Check size={16} color="#4ade80" />
      <span>{toast}</span>
      <button onClick={() => setToast(null)} style={{ padding: 2, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#9ca3af' }} title="Đóng">
        <X size={15} />
      </button>
    </div>
  )

  return (
    <>
      {selPo ? (
        <KcsVatTuReviewBoard
          lines={selPo.lines ?? []} cfg={cfg}
          title={selPo.poNumber}
          subtitle={`${selPo.productName} · SL ${fmt(selPo.soLuong)} · hạn ${dateVN(selPo.deadline)}`}
          backLabel="Quay lại danh sách lệnh"
          onBack={() => setSelPoId(null)}
          onReview={(lineId, p) => review(selPo.id, lineId, p)}
        />
      ) : (
        <KcsPoListBoard rows={rows} cfg={cfg} onEnter={id => setSelPoId(id)} />
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

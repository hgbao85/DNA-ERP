'use client'

/**
 * CORE dùng chung cho màn KCS duyệt (Phôi / Hàn / Sơn, đều 2 tầng: PO → Vật liệu) — chỉ xem + duyệt, không nhập sản lượng.
 * Phôi chưa có "mảnh" (mảnh chỉ hình thành từ công đoạn Hàn trở đi) nên dùng chung orchestrator 2 tầng với Hàn/Sơn.
 * Tái dùng types/helpers/orchestrator-shell từ `core.tsx`; thêm "chờ kiểm" + duyệt đạt/không đạt (số lượng + nguyên nhân + ảnh).
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend, giống các màn Lệnh sản xuất khác.
 */

import { useState } from 'react'
import { ClipboardCheck, AlertTriangle, Upload, X, Plus } from 'lucide-react'
import LenhSanXuatBoard, { type BoardColumn } from './LenhSanXuatBoard'
import { useFetch } from '../../hooks/useFetch'
import * as api from '../../services/api'
import {
  type ProcLine, type ProcRow, type StageCfg,
  fmt, dateVN, lechOf, skuDongBo,
} from './core'

const ACCENT = '#e65100'

// ── Types ──────────────────────────────────────────────────────────
export interface KcsLine extends ProcLine {
  pendingQty: number          // chờ kiểm — SL vừa báo, chưa duyệt
  failedQty?: number          // tổng SL không đạt đã phát hiện qua các lần duyệt
  defectReason?: string
  reviewNote?: string
  defectPhotoUrl?: string
}
export interface KcsRow extends Omit<ProcRow, 'manhs' | 'lines'> { lines?: KcsLine[] }

interface DefectReason { id: number; label: string; stageType?: string | null }

export interface ReviewPayload { failedQty: number; defectReasonId?: number; reviewNote?: string; defectPhotoUrl?: string }

const allKcsLines = (r: KcsRow): KcsLine[] => r.lines ?? []
const pendingOf = (lines: KcsLine[]) => lines.reduce((s, l) => s + l.pendingQty, 0)

function Progress({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'var(--green)' : pct >= 50 ? ACCENT : '#b45309'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width .2s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, width: 34, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

// ── Modal duyệt: nhập SL không đạt + nguyên nhân + ảnh (số còn lại tự tính đạt) ──
function KcsReviewModal({ stageType, line, onClose, onSubmit }: {
  stageType: string; line: KcsLine; onClose: () => void; onSubmit: (p: ReviewPayload) => void
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

  const submit = () => {
    if (failed > 0 && !reasonId) { setErr('Có SL không đạt → phải chọn nguyên nhân'); return }
    onSubmit({ failedQty: failed, defectReasonId: reasonId ? Number(reasonId) : undefined, reviewNote: reviewNote || undefined, defectPhotoUrl: photoUrl || undefined })
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

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={uploading} style={btnPrimary}>Xác nhận duyệt</button>
        </div>
      </div>
    </div>
  )
}

// ── Tầng: Vật tư — chờ duyệt / tiến hành duyệt (dùng chung Phôi/Hàn/Sơn) ─────
function KcsVatTuReviewBoard({ lines, cfg, title, subtitle, backLabel, onBack, onReview }: {
  lines: KcsLine[]; cfg: StageCfg; title: string; subtitle: string; backLabel: string
  onBack: () => void; onReview: (lineId: number, p: ReviewPayload) => void
}) {
  const [target, setTarget] = useState<KcsLine | null>(null)
  const lech = lechOf(lines)

  const cols: BoardColumn<KcsLine>[] = [
    { key: 'item', header: 'Vật liệu', cell: l => <>
      <span style={{ fontWeight: 600 }}>{l.itemName}</span>
      {!!l.failedQty && <span style={{ color: '#c62828', fontSize: 11, marginLeft: 6 }}>lỗi {fmt(l.failedQty)}</span>}
    </> },
    { key: 'spec', header: 'Quy cách', cell: l => <span style={{ color: 'var(--text3)' }}>{l.spec}</span> },
    { key: 'pending', header: 'Chờ duyệt', align: 'right', cell: l => (
      <span style={{ fontWeight: 700, color: l.pendingQty > 0 ? ACCENT : 'var(--text3)' }}>{fmt(l.pendingQty)}</span>
    ) },
    { key: 'action', header: '', width: 150, cell: l => l.pendingQty > 0 ? (
      <div onClick={e => e.stopPropagation()}>
        <button onClick={() => setTarget(l)} className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', fontSize: 12 }}>
          <ClipboardCheck size={13} /> Tiến hành duyệt
        </button>
      </div>
    ) : <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span> },
  ]

  return (
    <>
      <LenhSanXuatBoard<KcsLine>
        onBack={onBack} backLabel={backLabel}
        title={title} subtitle={subtitle}
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
          onSubmit={p => { onReview(target.id, p); setTarget(null) }}
        />
      )}
    </>
  )
}

// ── Tầng 1: danh sách lệnh (PO) — xem tiến độ + chờ kiểm ────────────
interface KcsPoView { r: KcsRow; daLam: number; conLai: number; pct: number; choKiem: number }

function KcsPoListBoard({ rows, cfg, onEnter }: { rows: KcsRow[]; cfg: StageCfg; onEnter: (id: number) => void }) {
  const views: KcsPoView[] = rows.map(r => {
    const daLam = skuDongBo(r)
    const pct = r.soLuong > 0 ? Math.round((daLam / r.soLuong) * 100) : 0
    return { r, daLam, conLai: r.soLuong - daLam, pct, choKiem: pendingOf(allKcsLines(r)) }
  })

  const cols: BoardColumn<KcsPoView>[] = [
    { key: 'po', header: 'Lô', cell: v => <span style={{ fontWeight: 700 }}>{v.r.poNumber}</span> },
    { key: 'sku', header: 'SKU nhà máy', cell: v => v.r.sku },
    { key: 'sl', header: 'Số lượng', align: 'right', cell: v => fmt(v.r.soLuong) },
    { key: 'done', header: cfg.done, align: 'right', cell: v => fmt(v.daLam) },
    { key: 'pending', header: 'Chờ kiểm', align: 'right', cell: v => (
      <span style={{ fontWeight: 700, color: v.choKiem > 0 ? ACCENT : 'var(--text3)' }}>{fmt(v.choKiem)}</span>
    ) },
    { key: 'remain', header: 'Còn lại', align: 'right', cell: v => <span style={{ color: v.conLai > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(v.conLai)}</span> },
    { key: 'progress', header: 'Tiến độ', width: 160, cell: v => <Progress pct={v.pct} /> },
    { key: 'deadline', header: 'Deadline', cell: v => dateVN(v.r.deadline) },
  ]

  const Icon = cfg.Icon
  return (
    <LenhSanXuatBoard<KcsPoView>
      icon={<Icon size={18} />}
      title={`Màn hình KCS — Công đoạn ${cfg.label}`}
      subtitle="Kiểm tra chất lượng theo lô/SKU — bấm vào dòng có hàng chờ kiểm để duyệt."
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
export function KcsTwoTierScreen({ cfg, seed }: { cfg: StageCfg; seed: () => KcsRow[] }) {
  const [rows, setRows] = useState<KcsRow[]>(seed)
  const [selPoId, setSelPoId] = useState<number | null>(null)
  const selPo = rows.find(r => r.id === selPoId) ?? null

  const review = (poId: number, lineId: number, p: ReviewPayload) =>
    setRows(rs => rs.map(r => r.id !== poId ? r : {
      ...r, lines: r.lines?.map(l => l.id !== lineId ? l : {
        ...l, pendingQty: 0, failedQty: (l.failedQty ?? 0) + p.failedQty,
        defectReason: p.defectReasonId ? String(p.defectReasonId) : l.defectReason,
        reviewNote: p.reviewNote ?? l.reviewNote, defectPhotoUrl: p.defectPhotoUrl ?? l.defectPhotoUrl,
      }),
    }))

  if (selPo) {
    return <KcsVatTuReviewBoard
      lines={selPo.lines ?? []} cfg={cfg}
      title={`${selPo.poNumber} · ${selPo.sku}`}
      subtitle={`${selPo.productName} · SL ${fmt(selPo.soLuong)} · hạn ${dateVN(selPo.deadline)}`}
      backLabel="Quay lại danh sách lệnh"
      onBack={() => setSelPoId(null)}
      onReview={(lineId, p) => review(selPo.id, lineId, p)}
    />
  }
  return <KcsPoListBoard rows={rows} cfg={cfg} onEnter={id => setSelPoId(id)} />
}

// ── styles (modal) ───────────────────────────────────────────────────
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }
const card: React.CSSProperties = { width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.25)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '12px 0 4px', fontWeight: 600 }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const iconBtn: React.CSSProperties = { padding: 4, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }

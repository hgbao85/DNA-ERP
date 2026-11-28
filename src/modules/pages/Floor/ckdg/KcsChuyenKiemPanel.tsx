'use client'

/**
 * Màn KCS CHUYỀN KIỂM (24/11/2026, docs THIET-KE-CHUYEN-KIEM-DONG-GOI-QR C2, C4) - tài khoản riêng vai "KCS chuyền kiểm" (mfgRole
 * KCS_CHUYEN_KIEM, đăng nhập PIN ở /floor). Cùng cách chấm của KCS Phôi / Hàn / Sơn (KcsStagePage): mỗi đợt công nhân chuyền kiểm báo
 * -> KCS chấm số đạt thật (không quá số báo đạt), phần lỗi là làm lại. Chỉ khi chấm, số đạt mới tính "đã qua chuyền kiểm".
 * Đợt 2 lượt 3 (28/11/2026): câu 9a bỏ ô "Bỏ" (hỏng thì chấm làm lại, người phụ trách đan mang trả điểm đan sửa); câu 10 KCS tự
 * thêm nguyên nhân lỗi ngay trên form chấm.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera } from 'lucide-react'
import {
  addCkDefectReason, getKcsCkBatches, gradeCkBatch, type CkBatch, type CkBatchStatus, type CkDefectReason,
} from '../../../../services/ck-dg-api'
import { uploadImage } from '../../../../services/uploads-api'
import { describeError, hhmm } from '../floorUi'
import { errText, fmtQty } from '../scan/scanModel'
import { Banner, ConfirmSheet } from '../scan/ScanParts'
import {
  btn, card, chip, chipRow, column, fieldInput, hint, label, loadingText, numInput, pickChip, tabColumn,
} from '../scan/scanUi'
import {
  batchKcsText, batchReportText, kcsDefaults, kcsExtraDefect, kcsGradeCheck, kcsSetPassed, toQty, type KcsGrade,
} from './ckDgModel'

const dayTime = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Photos({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null
  return (
    <div style={chipRow}>
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" aria-label="Xem ảnh lỗi">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary công nhân chụp */}
          <img src={u} alt="Ảnh lỗi" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
        </a>
      ))}
    </div>
  )
}

function BatchCard({ b, onGrade }: { b: CkBatch; onGrade?: () => void }) {
  return (
    <div style={{ ...card, ...column(8) }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
        <div style={{ fontSize: 17, fontWeight: 700 }}>{b.lenhCode} · {b.sku}</div>
        <div style={hint}>{dayTime(b.reportedAt)}</div>
      </div>
      <div style={{ fontSize: 15 }}><b>{b.pieceName}</b> · {b.productName}</div>
      <div style={hint}>{b.reportedByName ?? '—'} · {b.workstationCode}{b.warehouseName ? ` · ${b.warehouseName}` : ''}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{batchReportText(b)}</div>
      {b.note && <div style={hint}>Ghi chú: {b.note}</div>}
      <Photos urls={b.photoUrls} />
      {b.kcs ? (
        <div style={{ ...hint, color: 'var(--text)' }}>
          {batchKcsText(b)}{b.kcs.defectReason ? ` · ${b.kcs.defectReason}` : ''} · {b.kcs.reviewedByName ?? ''}{b.kcs.reviewedAt ? ` ${dayTime(b.kcs.reviewedAt)}` : ''}
        </div>
      ) : onGrade && (
        <button type="button" style={btn(true)} onClick={onGrade}>Chấm đợt này</button>
      )}
    </div>
  )
}

/** Câu 10: KCS gõ nguyên nhân mới -> lưu vào danh mục chuyền kiểm, chọn luôn cho đợt đang chấm. */
function AddReason({ onAdded }: { onAdded: (r: CkDefectReason, all: CkDefectReason[]) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const okText = text.trim().length >= 2
  const save = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await addCkDefectReason(text.trim())
      onAdded(r.reason, r.defectReasons)
      setText(''); setOpen(false)
    } catch (e) { setErr(describeError(e).text) } finally { setBusy(false) }
  }
  if (!open) {
    return <button type="button" style={pickChip(false)} onClick={() => setOpen(true)}>+ Thêm nguyên nhân mới</button>
  }
  return (
    <div style={column(6)}>
      <input aria-label="Nguyên nhân lỗi mới" value={text} maxLength={100} placeholder="Vd: Đan lỏng, khung cong…"
        style={fieldInput} onChange={(e) => setText(e.target.value)} />
      {err && <Banner tone="err">{err}</Banner>}
      <div style={chipRow}>
        <button type="button" disabled={!okText || busy} style={pickChip(true)} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu nguyên nhân'}</button>
        <button type="button" disabled={busy} style={pickChip(false)} onClick={() => { setOpen(false); setText(''); setErr(null) }}>Huỷ</button>
      </div>
    </div>
  )
}

function GradeForm({ b, reasons, onReasons, onDone, onCancel }: {
  b: CkBatch
  reasons: CkDefectReason[]
  onReasons: (all: CkDefectReason[]) => void
  onDone: (text: string) => void
  onCancel: () => void
}) {
  const [g, setG] = useState<KcsGrade>(() => kcsDefaults(b))
  const [reasonId, setReasonId] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const extra = kcsExtraDefect(b, g.passed)
  const check = kcsGradeCheck(b, g, reasonId || null, busy || uploading)
  const total = b.passedQty + b.defectQty

  const addPhoto = async (f: File) => {
    setUploading(true); setErr(null)
    try { setPhoto(await uploadImage(f)) } catch (e) { setErr(errText(e)) } finally { setUploading(false) }
  }
  const save = async () => {
    setBusy(true); setErr(null)
    try {
      await gradeCkBatch(b.id, {
        passedQty: g.passed, reworkQty: g.rework, scrapQty: g.scrap,
        ...(reasonId ? { defectReasonId: reasonId } : {}), ...(photo ? { photoUrl: photo } : {}),
      })
      onDone(`Đã chấm ${b.lenhCode} · ${b.pieceName}: đạt ${g.passed}${g.rework ? `, làm lại ${g.rework}` : ''} · ${hhmm()}`)
    } catch (e) {
      setErr(describeError(e).text); setBusy(false); setConfirming(false)
    }
  }

  return (
    <div style={tabColumn}>
      <BatchCard b={b} />
      <div style={{ ...card, ...column(14) }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={column(6)}><span style={label}>Đạt</span>
            <input aria-label="Số đạt KCS" inputMode="numeric" value={String(g.passed)} style={{ ...numInput, width: '100%' }}
              onChange={(e) => setG(kcsSetPassed(b, g, toQty(e.target.value)))} /></label>
          <div style={column(6)}><span style={label}>Làm lại</span>
            <div aria-label="Số làm lại" style={{ ...numInput, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface2)' }}>{fmtQty(g.rework)}</div></div>
        </div>
        <div style={hint}>Tổng phải bằng số công nhân báo ({fmtQty(total)}). Đạt không quá số báo đạt ({fmtQty(b.passedQty)}). Làm lại = về lại hàng chờ kiểm; hàng hỏng thì người phụ trách đan mang trả điểm đan / tổ sửa, sửa xong công nhân báo lại.</div>
        {extra > 0 && (
          <>
            <label style={column(6)}><span style={label}>Nguyên nhân {fmtQty(extra)} lỗi KCS phát hiện thêm</span>
              <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} style={fieldInput} aria-label="Nguyên nhân lỗi KCS">
                <option value="">- Chọn nguyên nhân -</option>
                {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select></label>
            <AddReason onAdded={(r, all) => { onReasons(all); setReasonId(r.id) }} />
            <div style={{ ...chipRow, alignItems: 'center' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh KCS vừa chụp */}
              {photo && <img src={photo} alt="Ảnh lỗi KCS" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} />}
              <button type="button" disabled={uploading} style={pickChip(false)} onClick={() => fileRef.current?.click()}>
                <Camera size={18} aria-hidden /> {uploading ? 'Đang tải ảnh…' : photo ? 'Chụp lại' : 'Chụp ảnh (tuỳ chọn)'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addPhoto(f) }} />
            </div>
          </>
        )}
        {err && <Banner tone="err">{err}</Banner>}
        {check.reason && !check.ok && <div style={{ ...hint, fontWeight: 600 }}>{check.reason}</div>}
        <button type="button" disabled={!check.ok} style={btn(true, !check.ok)} onClick={() => setConfirming(true)}>Lưu kết quả chấm</button>
        <button type="button" style={btn(false)} onClick={onCancel}>Quay lại danh sách</button>
      </div>
      {confirming && (
        <ConfirmSheet title="Xác nhận KCS chuyền kiểm" context={`${b.lenhCode} · ${b.sku} · ${b.pieceName}`}
          rows={[
            { label: 'Đạt (tính đã qua chuyền kiểm)', value: fmtQty(g.passed) },
            { label: 'Làm lại', value: fmtQty(g.rework) },
          ]}
          confirmLabel="Đúng, lưu" busy={busy} onConfirm={() => void save()} onCancel={() => setConfirming(false)} />
      )}
    </div>
  )
}

export default function KcsChuyenKiemPanel() {
  const [status, setStatus] = useState<CkBatchStatus>('AWAITING_KCS')
  const [data, setData] = useState<{ enabled: boolean; batches: CkBatch[]; defectReasons: CkDefectReason[] } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [grading, setGrading] = useState<CkBatch | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const load = useCallback(async (s: CkBatchStatus) => {
    try { setData(await getKcsCkBatches(s)); setErr(null) } catch (e) { setErr(errText(e)) }
  }, [])
  // Tải danh sách khi mở / đổi tab - setState chỉ xảy ra sau khi request trả về.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(status) }, [load, status])
  // Màn treo ở xưởng: tự tải lại mỗi phút để thấy đợt mới.
  useEffect(() => {
    const t = setInterval(() => { if (!grading) void load(status) }, 60_000)
    return () => clearInterval(t)
  }, [load, status, grading])

  if (err) return <div style={{ marginTop: 16 }}><Banner tone="err">{err}</Banner></div>
  if (!data) return <div style={{ marginTop: 24, ...loadingText }}>Đang tải…</div>
  if (!data.enabled) return <div style={{ marginTop: 16 }}><Banner tone="info">Chuyền kiểm bằng quét QR chưa bật.</Banner></div>
  if (grading) {
    return (
      <GradeForm b={grading} reasons={data.defectReasons} onCancel={() => setGrading(null)}
        onReasons={(all) => setData((d) => (d ? { ...d, defectReasons: all } : d))}
        onDone={(text) => { setGrading(null); setFlash(text); void load(status) }} />
    )
  }
  return (
    <div style={tabColumn}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>KCS chuyền kiểm</h2>
        <div style={hint}>Chấm các đợt công nhân chuyền kiểm vừa báo. Số đạt chỉ tính “đã qua chuyền kiểm” sau khi chấm.</div>
      </div>
      {flash && <Banner tone="ok">{flash}</Banner>}
      <div style={chipRow} role="tablist">
        {([['AWAITING_KCS', `Chờ chấm${status === 'AWAITING_KCS' ? ` (${data.batches.length})` : ''}`], ['KCS_DONE', 'Đã chấm']] as const).map(([s, t]) => (
          <button key={s} type="button" role="tab" aria-selected={status === s} style={chip(status === s)} onClick={() => { setFlash(null); setStatus(s) }}>{t}</button>
        ))}
      </div>
      {data.batches.length === 0 ? (
        <Banner tone="info">{status === 'AWAITING_KCS' ? 'Không có đợt nào chờ chấm.' : 'Chưa chấm đợt nào.'}</Banner>
      ) : data.batches.map((b) => (
        <BatchCard key={b.id} b={b} onGrade={status === 'AWAITING_KCS' ? () => { setFlash(null); setGrading(b) } : undefined} />
      ))}
    </div>
  )
}

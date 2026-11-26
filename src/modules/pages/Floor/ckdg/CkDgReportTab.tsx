'use client'

/**
 * Màn quét của công nhân CHUYỀN KIỂM / ĐÓNG GÓI (24/11/2026, docs THIET-KE-CHUYEN-KIEM-DONG-GOI-QR C1, D1). Tem dán ở điểm chuyền kiểm /
 * khu đóng gói của 1 kho Thành phẩm = link `/floor?ws=<qrToken>` (cùng tem máy của Phôi / Hàn / Sơn).
 *  - Chuyền kiểm: chọn lệnh -> chọn mảnh -> nhập số đạt, số lỗi; có lỗi thì chọn nguyên nhân + chụp ảnh. Lưu = 1 đợt chờ KCS chuyền
 *    kiểm chấm (chưa tính "đã qua chuyền kiểm").
 *  - Đóng gói: chọn lệnh -> nhập số bộ đã đóng (chỉ đóng được số bộ đã qua KCS chuyền kiểm). Tính luôn, thủ kho đối chiếu.
 *    Vị trí kho bật (25/11/2026, VI_TRI_KHO): phải quét tem ô cất thùng - báo đóng gói = cất vào ô đó; ô đang có lệnh / SKU / PO khác
 *    thì nhắc nhẹ (không chặn).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, MapPin, X } from 'lucide-react'
import {
  getCkDgScan, reportCkBatch, reportPacking, type CkDgScanContext, type CkPiece, type CkBatch, type DgReport,
} from '../../../../services/ck-dg-api'
import { uploadImage } from '../../../../services/uploads-api'
import { scanFloorLocation, type VtkScannedLocation } from '../../../../services/vi-tri-kho-api'
import { dgLocationCheck, tripleText } from '../../InboundWarehouse/viTriKho/viTriKhoModel'
import QrScanner from '../scan/QrScanner'
import type { FloorQr } from '../scan/qrScan'
import { useRetrySafeKey } from '../../../../hooks/useRetrySafeKey'
import { ApiError } from '../../../../services/core/apiError'
import { describeError, hhmm } from '../floorUi'
import { errText, fmtQty } from '../scan/scanModel'
import { ActionBar, Banner, ConfirmSheet } from '../scan/ScanParts'
import {
  card, cardFlush, chipRow, column, divider, fieldInput, hint, label, loadingText, numInput, pickChip, tabColumn,
} from '../scan/scanUi'
import { batchKcsText, batchReportText, ckReportCheck, isCkBatch, packingCheck, toQty } from './ckDgModel'

type Ready = Extract<CkDgScanContext, { enabled: true }>
type Flash = { tone: 'ok' | 'err' | 'warn'; text: string }

function Tiles({ tiles }: { tiles: [string, number, string?][] }) {
  return (
    <div style={{ ...card, padding: 12, display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, 1fr)`, gap: 8 }}>
      {tiles.map(([t, n, color]) => (
        <div key={t} style={{ background: 'var(--surface2)', borderRadius: 10, padding: '10px 6px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{t}</div>
          <div style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color }}>{fmtQty(n)}</div>
        </div>
      ))}
    </div>
  )
}

function ItemPicker({ ctx, value, onPick }: { ctx: Ready; value: string | null; onPick: (id: string) => void }) {
  if (ctx.items.length === 0) {
    return <Banner tone="info">Chưa có lệnh nào đang chạy ở {ctx.workstation.warehouseName ?? 'kho này'}.</Banner>
  }
  return (
    <div>
      <div style={label}>Chọn lệnh</div>
      <div style={chipRow}>
        {ctx.items.map((i) => (
          <button key={i.itemId} type="button" aria-pressed={value === i.itemId} style={pickChip(value === i.itemId)} onClick={() => onPick(i.itemId)}>
            <span><b>{i.lenhCode}</b> · {i.sku}<span style={{ display: 'block', fontSize: 12, opacity: 0.85 }}>{i.productName} · SL {fmtQty(i.quantity)}</span></span>
          </button>
        ))}
      </div>
    </div>
  )
}

function PiecePicker({ pieces, value, onPick }: { pieces: CkPiece[]; value: string | null; onPick: (id: string) => void }) {
  if (pieces.length === 0) return <Banner tone="info">Lệnh này chưa có mảnh nào để kiểm.</Banner>
  return (
    <div style={cardFlush}>
      {pieces.map((p, i) => {
        const on = p.pieceId === value
        return (
          <button key={p.pieceId} type="button" aria-pressed={on} onClick={() => onPick(p.pieceId)} style={{
            display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none',
            ...divider(i), background: on ? 'var(--blue-bg)' : 'transparent', color: 'var(--text)', cursor: 'pointer',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>{p.pieceName}</div>
              <div style={hint}>
                Hiện có {fmtQty(p.readyQty)} · đã kiểm {fmtQty(p.checkedQty)}
                {p.pendingQty > 0 && <> · <span style={{ color: 'var(--amber)' }}>{fmtQty(p.pendingQty)} chờ KCS</span></>}
                {' · '}<b style={{ color: 'var(--text)' }}>còn kiểm {fmtQty(p.availableQty)}</b>
              </div>
            </div>
            <span aria-hidden style={{ fontSize: 20, color: on ? 'var(--blue)' : 'var(--floor-hint)' }}>{on ? '●' : '○'}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Ảnh lỗi: chụp bằng camera điện thoại, tải lên ngay (lưu đợt chỉ gửi đường dẫn). */
function PhotoBox({ urls, onAdd, onRemove, busy }: { urls: string[]; onAdd: (f: File[]) => void; onRemove: (u: string) => void; busy: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <div style={label}>Ảnh lỗi (ít nhất 1)</div>
      <div style={{ ...chipRow, alignItems: 'center' }}>
        {urls.map((u) => (
          <div key={u} style={{ position: 'relative' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary vừa chụp, không cần tối ưu */}
            <img src={u} alt="Ảnh lỗi" width={72} height={72} style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
            <button type="button" aria-label="Bỏ ảnh này" onClick={() => onRemove(u)} style={{
              position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: 999, border: 'none',
              background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}><X size={14} /></button>
          </div>
        ))}
        <button type="button" disabled={busy} onClick={() => ref.current?.click()} style={{ ...pickChip(false), minHeight: 72 }}>
          <Camera size={20} aria-hidden /> {busy ? 'Đang tải ảnh…' : 'Chụp ảnh'}
        </button>
        <input ref={ref} type="file" accept="image/*" capture="environment" multiple hidden
          onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) onAdd(f) }} />
      </div>
    </div>
  )
}

function CkForm({ ctx, itemLabel, onSend }: {
  ctx: Ready
  itemLabel: string
  onSend: (d: { pieceId: string; passedQty: number; defectQty: number; defectReasonId?: string; photoUrls?: string[] }, summary: string) => Promise<boolean>
}) {
  const pieces = ctx.pieces ?? []
  const [pieceId, setPieceId] = useState<string | null>(null)
  const [passed, setPassed] = useState('')
  const [defect, setDefect] = useState('')
  const [reasonId, setReasonId] = useState<string>('')
  const [photos, setPhotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [photoErr, setPhotoErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const piece = pieces.find((p) => p.pieceId === pieceId) ?? null
  const p = toQty(passed)
  const d = toQty(defect)
  const check = ckReportCheck({
    pieceChosen: !!piece, passed: p, defect: d, reasonId: reasonId || null, photoCount: photos.length,
    available: piece?.availableQty ?? 0, busy: busy || uploading,
  })
  const reasonLabel = ctx.defectReasons.find((r) => r.id === reasonId)?.label ?? ''

  const addPhotos = async (files: File[]) => {
    setUploading(true); setPhotoErr(null)
    try {
      const urls = await Promise.all(files.slice(0, 10 - photos.length).map((f) => uploadImage(f)))
      setPhotos((prev) => [...prev, ...urls].slice(0, 10))
    } catch (e) { setPhotoErr(errText(e)) } finally { setUploading(false) }
  }
  const reset = () => { setPassed(''); setDefect(''); setReasonId(''); setPhotos([]) }
  const submit = async () => {
    if (!piece || !check.ok) return
    setBusy(true)
    const ok = await onSend({
      pieceId: piece.pieceId, passedQty: p, defectQty: d,
      ...(d > 0 ? { defectReasonId: reasonId, photoUrls: photos } : {}),
    }, `${piece.pieceName}: đạt ${p}${d ? `, lỗi ${d}` : ''}`)
    setBusy(false); setConfirming(false)
    if (ok) reset()
  }

  return (
    <>
      <PiecePicker pieces={pieces} value={pieceId} onPick={(id) => { setPieceId(id); reset() }} />
      {piece && (
        <div style={{ ...card, ...column(14) }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={column(6)}><span style={label}>Số đạt</span>
              <input aria-label="Số đạt" inputMode="numeric" value={passed} placeholder="0" style={{ ...numInput, width: '100%' }}
                onChange={(e) => setPassed(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
            <label style={column(6)}><span style={label}>Số lỗi</span>
              <input aria-label="Số lỗi" inputMode="numeric" value={defect} placeholder="0" style={{ ...numInput, width: '100%' }}
                onChange={(e) => setDefect(e.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
          </div>
          {d > 0 && (
            <>
              <label style={column(6)}><span style={label}>Nguyên nhân lỗi</span>
                <select value={reasonId} onChange={(e) => setReasonId(e.target.value)} style={fieldInput} aria-label="Nguyên nhân lỗi">
                  <option value="">- Chọn nguyên nhân -</option>
                  {ctx.defectReasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select></label>
              <PhotoBox urls={photos} busy={uploading} onAdd={(f) => void addPhotos(f)} onRemove={(u) => setPhotos((x) => x.filter((y) => y !== u))} />
              {photoErr && <Banner tone="err">{photoErr}</Banner>}
            </>
          )}
          <div style={hint}>Còn kiểm được <b style={{ color: 'var(--text)' }}>{fmtQty(piece.availableQty)}</b> (Hiện có − đã kiểm − chờ KCS − đã bỏ). Số chỉ tính “đã qua chuyền kiểm” khi KCS chuyền kiểm chấm.</div>
        </div>
      )}
      <ActionBar
        action={{ label: check.ok ? `Lưu đạt ${p}${d ? `, lỗi ${d}` : ''}` : 'Lưu', disabled: !check.ok, reason: check.reason }}
        onClick={() => { if (check.ok) setConfirming(true) }}
      />
      {confirming && piece && (
        <ConfirmSheet
          title="Xác nhận báo chuyền kiểm"
          context={`${itemLabel} · ${piece.pieceName}`}
          rows={[
            { label: 'Đạt', value: fmtQty(p) },
            ...(d > 0 ? [{ label: 'Lỗi', value: fmtQty(d), warn: `${reasonLabel} · ${photos.length} ảnh` }] : []),
          ]}
          notes={['Đợt này chờ KCS chuyền kiểm chấm rồi mới tính đã qua chuyền kiểm.']}
          confirmLabel="Đúng, lưu"
          busy={busy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

const ACCEPT_LOC: readonly FloorQr['kind'][] = ['loc']

/** V2 (vị trí kho): ô cất thùng vừa quét + hàng đang ở ô + lời nhắc trộn bộ 3 khác. */
function LocationBox({ loc, mix, err, onScan }: { loc: VtkScannedLocation | null; mix: string | null; err: string | null; onScan: () => void }) {
  return (
    <div style={{ ...card, ...column(10) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <MapPin size={20} aria-hidden />
        <div style={{ flex: 1 }}>
          <div style={label}>Ô cất thùng</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{loc ? loc.code : 'Chưa quét'}</div>
        </div>
        <button type="button" onClick={onScan} style={{ ...pickChip(false), minHeight: 48 }}>{loc ? 'Quét ô khác' : 'Quét tem ô'}</button>
      </div>
      {loc && loc.lines.length > 0 && (
        <div style={hint}>Đang có: {loc.lines.map((l) => `${tripleText(l)} (${fmtQty(l.qty)} bộ)`).join('; ')}</div>
      )}
      {loc && loc.lines.length === 0 && <div style={hint}>Ô đang trống.</div>}
      {mix && <Banner tone="warn">{mix}</Banner>}
      {err && <Banner tone="err">{err}</Banner>}
    </div>
  )
}

function DgForm({ ctx, ws, itemId, itemLabel, initialLoc, onSend }: {
  ctx: Ready; ws: string; itemId: string; itemLabel: string; initialLoc?: string | null
  onSend: (qty: number, summary: string, locationId?: string) => Promise<boolean>
}) {
  const pk = ctx.packing
  const requireLoc = !!ctx.requireLocation
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loc, setLoc] = useState<VtkScannedLocation | null>(null)
  const [mix, setMix] = useState<string | null>(null)
  const [locErr, setLocErr] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const locToken = useRef<string | null>(null)
  const pickLoc = useCallback(async (token: string) => {
    setLocErr(null)
    try {
      const r = await scanFloorLocation(token, { ws, itemId })
      if (!r.enabled) return
      locToken.current = token
      setLoc(r.location); setMix(r.mixWarning)
    } catch (e) { setLoc(null); setMix(null); setLocErr(errText(e)) }
  }, [ws, itemId])
  // Mở màn bằng tem ô (/floor?loc=...): chọn sẵn ô đó - setState chỉ xảy ra sau khi request trả về.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (requireLoc && initialLoc) void pickLoc(initialLoc) }, [requireLoc, initialLoc, pickLoc])
  const n = toQty(qty)
  const base = packingCheck({ itemChosen: !!pk, qty: n, available: pk?.availableQty ?? 0, busy })
  const locCheck = dgLocationCheck({ required: requireLoc, locationId: loc?.id ?? null })
  const check = base.ok ? locCheck : base
  const submit = async () => {
    if (!check.ok) return
    setBusy(true)
    const ok = await onSend(n, `${n} bộ${loc ? ` vào ô ${loc.code}` : ''}`, requireLoc ? loc?.id : undefined)
    setBusy(false); setConfirming(false)
    // Lưu xong: đọc lại hàng ở ô (giữ ô cho lần cất tiếp theo).
    if (ok) { setQty(''); if (locToken.current) void pickLoc(locToken.current) }
  }
  return (
    <>
      {pk && <Tiles tiles={[
        ['Số lượng lệnh', pk.totalQty], ['Đã qua KCS CK', pk.setsPassed], ['Đã đóng', pk.packedQty],
        ['Còn đóng', pk.availableQty, pk.availableQty > 0 ? 'var(--green)' : 'var(--red)'],
      ]} />}
      {pk && requireLoc && <LocationBox loc={loc} mix={mix} err={locErr} onScan={() => setScanning(true)} />}
      {scanning && (
        <QrScanner accept={ACCEPT_LOC} title="Đưa tem vị trí kho (ô cất thùng) vào khung"
          onScanned={(qr) => { setScanning(false); if (qr.kind === 'loc') void pickLoc(qr.loc) }}
          onClose={() => setScanning(false)} />
      )}
      <ActionBar
        action={{ label: check.ok ? `Lưu ${n} bộ` : 'Nhập số bộ', disabled: !check.ok, reason: check.reason }}
        onClick={() => { if (check.ok) setConfirming(true) }}
        leading={pk && (
          <input aria-label="Số bộ đã đóng" inputMode="numeric" value={qty} placeholder="0" style={{ ...numInput, width: 96 }}
            onChange={(e) => setQty(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        )}
      />
      {confirming && (
        <ConfirmSheet title="Xác nhận báo đóng gói" context={itemLabel}
          rows={[{ label: 'Số bộ đã đóng', value: fmtQty(n) }, ...(loc ? [{ label: 'Cất vào ô', value: loc.code, ...(mix ? { warn: 'Ô đang có hàng khác' } : {}) }] : [])]}
          notes={['Số tính luôn (không chờ duyệt). Báo sai thì nhờ thủ kho Thành phẩm huỷ.']}
          confirmLabel={`Đúng, lưu ${n} bộ`} busy={busy} onConfirm={() => void submit()} onCancel={() => setConfirming(false)} />
      )}
    </>
  )
}

function Recent({ rows }: { rows: (CkBatch | DgReport)[] }) {
  if (rows.length === 0) return null
  return (
    <div>
      <div style={label}>Lần báo gần đây của tôi</div>
      <div style={cardFlush}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ padding: '10px 16px', ...divider(i) }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {r.lenhCode} · {r.sku}{isCkBatch(r) ? ` · ${r.pieceName}` : ''}
            </div>
            <div style={hint}>
              {hhmm(new Date(r.reportedAt))} · {isCkBatch(r) ? `${batchReportText(r)} · ${batchKcsText(r)}` : `${r.qty} bộ${r.cancelled ? ` · ĐÃ HUỶ (${r.cancelReason ?? ''})` : ''}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function CkDgReportTab({ ws, initialLoc }: { ws: string; initialLoc?: string | null }) {
  const [ctx, setCtx] = useState<Ready | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [itemId, setItemId] = useState<string | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const retryKey = useRetrySafeKey()

  const load = useCallback(async (id: string | null) => {
    try {
      let c: CkDgScanContext
      try { c = await getCkDgScan(ws, id) } catch (e) {
        // Lệnh vừa xong / tạm dừng: tải lại không kèm lệnh, đừng vỡ cả màn.
        if (!id || !(e instanceof ApiError) || e.statusCode < 400 || e.statusCode >= 500) throw e
        c = await getCkDgScan(ws)
      }
      if (!c.enabled) { setDisabled(true); return }
      // Chỉ 1 lệnh thì chọn sẵn.
      if (!c.selectedItemId && c.items.length === 1) c = await getCkDgScan(ws, c.items[0].itemId)
      if (!c.enabled) { setDisabled(true); return }
      setCtx(c); setItemId(c.selectedItemId); setLoadErr(null)
    } catch (e) { setLoadErr(errText(e)) }
  }, [ws])

  // Tải dữ liệu điểm khi mở màn - setState chỉ xảy ra sau khi request trả về.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(null) }, [load])

  const send = async (fn: (key: string) => Promise<unknown>, payload: unknown, summary: string) => {
    setFlash(null)
    try {
      const res = await fn(retryKey.take(payload))
      retryKey.settle()
      // Vị trí kho: cất vào ô đang có lệnh / SKU / PO khác -> vẫn lưu, nhắc lại để xếp riêng.
      const mixed = (res as { mixWarning?: string | null } | undefined)?.mixWarning
      setFlash(mixed ? { tone: 'warn', text: `Đã lưu ${summary} · ${hhmm()}. ${mixed}` } : { tone: 'ok', text: `Đã lưu ${summary} · ${hhmm()}` })
      await load(itemId)
      return true
    } catch (e) {
      retryKey.settle(e)
      const info = describeError(e, true)
      setFlash({ tone: info.tone, text: info.text })
      if (e instanceof ApiError && e.statusCode >= 400 && e.statusCode < 500) void load(itemId)
      return false
    }
  }

  if (disabled) return <div style={{ marginTop: 16 }}><Banner tone="info">Chuyền kiểm / đóng gói bằng quét QR chưa bật. Vẫn báo ở kho Thành phẩm như cũ.</Banner></div>
  if (loadErr) return <div style={{ marginTop: 16 }}><Banner tone="err">{loadErr}</Banner></div>
  if (!ctx) return <div style={{ marginTop: 24, ...loadingText }}>Đang tải…</div>
  const w = ctx.workstation
  const isCk = w.kind === 'TRANSFER_CHECK'
  const item = ctx.items.find((i) => i.itemId === itemId) ?? null
  const itemLabel = item ? `${item.lenhCode} · ${item.sku}` : ''
  return (
    <div style={tabColumn}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{isCk ? 'Báo chuyền kiểm' : 'Báo đóng gói'}</h2>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>{w.code}{w.warehouseName ? ` · ${w.warehouseName}` : ''} · tổ {isCk ? 'Chuyền kiểm' : 'Đóng gói'}</div>
      </div>
      {flash && <Banner tone={flash.tone} alert>{flash.text}</Banner>}
      <ItemPicker ctx={ctx} value={itemId} onPick={(id) => { setFlash(null); setItemId(id); void load(id) }} />
      {item && (isCk ? (
        <CkForm key={item.itemId} ctx={ctx} itemLabel={itemLabel}
          onSend={(d, summary) => send((k) => reportCkBatch(ws, { itemId: item.itemId, ...d }, k), { itemId: item.itemId, ...d }, summary)} />
      ) : (
        <DgForm key={item.itemId} ctx={ctx} ws={ws} itemId={item.itemId} itemLabel={itemLabel} initialLoc={initialLoc}
          onSend={(qty, summary, locationId) => {
            const body = { itemId: item.itemId, qty, ...(locationId ? { locationId } : {}) }
            return send((k) => reportPacking(ws, body, k), body, summary)
          }} />
      ))}
      <Recent rows={ctx.recent} />
    </div>
  )
}

'use client'

/**
 * Soạn hàng + load từng cont cho 1 booking (25/11/2026, docs THIET-KE-VI-TRI-KHO-LOAD-CONT, V5-V7, V9) - nằm trong thẻ booking của
 * "Xuất hàng theo booking" khi BE bật VI_TRI_KHO_ENABLED. Thủ kho Thành phẩm của kho gom hàng:
 *  1. Tạo cont (số cont, seal nhập lúc nào cũng được), chọn cont đang load.
 *  2. Danh sách lấy hàng: mỗi dòng booking (lệnh · SKU · PO) -> các ô đang giữ đúng bộ 3 đó + số gợi ý (theo mã ô). Bấm "Lấy" ở 1 ô,
 *     QUÉT TEM Ô đó: quét ô khác -> "Sai vị trí"; ô không có đúng bộ 3 -> "Sai mã". Lấy nhầm thì trả về ô (cont chưa đóng).
 *  3. Đóng cont: đủ số cont + seal + ≥ 1 ảnh load + có hàng. Đóng nhầm thì mở lại (booking chưa xuất).
 * Xác nhận xuất (phiếu XK, ảnh phiếu ký) vẫn ở thẻ booking như cũ - số thực xuất tự lấy = hàng đã đóng cont.
 */
import { useRef, useState } from 'react'
import { Camera, Lock, Package, Plus, Trash2, Unlock, X } from 'lucide-react'
import { useRetrySafeKey } from '../../../../hooks/useRetrySafeKey'
import { uploadImage } from '../../../../services/uploads-api'
import {
  closeContainer, createContainer, deleteContainer, pickToContainer, reopenContainer, returnFromContainer, updateContainer,
  type VtkContainer, type VtkPickList, type VtkPickLine, type VtkPickLocation,
} from '../../../../services/vi-tri-kho-api'
import { errMsg } from '../../../../utils/errors'
import { pickCheck, toQty, tripleText } from './viTriKhoModel'
import { box, btn, inputStyle, note, numStyle, ScanInput, sub, td, tdR, th, thR } from './vtkUi'

type Ready = Extract<VtkPickList, { enabled: true }>
type Flash = { tone: 'ok' | 'err' | 'warn'; text: string } | null

export default function BookingLoadPanel({ data, onChanged }: { data: Ready; onChanged: () => void }) {
  const open = data.containers.filter((c) => c.status === 'OPEN')
  const [containerId, setContainerId] = useState<string | null>(open[0]?.id ?? null)
  const [flash, setFlash] = useState<Flash>(null)
  const [busy, setBusy] = useState(false)
  const container = data.containers.find((c) => c.id === containerId && c.status === 'OPEN') ?? open[0] ?? null

  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true); setFlash(null)
    try {
      const text = await fn()
      if (text) setFlash({ tone: 'ok', text })
      onChanged()
    } catch (e) { setFlash({ tone: 'err', text: errMsg(e) }) } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <b style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Package size={14} /> Soạn hàng & load cont</b>
        <span style={sub}>Booking {data.booking.containerQty}×{data.booking.containerType} · {data.containers.length} cont đã tạo</span>
        <div style={{ flex: 1 }} />
        <button type="button" disabled={busy} style={btn(false, busy)}
          onClick={() => void run(async () => { const c = await createContainer(data.booking.id); setContainerId(c.id); return 'Đã tạo cont mới' })}>
          <Plus size={13} /> Thêm cont
        </button>
      </div>
      {flash && <div style={note(flash.tone)}>{flash.text}</div>}
      <PickTable lines={data.lines} container={container} containers={open} bookingId={data.booking.id}
        onPickContainer={setContainerId} onFlash={setFlash} onChanged={onChanged} />
      {data.containers.map((c) => (
        <ContainerCard key={`${c.id}:${c.status}:${c.containerNo ?? ''}:${c.sealNo ?? ''}`} c={c} busy={busy} run={run} onFlash={setFlash} onChanged={onChanged} />
      ))}
    </div>
  )
}

/** Danh sách lấy hàng: dòng booking × ô gợi ý. */
function PickTable({ lines, container, containers, bookingId, onPickContainer, onFlash, onChanged }: {
  lines: VtkPickLine[]; container: VtkContainer | null; containers: VtkContainer[]; bookingId: string
  onPickContainer: (id: string) => void; onFlash: (f: Flash) => void; onChanged: () => void
}) {
  const [active, setActive] = useState<{ line: VtkPickLine; loc: VtkPickLocation } | null>(null)
  return (
    <div style={box}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Lấy vào cont:</span>
        {containers.length === 0 && <span style={sub}>Chưa có cont đang load - bấm “Thêm cont”</span>}
        {containers.map((c) => (
          <button key={c.id} type="button" onClick={() => onPickContainer(c.id)} style={{ ...btn(container?.id === c.id), padding: '4px 10px' }}>
            {c.containerNo ?? `Cont #${c.id}`} · {c.totalQty} bộ
          </button>
        ))}
      </div>
      <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: 'var(--surface2)' }}>
          <th style={th}>Lệnh · SKU · PO</th><th style={thR}>Xếp booking</th><th style={thR}>Đã vào cont</th><th style={thR}>Còn lấy</th>
          <th style={th}>Ô (gợi ý lấy)</th>
        </tr></thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.lineId} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={td}><b>{l.sku}</b> · {l.lenhCode}<div style={sub}>PO {l.poCode ?? '—'} · {l.productName}</div></td>
              <td style={tdR}>{l.qty - l.shippedQty}</td>
              <td style={tdR}>{l.loadedQty}</td>
              <td style={{ ...tdR, fontWeight: 700, color: l.remainingQty > 0 ? undefined : 'var(--fg-16a34a)' }}>{l.remainingQty}</td>
              <td style={td}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {l.locations.map((loc) => (
                    <button key={loc.locationId} type="button" disabled={l.remainingQty <= 0}
                      onClick={() => setActive({ line: l, loc })}
                      style={{ ...btn(loc.suggestedQty > 0, l.remainingQty <= 0, 'var(--bg-2e7d32)'), padding: '4px 10px' }}
                      title={`Ô ${loc.code} có ${loc.qty} bộ`}>
                      {loc.code}: lấy {loc.suggestedQty || '—'}/{loc.qty}
                    </button>
                  ))}
                  {l.locations.length === 0 && <span style={sub}>Chưa có ô nào giữ hàng này</span>}
                  {l.shortQty > 0 && <span style={{ ...sub, color: 'var(--fg-b45309)' }}>Thiếu {l.shortQty} bộ trong ô</span>}
                </div>
                {active?.line.lineId === l.lineId && (
                  <PickBox key={active.loc.locationId} bookingId={bookingId} line={l} loc={active.loc} container={container}
                    onClose={() => setActive(null)}
                    onDone={(t) => { setActive(null); onFlash(t); onChanged() }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Lấy ở 1 ô: số + QUÉT TEM ô (bằng chứng đứng đúng ô). */
function PickBox({ bookingId, line, loc, container, onClose, onDone }: {
  bookingId: string; line: VtkPickLine; loc: VtkPickLocation; container: VtkContainer | null
  onClose: () => void; onDone: (f: Flash) => void
}) {
  const [qty, setQty] = useState(String(loc.suggestedQty || Math.min(loc.qty, line.remainingQty)))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const retryKey = useRetrySafeKey()
  const n = toQty(qty)
  const check = pickCheck({ container, line, stockQty: loc.qty, qty: n, busy })
  const scanned = async (token: string) => {
    if (!check.ok || !container) return
    setBusy(true); setErr(null)
    const body = { containerId: container.id, bookingLineId: line.lineId, locationToken: token, expectedLocationId: loc.locationId, qty: n }
    try {
      await pickToContainer(bookingId, body, retryKey.take(body))
      retryKey.settle()
      onDone({ tone: 'ok', text: `Đã lấy ${n} bộ ${tripleText(line)} ở ô ${loc.code} vào ${container.containerNo ?? `cont #${container.id}`}` })
    } catch (e) { retryKey.settle(e); setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div style={{ marginTop: 8, padding: 10, border: '1px dashed var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>Lấy ở ô <b>{loc.code}</b></span>
        <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" aria-label="Số bộ lấy" style={numStyle} />
        <span>bộ, rồi quét tem ô {loc.code}:</span>
        <ScanInput label="Quét ô" disabled={!check.ok} onToken={(t) => void scanned(t)} />
        <button type="button" onClick={onClose} style={{ ...btn(false), padding: '4px 8px' }} aria-label="Đóng"><X size={13} /></button>
      </div>
      {check.reason && <span style={sub}>{check.reason}</span>}
      {err && <div style={note('err')}>{err}</div>}
    </div>
  )
}

/** 1 cont: số cont, seal, ảnh load, hàng trong cont, đóng / mở lại, trả hàng về ô. */
function ContainerCard({ c, busy, run, onFlash, onChanged }: {
  c: VtkContainer; busy: boolean; run: (fn: () => Promise<string | null>) => Promise<void>
  onFlash: (f: Flash) => void; onChanged: () => void
}) {
  const [no, setNo] = useState(c.containerNo ?? '')
  const [seal, setSeal] = useState(c.sealNo ?? '')
  const [uploading, setUploading] = useState(false)
  const [returning, setReturning] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isOpen = c.status === 'OPEN'
  const dirty = no.trim().toUpperCase() !== (c.containerNo ?? '') || seal.trim().toUpperCase() !== (c.sealNo ?? '')
  const addPhotos = async (files: File[]) => {
    setUploading(true)
    try {
      const urls = await Promise.all(files.slice(0, 20 - c.photoUrls.length).map((f) => uploadImage(f)))
      await updateContainer(c.id, { photoUrls: [...c.photoUrls, ...urls] })
      onChanged()
    } catch (e) { onFlash({ tone: 'err', text: errMsg(e) }) } finally { setUploading(false) }
  }
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: isOpen ? 'var(--surface)' : 'var(--surface2)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <b>{c.containerNo ?? `Cont #${c.id}`}</b>
        <span style={{ fontSize: 12, fontWeight: 600, color: isOpen ? 'var(--fg-b45309)' : 'var(--fg-16a34a)' }}>
          {isOpen ? 'Đang load' : `Đã đóng${c.loadedByName ? ` · ${c.loadedByName}` : ''}`}
        </span>
        <span style={sub}>{c.totalQty} bộ</span>
        <div style={{ flex: 1 }} />
        {isOpen && (
          <>
            <input value={no} onChange={(e) => setNo(e.target.value)} placeholder="Số cont" aria-label="Số cont" style={{ ...inputStyle, width: 140 }} />
            <input value={seal} onChange={(e) => setSeal(e.target.value)} placeholder="Số seal" aria-label="Số seal" style={{ ...inputStyle, width: 110 }} />
            <button type="button" disabled={busy || !dirty} style={btn(false, busy || !dirty)}
              onClick={() => void run(async () => { await updateContainer(c.id, { containerNo: no, sealNo: seal }); return 'Đã lưu số cont / seal' })}>Lưu</button>
          </>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        {c.photoUrls.map((u) => (
          <span key={u} style={{ position: 'relative' }}>
            <a href={u} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary thủ kho vừa chụp */}
              <img src={u} alt="Ảnh load cont" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', display: 'block' }} />
            </a>
            {isOpen && (
              <button type="button" aria-label="Bỏ ảnh" disabled={busy}
                onClick={() => void run(async () => { await updateContainer(c.id, { photoUrls: c.photoUrls.filter((x) => x !== u) }); return null })}
                style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 999, border: 'none', background: 'var(--fg-c62828)', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={11} />
              </button>
            )}
          </span>
        ))}
        {isOpen && (
          <>
            <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} style={btn(false, uploading)}>
              <Camera size={13} /> {uploading ? 'Đang tải ảnh…' : 'Ảnh load cont'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
              onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ''; if (f.length) void addPhotos(f) }} />
          </>
        )}
      </div>
      {c.lines.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <tbody>
            {c.lines.map((l) => (
              <tr key={l.bookingLineId} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>{tripleText(l)}</td>
                <td style={{ ...tdR, fontWeight: 700 }}>{l.qty}</td>
                <td style={{ ...td, width: 1, whiteSpace: 'nowrap' }}>
                  {isOpen && (returning === l.bookingLineId
                    ? <ReturnBox containerId={c.id} line={l} onClose={() => setReturning(null)}
                        onDone={(f) => { setReturning(null); onFlash(f); onChanged() }} />
                    : <button type="button" style={{ ...btn(false), padding: '3px 8px' }} onClick={() => setReturning(l.bookingLineId)}>Trả về ô</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 8 }}>
        {isOpen ? (
          <>
            <button type="button" disabled={busy || c.closeProblems.length > 0} style={btn(true, busy || c.closeProblems.length > 0, 'var(--bg-2e7d32)')}
              onClick={() => void run(async () => { await closeContainer(c.id); return `Đã đóng cont ${c.containerNo ?? ''}` })}>
              <Lock size={13} /> Đóng cont
            </button>
            {c.closeProblems.length > 0 && <span style={sub}>Chưa đóng được: {c.closeProblems.join(', ')}</span>}
            {c.totalQty === 0 && (
              <button type="button" disabled={busy} style={btn(false, busy)}
                onClick={() => void run(async () => { await deleteContainer(c.id); return 'Đã xoá cont trống' })}>
                <Trash2 size={13} /> Xoá cont trống
              </button>
            )}
          </>
        ) : (
          <button type="button" disabled={busy} style={btn(false, busy)}
            onClick={() => void run(async () => { await reopenContainer(c.id); return 'Đã mở lại cont' })}>
            <Unlock size={13} /> Mở lại cont
          </button>
        )}
      </div>
    </div>
  )
}

/** Trả hàng từ cont đang load về 1 ô (quét tem ô). */
function ReturnBox({ containerId, line, onClose, onDone }: {
  containerId: string; line: VtkContainer['lines'][number]; onClose: () => void; onDone: (f: Flash) => void
}) {
  const [qty, setQty] = useState(String(line.qty))
  const [err, setErr] = useState<string | null>(null)
  const retryKey = useRetrySafeKey()
  const n = toQty(qty)
  const scanned = async (token: string) => {
    if (n <= 0 || n > line.qty) { setErr(`Nhập 1-${line.qty} bộ`); return }
    const body = { bookingLineId: line.bookingLineId, locationToken: token, qty: n }
    try {
      const r = await returnFromContainer(containerId, body, retryKey.take(body))
      retryKey.settle()
      onDone(r.mixWarning ? { tone: 'warn', text: `Đã trả ${n} bộ về ô. ${r.mixWarning}` } : { tone: 'ok', text: `Đã trả ${n} bộ về ô` })
    } catch (e) { retryKey.settle(e); setErr(errMsg(e)) }
  }
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={qty} onChange={(e) => setQty(e.target.value)} inputMode="numeric" aria-label="Số bộ trả" style={{ ...numStyle, width: 60 }} />
      <ScanInput label="Quét ô cất lại" onToken={(t) => void scanned(t)} />
      <button type="button" onClick={onClose} style={{ ...btn(false), padding: '4px 8px' }} aria-label="Đóng"><X size={13} /></button>
      {err && <span style={{ fontSize: 12, color: 'var(--fg-c62828)' }}>{err}</span>}
    </span>
  )
}

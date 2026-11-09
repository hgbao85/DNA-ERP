'use client'

/**
 * Người B – Đợt 10b (YC5 5.5–5.8): kho thành phẩm xuất hàng theo booking. Thay nút "Xuất giao" cũ - mọi lần xuất hàng đi qua
 * booking Sales đã xác nhận, gom về đúng kho thành phẩm này. Thủ kho: gom hàng, đóng cont, nhập số THỰC XUẤT từng dòng -> In
 * phiếu xuất (số XK) -> người nhận ký -> tải ảnh -> "Xác nhận đã xuất". Đổi số sau khi in thì phải in lại.
 */
import { useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle, Printer, Ship, Upload, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useRealtimeRefetch } from '../../../realtime/hooks'
import { getBookingsToShip, reserveShipSlipCode, shipBooking } from '../../../services/booking-shipments-api'
import { uploadDocument } from '../../../services/uploads-api'
import { newUuid } from '../../../services/core/uuid'
import type { Booking } from '../../../types/booking'
import { errMsg } from '../../../utils/errors'
import { focusAttr } from '../../../utils/notificationLink'
import { box, esc, khoCheckboxes, openSlipPrint } from './slipPrintTemplate'

const th: React.CSSProperties = { padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, verticalAlign: 'middle' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }
const head: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }
const input: React.CSSProperties = { width: 80, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }
const btn = (enabled: boolean, color = 'var(--bg-2563eb)'): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, fontWeight: 600, border: 'none', borderRadius: 8,
  background: enabled ? color : 'var(--surface2)', color: enabled ? '#fff' : 'var(--text3)', cursor: enabled ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap',
})
const ghost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }

const day = (d: string | null) => (d ? format(new Date(d), 'dd/MM/yyyy') : '—')
const dayTime = (d: string | null) => (d ? format(new Date(d), 'dd/MM HH:mm') : '—')

export default function XuatHangBookingSection() {
  const { data, error, refetch } = useFetch(getBookingsToShip, [])
  useRealtimeRefetch(['sales-orders', 'packaging-issues'], () => { void refetch() })
  const list = data ?? []

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Ship size={17} /> Xuất hàng theo booking
      </h3>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
        Booking Sales đã xác nhận, gom hàng về kho này. Đóng cont xong: nhập số thực xuất → In phiếu xuất → người nhận ký → tải ảnh → Xác nhận đã xuất.
      </div>
      {error && <div style={{ color: 'var(--fg-c62828)', fontSize: 13, marginBottom: 8 }}>{errMsg(error, 'Không tải được danh sách booking')}</div>}
      {list.length === 0 && !error && (
        <div style={{ ...card, padding: 16, fontSize: 13, color: 'var(--text3)' }}>Không có booking nào chờ xuất ở kho này.</div>
      )}
      {list.map(b => <BookingShipCard key={b.id} booking={b} onDone={() => { void refetch() }} />)}
    </div>
  )
}

function BookingShipCard({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const remainOf = (l: Booking['lines'][number]) => Math.max(0, l.qty - l.shippedQty)
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(booking.lines.map(l => [l.id, String(Math.min(remainOf(l), l.readyQty))])),
  )
  const [slipCode, setSlipCode] = useState<string | null>(null)
  const [printedKey, setPrintedKey] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [shipKey] = useState(() => newUuid())
  const uploaded = useRef(new WeakMap<File, string>())

  const plan = useMemo(() => booking.lines.map(l => {
    const n = Number(qty[l.id] ?? '0')
    const v = Number.isInteger(n) && n >= 0 ? n : NaN
    return { line: l, qty: v, remain: remainOf(l) }
  }), [booking.lines, qty])
  const invalid = plan.find(p => Number.isNaN(p.qty) || p.qty > p.remain || p.qty > p.line.readyQty)
  const total = plan.reduce((s, p) => s + (Number.isNaN(p.qty) ? 0 : p.qty), 0)
  const planKey = plan.map(p => `${p.line.id}:${p.qty}`).join('|')
  const printedUpToDate = slipCode != null && printedKey === planKey

  const print = async () => {
    setErr('')
    try {
      const { code } = await reserveShipSlipCode(slipCode ?? undefined)
      setSlipCode(code)
      setPrintedKey(planKey)
      printShipSlip(booking, code, plan.filter(p => p.qty > 0).map(p => ({ line: p.line, qty: p.qty })))
    } catch (e) {
      setErr(errMsg(e, 'Không lấy được số phiếu'))
    }
  }

  const confirm = async () => {
    if (!slipCode) return
    setBusy(true); setErr('')
    try {
      const urls: string[] = []
      for (const f of files) {
        let u = uploaded.current.get(f)
        if (!u) { u = await uploadDocument(f); uploaded.current.set(f, u) }
        urls.push(u)
      }
      await shipBooking(booking.id, {
        slipCode,
        signedSlipUrls: urls,
        lines: plan.filter(p => p.qty > 0).map(p => ({ lineId: p.line.id, qty: p.qty })),
      }, shipKey)
      onDone()
    } catch (e) {
      setErr(errMsg(e, 'Không xác nhận xuất được'))
    } finally {
      setBusy(false)
    }
  }

  const canConfirm = !busy && !invalid && total > 0 && printedUpToDate && files.length > 0
  const reason = invalid ? 'Số thực xuất không hợp lệ (vượt số còn của booking hoặc vượt hàng đã đóng gói)'
    : total === 0 ? 'Nhập số thực xuất'
    : !printedUpToDate ? (slipCode ? 'Đã đổi số sau khi in - in lại phiếu' : 'In phiếu xuất trước')
    : files.length === 0 ? 'Tải ảnh phiếu đã ký' : ''

  return (
    <div style={card} {...focusAttr('BOOKING', booking.id)}>
      <div style={head}>
        <b style={{ fontSize: 14 }}>Booking {booking.bookingNo}</b>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{booking.customerName} · {booking.containerQty}×{booking.containerType} · POD {booking.pod}</span>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>Lấy cont {day(booking.pickupDate)} · <b style={{ color: 'var(--fg-c62828)' }}>CUT OFF {dayTime(booking.cutOffAt)}</b>{booking.vesselVoyage ? ` · ${booking.vesselVoyage}` : ''}</span>
        <div style={{ flex: 1 }} />
        {booking.totals.shortQty > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-b45309)' }}>Chưa đủ hàng: thiếu {booking.totals.shortQty} bộ</span>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={th}>Lệnh</th><th style={th}>PO khách</th><th style={th}>Mã hàng</th>
              <th style={{ ...th, textAlign: 'right' }}>Xếp booking</th>
              <th style={{ ...th, textAlign: 'right' }} title="Đã đóng gói − đã xuất của dòng đơn">Hàng sẵn</th>
              <th style={{ ...th, textAlign: 'right' }}>Thực xuất (bộ)</th>
            </tr>
          </thead>
          <tbody>
            {plan.map(p => {
              const bad = Number.isNaN(p.qty) || p.qty > p.remain || p.qty > p.line.readyQty
              return (
                <tr key={p.line.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{p.line.lenhCode ?? '—'}</td>
                  <td style={{ ...td, fontSize: 12 }}>{p.line.orderCode}</td>
                  <td style={td}><b>{p.line.factoryCode}</b> <span style={{ color: 'var(--text3)' }}>{p.line.skuName}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>{p.remain}</td>
                  <td style={{ ...td, textAlign: 'right', color: p.line.readyQty < p.remain ? 'var(--fg-b45309)' : undefined }}>{p.line.readyQty}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <input value={qty[p.line.id] ?? ''} inputMode="numeric" aria-label={`Thực xuất ${p.line.factoryCode}`}
                      onChange={e => setQty(prev => ({ ...prev, [p.line.id]: e.target.value }))}
                      style={{ ...input, borderColor: bad ? 'var(--fg-c62828)' : 'var(--border)' }} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13 }}>Tổng thực xuất: <b>{total}</b> bộ{slipCode ? <> · Phiếu <b style={{ fontFamily: 'monospace' }}>{slipCode}</b></> : null}</span>
        <button onClick={print} disabled={!!invalid || total === 0} style={ghost}><Printer size={13} /> {slipCode ? 'In lại phiếu xuất' : 'In phiếu xuất'}</button>
        <label style={{ ...ghost, cursor: 'pointer' }}>
          <Upload size={13} /> Ảnh phiếu đã ký
          <input type="file" accept="image/*,application/pdf" multiple hidden onChange={e => { const fl = Array.from(e.target.files ?? []); setFiles(prev => [...prev, ...fl]); e.target.value = '' }} />
        </label>
        {files.map((f, i) => (
          <span key={i} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {f.name}
            <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 0 }}><X size={12} /></button>
          </span>
        ))}
        <div style={{ flex: 1 }} />
        {reason && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{reason}</span>}
        <button onClick={confirm} disabled={!canConfirm} style={btn(canConfirm, 'var(--bg-2e7d32)')}><CheckCircle size={14} /> {busy ? 'Đang xác nhận…' : 'Xác nhận đã xuất'}</button>
      </div>
      {err && <div style={{ padding: '0 14px 10px', color: 'var(--fg-c62828)', fontSize: 13 }}>{err}</div>}
    </div>
  )
}

/** Phiếu xuất kho Mẫu 02-VT cho 1 booking: xuất cho khách (đóng cont), mỗi dòng 1 lệnh / mã hàng. */
function printShipSlip(booking: Booking, code: string, rows: { line: Booking['lines'][number]; qty: number }[]): void {
  openSlipPrint({
    formCode: 'Mẫu 02-VT (bổ sung IEA)',
    title: 'PHIẾU XUẤT KHO',
    slipCode: code,
    date: new Date(),
    infoRows: [
      ['Kho xuất', khoCheckboxes(booking.warehouseCode ?? '', booking.warehouseName ?? ''), true],
      ['Xuất cho', `${box(false)} Điểm đan &nbsp;${box(false)} Chuyển kho &nbsp;${box(true)} Khác: Xuất hàng cho khách – <b>${esc(booking.customerName)}</b>`, true],
      ['Booking', `Số <b>${esc(booking.bookingNo)}</b> &nbsp;Cont: ${booking.containerQty}×${esc(booking.containerType)} &nbsp;POD: ${esc(booking.pod)} &nbsp;Tàu/chuyến: ${esc(booking.vesselVoyage ?? '..........')}`, true],
      ['Người nhận hàng', '.......................................................... &nbsp;Số cont / số seal: ....................', true],
    ],
    columns: [['Mã hàng', true], ['Tên hàng', true], ['PO khách', false], ['ĐVT', true], ['SL yêu cầu', false], ['SL thực xuất', true], ['LSX', true], ['Mã hàng', false], ['Ghi chú', false]],
    rows: rows.map(r => [
      esc(r.line.factoryCode),
      esc(r.line.skuName),
      esc(r.line.orderCode),
      'Bộ',
      String(r.qty),
      String(r.qty),
      esc(r.line.lenhCode ?? ''),
      esc(r.line.factoryCode),
      '',
    ]),
    signers: ['Người lập phiếu', 'Người nhận hàng', 'Thủ kho', 'Duyệt'],
  })
}

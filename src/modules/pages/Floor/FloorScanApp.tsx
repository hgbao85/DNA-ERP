'use client'

/**
 * Màn quét QR tại máy cho công nhân Phôi/Hàn/Sơn (2026-10-13 - changelog BE
 * changelog-2026-10-08-ke-hoach-tem-qr-bo-sat-phoi.md mục 22-23). Mã QR dán ở máy = link `/floor?ws=<qrToken>`:
 * mã chỉ định danh MÁY, PI lấy từ hàng đợi của tổ (QLSX xếp + "Chuyển PI tiếp"), công nhân chỉ chọn SKU →
 * loại sắt + cỡ đoạn (Phôi, nhập SỐ ĐOẠN) hoặc mảnh (Hàn/Sơn, nhập SỐ MẢNH) → Lưu. QLSX kiểm rồi mới gửi KCS -
 * màn này KHÔNG có nút gửi KCS. Thiết kế cho điện thoại: 1 cột, chữ to, ô số mở bàn phím số, nút Lưu dính đáy.
 */

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth, type User } from '../../../context/AuthContext'
import { getPinStatus, loginUser, PIN_SETUP_REQUIRED, setupWorkerPin } from '../../../services/api'
import { ApiError } from '../../../services/core/apiError'
import {
  getMyOutput,
  getMyStats,
  getScanContext,
  postScanReport,
  receiveSteelByScan,
  type BeFloorStats,
  type BeMyOutputRow,
  type BeScanContext,
  type BeScanMaterial,
  type BeScanOrder,
  type BeScanPieceItem,
  type BeSteelToReceive,
} from '../../../services/floor-api'
import { useRetrySafeKey } from '../../../hooks/useRetrySafeKey'
import { fmtRate, OP_UNIT, opTitle, outputRangeDays, passRate, pendingText, totalsByOp } from './floorStats'
import {
  dayKey, describeError, hhmm, outputTotals, overBy, RANGE_LABEL, rangeBounds, receiveVerdict,
  type OutputRange, type OutputTotal,
} from './floorUi'

const LAST_WS_KEY = 'floor.lastWs'
const LAST_USER_KEY = 'floor.lastUsername'
const STAGE_LABEL: Record<string, string> = { PHOI: 'Phôi', HAN: 'Hàn', SON: 'Sơn' }
const STEP_LABEL: Record<string, string> = {
  CAT: 'Cắt', UON: 'Uốn', DAP: 'Dập', DUC_LO: 'Đục lỗ', TAN: 'Tán', TOP_DAU: 'Tóp đầu', XE: 'Xẻ',
}

function safeGet(k: string): string | null {
  try { return localStorage.getItem(k) } catch { return null }
}
function safeSet(k: string, v: string) {
  try { localStorage.setItem(k, v) } catch { /* trình duyệt chặn lưu - bỏ qua */ }
}
const errText = (e: unknown) => describeError(e).text
const digits = (s: string) => s.replace(/\D/g, '').slice(0, 5)
const fmtMm = (n: number) => n.toLocaleString('vi-VN')
const fmtQty = (n: number) => n.toLocaleString('vi-VN')

// ─── khung ──────────────────────────────────────────────────────────────────

const page: React.CSSProperties = {
  minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: "'Inter', system-ui, sans-serif", fontSize: 16,
}
const wrap: React.CSSProperties = { maxWidth: 560, margin: '0 auto', padding: '0 16px 120px' }
const card: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
  padding: 16, boxShadow: 'var(--shadow-sm)',
}
const btn = (primary: boolean, disabled = false): React.CSSProperties => ({
  minHeight: 52, padding: '0 18px', borderRadius: 10, fontSize: 17, fontWeight: 600,
  border: primary ? 'none' : '1px solid var(--border2)',
  background: disabled ? 'var(--surface2)' : primary ? 'var(--floor-primary)' : 'var(--surface)',
  color: disabled ? 'var(--floor-hint)' : primary ? '#fff' : 'var(--text)',
  cursor: disabled ? 'default' : 'pointer', width: '100%',
})
const chip = (on: boolean): React.CSSProperties => ({
  minHeight: 44, padding: '0 14px', borderRadius: 999, fontSize: 15, fontWeight: on ? 600 : 500,
  border: `1px solid ${on ? 'var(--blue)' : 'var(--border2)'}`,
  background: on ? 'var(--blue-bg)' : 'var(--surface)', color: on ? 'var(--blue-text)' : 'var(--text)',
  cursor: 'pointer', whiteSpace: 'nowrap',
})
const numInput: React.CSSProperties = {
  width: 84, minHeight: 48, fontSize: 20, fontWeight: 600, textAlign: 'center',
  border: '1px solid var(--border2)', borderRadius: 10, background: 'var(--surface)', color: 'var(--text)',
}
const label: React.CSSProperties = { fontSize: 14, color: 'var(--text2)', fontWeight: 600, marginBottom: 8 }

function Banner({ tone, alert, children }: { tone: 'ok' | 'err' | 'warn' | 'info'; alert?: boolean; children: React.ReactNode }) {
  const c = {
    ok: ['var(--green-bg)', 'var(--green)'], err: ['var(--red-bg)', 'var(--red)'],
    warn: ['var(--amber-bg)', 'var(--amber)'], info: ['var(--blue-bg)', 'var(--blue-text)'],
  }[tone]
  return (
    <div role={tone === 'err' || alert ? 'alert' : 'status'} style={{
      background: c[0], color: c[1], borderRadius: 10, padding: '12px 14px', fontSize: 15, fontWeight: 500,
    }}>{children}</div>
  )
}

function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 20,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
    }}>
      <div style={{ maxWidth: 528, margin: '0 auto' }}>{children}</div>
    </div>
  )
}

/**
 * Bảng xác nhận TRƯỚC KHI lưu (người dùng 2026-10-15: "lưu gì lớn hay bé cũng xác nhận" - công nhân không tự sửa được,
 * chỉ QLSX đảo trước khi gửi KCS nên đếm lại một lần ở đây rẻ hơn nhiều). Liệt kê đúng những gì sắp ghi; dòng nào vượt
 * kế hoạch thì nói rõ. Đóng bằng "Sửa lại", nút nền mờ hoặc phím Esc; trả focus về nút Lưu.
 */
function ConfirmSheet({ title, context, rows, total, notes, confirmLabel, busy, onConfirm, onCancel }: {
  title: string
  context: string
  rows: { label: string; value: string; warn?: string }[]
  total?: string
  notes?: string[]
  confirmLabel: string
  busy: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    return () => prev?.focus?.()
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onCancel])
  return (
    <div
      onClick={() => { if (!busy) onCancel() }}
      style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div
        ref={ref} role="dialog" aria-modal="true" aria-labelledby="floor-confirm-title" tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '90dvh', overflowY: 'auto', outline: 'none',
          background: 'var(--surface)', borderRadius: '16px 16px 0 0', display: 'flex', flexDirection: 'column', gap: 12,
          padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        }}
      >
        <div>
          <h2 id="floor-confirm-title" style={{ fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>{context}</div>
        </div>
        <div style={{ ...card, padding: 0 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{r.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
              </div>
              {r.warn && <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600 }}><span aria-hidden>⚠ </span>{r.warn}</div>}
            </div>
          ))}
        </div>
        {total && <div style={{ fontSize: 16, fontWeight: 700, textAlign: 'right' }}>{total}</div>}
        {(notes ?? []).map((n) => <Banner key={n} tone="warn">{n}</Banner>)}
        <button type="button" disabled={busy} style={btn(true, busy)} onClick={onConfirm}>{busy ? 'Đang lưu…' : confirmLabel}</button>
        <button type="button" disabled={busy} style={btn(false, busy)} onClick={onCancel}>Sửa lại</button>
      </div>
    </div>
  )
}

// ─── đăng nhập PIN (ngay trên màn này để không mất mã máy trong link) ────────
//
// 3 bước, KHÔNG có nút "lần đầu đăng nhập" (người dùng 2026-10-14: công nhân mới không phải gõ PIN giả để hệ thống nhận ra):
//   1) nhập tên  ->  2) BE cho biết tài khoản đã có PIN chưa  ->  3a) đã có: chỉ nhập PIN
//                                                                 3b) chưa có: đặt PIN + nhập lại để xác nhận.
// Tên đã nhớ từ lần trước thì tự bước qua bước 1 (không thêm thao tác nào so với trước). BE chống dò tài khoản nên tên
// lạ / ngoài mạng công ty cũng vào bước "nhập PIN" - lỗi thật hiện sau khi bấm Đăng nhập.

type LoginStep = { kind: 'username' } | { kind: 'pin' } | { kind: 'setup'; expired: boolean }

function PinLogin() {
  const { login } = useAuth()
  const [username, setUsername] = useState(() => safeGet(LAST_USER_KEY) ?? '')
  const [step, setStep] = useState<LoginStep>({ kind: 'username' })
  // Có tên nhớ sẵn: tự hỏi BE ngay khi mở màn, trong lúc chờ hiện dòng "Đang kiểm tra…" thay vì ô nhập nhấp nháy.
  const [auto, setAuto] = useState(() => (safeGet(LAST_USER_KEY) ?? '').trim().length >= 3)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoRan = useRef(false)

  const name = username.trim().toLowerCase()

  const finish = (data: { accessToken: string; user: unknown }) => {
    safeSet(LAST_USER_KEY, name)
    login(data.accessToken, data.user as User)
  }

  const resetSecrets = () => { setPin(''); setPin2(''); setShow(false) }
  const changeUser = () => { setStep({ kind: 'username' }); resetSecrets(); setError(null); setAuto(false) }

  const checkUsername = useCallback(async (value: string) => {
    if (value.length < 3) { setError('Nhập tên đăng nhập'); return }
    setBusy(true); setError(null)
    try {
      const st = await getPinStatus(value)
      setStep(st.needsPin ? { kind: 'setup', expired: st.expired } : { kind: 'pin' })
    } catch (err) {
      setError(describeError(err).text)
    } finally { setBusy(false); setAuto(false) }
  }, [])

  // Tự kiểm tra tên đã nhớ - chỉ 1 lần (Strict Mode dev chạy effect 2 lần).
  useEffect(() => {
    if (!auto || autoRan.current) return
    autoRan.current = true
    void checkUsername(name)
  }, [auto, name, checkUsername])

  const submitUsername = (e: React.FormEvent) => { e.preventDefault(); void checkUsername(name) }

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 6) { setError('PIN phải đủ 6 số'); return }
    setBusy(true); setError(null)
    try {
      finish(await loginUser({ username: name, password: pin }))
    } catch (err) {
      if (err instanceof ApiError && err.message === PIN_SETUP_REQUIRED) {
        // Dự phòng: BE vừa chuyển tài khoản sang "chưa có PIN" (QLSX vừa cho đặt lại) - sang bước đặt PIN.
        resetSecrets(); setStep({ kind: 'setup', expired: false })
      } else {
        // BE trả "còn N lần thử" / "khoá tạm" cho công nhân; lỗi sai chung chung thì hiện câu thân thiện.
        setError(err instanceof ApiError && err.message === 'Invalid credentials'
          ? 'Sai tên đăng nhập hoặc PIN' : errText(err))
        setPin('')
      }
    } finally { setBusy(false) }
  }

  const submitSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pin.length < 6) { setError('PIN phải đủ 6 số'); return }
    if (pin !== pin2) { setError('Hai lần nhập PIN chưa giống nhau'); return }
    setBusy(true); setError(null)
    try {
      finish(await setupWorkerPin(name, pin, pin2))
    } catch (err) { setError(errText(err)); setPin2('') } finally { setBusy(false) }
  }

  const field: React.CSSProperties = {
    width: '100%', minHeight: 52, fontSize: 18, padding: '0 14px', borderRadius: 10,
    border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)',
  }
  const pinField: React.CSSProperties = { ...field, letterSpacing: show ? '0.2em' : '0.4em', fontSize: 22 }
  const digitsOnly = (v: string) => v.replace(/\D/g, '').slice(0, 6)
  const form: React.CSSProperties = { ...card, display: 'flex', flexDirection: 'column', gap: 14, marginTop: 24 }

  // Dòng "Tài khoản: abc [Đổi]" ở bước 2/3 - sai tên thì quay lại bước 1.
  const who = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text2)' }}>
        Tài khoản: <b style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{name}</b>
      </span>
      <button type="button" onClick={changeUser} style={{ ...chip(false), minHeight: 40 }}>Đổi</button>
    </div>
  )

  if (auto && step.kind === 'username') {
    return <div style={{ ...card, marginTop: 24 }} role="status">Đang kiểm tra tài khoản…</div>
  }

  if (step.kind === 'setup') {
    if (step.expired) {
      return (
        <div style={form}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Chưa đặt được PIN</h2>
          {who}
          <Banner tone="warn">Đã quá hạn đặt PIN lần đầu - báo QLSX cho đặt lại, rồi mở lại màn này.</Banner>
        </div>
      )
    }
    return (
      <form onSubmit={submitSetup} style={form}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Đặt PIN lần đầu</h2>
        {who}
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>
          Tài khoản này chưa có PIN. Chọn 1 PIN gồm 6 số, chỉ bạn biết - không ai khác (kể cả QLSX) xem được. Mọi số bạn báo sẽ ghi theo tên bạn.
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>PIN mới (6 số)</span>
          <input value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} inputMode="numeric" autoFocus
            type={show ? 'text' : 'password'} autoComplete="new-password" style={pinField} placeholder="••••••" />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>Nhập lại PIN để xác nhận</span>
          <input value={pin2} onChange={(e) => setPin2(digitsOnly(e.target.value))} inputMode="numeric"
            type={show ? 'text' : 'password'} autoComplete="new-password" style={pinField} placeholder="••••••" />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, minHeight: 44 }}>
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} style={{ width: 22, height: 22 }} />
          Hiện PIN
        </label>
        <div style={{ fontSize: 14, color: 'var(--floor-hint)' }}>Tránh PIN dễ đoán như 123456, 000000, 121212. Nhớ PIN - quên thì báo QLSX cho đặt lại.</div>
        {error && <Banner tone="err">{error}</Banner>}
        <button type="submit" disabled={busy} style={btn(true, busy)}>{busy ? 'Đang lưu…' : 'Lưu PIN và đăng nhập'}</button>
      </form>
    )
  }

  if (step.kind === 'pin') {
    return (
      <form onSubmit={submitPin} style={form}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Nhập PIN để đăng nhập</h2>
        {who}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={label}>PIN (6 số)</span>
          <input value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} autoFocus
            inputMode="numeric" type="password" autoComplete="current-password" style={pinField} placeholder="••••••" />
        </label>
        {error && <Banner tone="err">{error}</Banner>}
        <button type="submit" disabled={busy} style={btn(true, busy)}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        <div style={{ fontSize: 14, color: 'var(--floor-hint)' }}>Quên PIN hoặc chưa có tài khoản: báo QLSX. Nhập sai PIN 5 lần sẽ bị khoá tạm 15 phút.</div>
      </form>
    )
  }

  return (
    <form onSubmit={submitUsername} style={form}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Đăng nhập để báo sản lượng</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={label}>Tên đăng nhập</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off"
          autoComplete="username" style={field} placeholder="vd phoi.tuan" />
      </label>
      {error && <Banner tone="err">{error}</Banner>}
      <button type="submit" disabled={busy} style={btn(true, busy)}>{busy ? 'Đang kiểm tra…' : 'Tiếp tục'}</button>
      <div style={{ fontSize: 14, color: 'var(--floor-hint)' }}>Chưa có tài khoản: báo QLSX.</div>
    </form>
  )
}

// ─── chọn PI / SKU ───────────────────────────────────────────────────────────

function PiPicker({ ctx, selectedPi, onSelect }: {
  ctx: BeScanContext; selectedPi: string | null; onSelect: (id: string) => void
}) {
  const running = ctx.runningPi
  const rework = ctx.reworkPis ?? []
  if (!running && rework.length === 0) return null
  return (
    <div>
      <div style={label}>PI</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {running && (
          <button type="button" aria-pressed={selectedPi === running.productionInvoiceId} style={chip(selectedPi === running.productionInvoiceId)}
            onClick={() => onSelect(running.productionInvoiceId)}>
            {running.code} · đang chạy
          </button>
        )}
        {rework.map((r) => (
          <button key={r.productionInvoiceId} type="button" aria-pressed={selectedPi === r.productionInvoiceId} style={chip(selectedPi === r.productionInvoiceId)}
            onClick={() => onSelect(r.productionInvoiceId)}>
            {r.code} · bù lỗi
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * `piCode` có giá trị khi tổ chỉ có đúng 1 PI (đang chạy, không có PI bù lỗi): khỏi chiếm 1 hàng nhãn + chip chọn PI, mã PI
 * ghép vào dòng này (màn điện thoại nhỏ: ô nhập số phải nằm trên nếp gập - đo trên điện thoại thật 2026-10-15).
 */
function SkuPicker({ orders, value, onChange, piCode }: {
  orders: BeScanOrder[]; value: string | null; onChange: (id: string) => void; piCode?: string
}) {
  const piText = piCode ? <>PI <b style={{ color: 'var(--text)' }}>{piCode}</b> (đang chạy)</> : null
  if (orders.length <= 1) {
    const o = orders[0]
    if (!o) return piText ? <div style={{ fontSize: 14, color: 'var(--text2)' }}>{piText}</div> : null
    return (
      <div style={{ fontSize: 14, color: 'var(--text2)' }}>
        {piText}{piText ? ' · ' : ''}SKU <b style={{ color: 'var(--text)' }}>{o.sku}</b> · {o.productName} · {o.quantity} cái
      </div>
    )
  }
  return (
    <div>
      {piText && <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>{piText}</div>}
      <div style={label}>SKU</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {orders.map((o) => (
          <button key={o.productionOrderId} type="button" aria-pressed={value === o.productionOrderId} style={chip(value === o.productionOrderId)}
            onClick={() => onChange(o.productionOrderId)}>
            {o.sku} · {o.quantity}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Phôi: số đoạn theo cỡ ───────────────────────────────────────────────────

function SegmentForm({ materials, orderId, kindLabel, context, onSubmit }: {
  materials: BeScanMaterial[]; orderId: string; kindLabel: string
  /** "PI-2026-040 · GHE-J55" - hiện ở bảng xác nhận để công nhân biết đang lưu cho PI/SKU nào. */
  context: string
  onSubmit: (materialId: string, segments: { segmentSpecId: string; qty: number }[], summary: string) => Promise<boolean>
}) {
  // Chỉ loại sắt có cỡ đoạn thuộc SKU đang chọn (byOrder) - PI gộp nhiều SKU thì mỗi SKU 1 bộ cỡ khác nhau.
  const forSku = useMemo(() => materials
    .map((m) => ({
      ...m,
      segments: m.segments
        .map((s) => {
          const o = s.byOrder.find((b) => b.productionOrderId === orderId)
          return o && o.required > 0 ? { ...s, required: o.required, done: o.done } : null
        })
        .filter((s): s is NonNullable<typeof s> => !!s)
        .sort((a, b) => b.cutLengthMm - a.cutLengthMm),
    }))
    .filter((m) => m.segments.length > 0), [materials, orderId])

  const [materialId, setMaterialId] = useState<string | null>(null)
  const [qty, setQty] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showWaiting, setShowWaiting] = useState(false)
  // Báo cắt chỉ làm được với loại sắt ĐÃ nhận: loại chưa nhận không phải lựa chọn nên không bày thành chip (trên điện
  // thoại thật 4/7 chip là "chưa nhận" đẩy ô nhập số xuống dưới nếp gập) - gom vào 1 dòng bấm mở.
  const needsReceived = kindLabel === 'Cắt'
  const usable = forSku.filter((m) => !needsReceived || m.hasReceivedSteel)
  const waiting = forSku.filter((m) => needsReceived && !m.hasReceivedSteel)
  const current = usable.find((m) => m.materialId === materialId) ?? usable[0] ?? forSku[0] ?? null

  if (!current) return <Banner tone="info">SKU này không có đoạn nào cần {kindLabel.toLowerCase()}.</Banner>

  const lines = current.segments
    .map((s) => ({ s, n: Number(qty[s.segmentSpecId] || 0) }))
    .filter((x) => x.n > 0)
  const total = lines.reduce((t, x) => t + x.n, 0)
  const blocked = needsReceived && !current.hasReceivedSteel
  const confirmRows = lines.map((x) => {
    const over = overBy(x.s.required, x.s.done, x.n)
    return {
      label: `${fmtMm(x.s.cutLengthMm)} mm`,
      value: `${x.n} đoạn`,
      warn: over > 0 ? `vượt ${over} so với kế hoạch (cần ${x.s.required}, đã ${kindLabel.toLowerCase()} ${x.s.done})` : undefined,
    }
  })
  const anyOver = confirmRows.some((r) => r.warn)

  const ask = () => { if (lines.length && !blocked) setConfirming(true) }
  const submit = async () => {
    if (!lines.length || blocked) return
    setBusy(true)
    const summary = lines.map((x) => `${x.n} đoạn ${fmtMm(x.s.cutLengthMm)}mm`).join(', ')
    const ok = await onSubmit(current.materialId, lines.map((x) => ({ segmentSpecId: x.s.segmentSpecId, qty: x.n })), summary)
    setBusy(false)
    setConfirming(false) // lỗi thì banner đỏ ở đầu trang, số vẫn còn nguyên để bấm lại
    if (ok) setQty({})
  }

  return (
    <>
      {usable.length > 1 ? (
        <div>
          <div style={label}>Loại sắt</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {usable.map((m) => (
              <button key={m.materialId} type="button" aria-pressed={m.materialId === current.materialId} style={chip(m.materialId === current.materialId)}
                onClick={() => { setMaterialId(m.materialId); setQty({}) }}>
                {m.materialName}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>Loại sắt <b style={{ fontSize: 16, color: 'var(--text)' }}>{current.materialName}</b></div>
      )}
      {waiting.length > 0 && (
        <div>
          <button type="button" aria-expanded={showWaiting} onClick={() => setShowWaiting((v) => !v)}
            style={{ ...chip(false), fontSize: 14, color: 'var(--floor-hint)' }}>
            {waiting.length} loại sắt chưa nhận <span aria-hidden>{showWaiting ? '▴' : '▾'}</span>
          </button>
          {showWaiting && (
            <div style={{ marginTop: 8, fontSize: 14, color: 'var(--text2)' }}>
              {waiting.map((m) => m.materialName).join(', ')}. Quét mã khu nhận sắt để xác nhận trước khi báo cắt.
            </div>
          )}
        </div>
      )}
      {blocked && <Banner tone="warn">Loại sắt này chưa nhận - quét mã khu nhận sắt để xác nhận trước khi báo cắt.</Banner>}
      <div style={{ ...card, padding: 0 }}>
        {current.segments.map((s, i) => {
          const left = s.required - s.done
          return (
            <div key={s.segmentSpecId} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
              borderTop: i ? '1px solid var(--border)' : 'none',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{fmtMm(s.cutLengthMm)} mm</div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                  Đã {kindLabel.toLowerCase()} {s.done}/{s.required}
                  {left > 0
                    ? <> · <b style={{ fontSize: 16, color: 'var(--text)' }}>còn {left}</b></>
                    : left < 0
                      ? <> · <b style={{ fontSize: 16, color: 'var(--amber)' }}><span aria-hidden>⚠ </span>vượt {-left}</b></>
                      : <> · <b style={{ fontSize: 16, color: 'var(--green)' }}><span aria-hidden>✓ </span>đủ</b></>}
                </div>
              </div>
              <input aria-label={`Số đoạn ${s.cutLengthMm}mm`} inputMode="numeric" disabled={blocked}
                value={qty[s.segmentSpecId] ?? ''} placeholder="0" style={numInput}
                onChange={(e) => setQty((q) => ({ ...q, [s.segmentSpecId]: digits(e.target.value) }))} />
            </div>
          )
        })}
      </div>
      <StickyBar>
        <button type="button" disabled={!total || busy || blocked} style={btn(true, !total || busy || blocked)} onClick={ask}>
          {busy ? 'Đang lưu…' : total ? `Lưu ${total} đoạn` : 'Nhập số đoạn'}
        </button>
      </StickyBar>
      {confirming && (
        <ConfirmSheet
          title={`Xác nhận báo ${kindLabel.toLowerCase()}`}
          context={`${current.materialName} · ${context}`}
          rows={confirmRows}
          total={`Tổng ${total} đoạn`}
          notes={anyOver ? ['Có cỡ vượt kế hoạch - đếm lại cho chắc. QLSX sẽ thấy cảnh báo vượt khi kiểm.'] : undefined}
          confirmLabel={`Đúng, lưu ${total} đoạn`}
          busy={busy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

// ─── Hàn/Sơn: số mảnh ────────────────────────────────────────────────────────

function PieceForm({ items, context, stageLabel, onSubmit }: {
  items: BeScanPieceItem[]
  /** "PI-2026-040 · GHE-J55" - hiện ở bảng xác nhận. */
  context: string
  stageLabel: string
  onSubmit: (pieceId: string, qty: number, summary: string) => Promise<boolean>
}) {
  const [pieceId, setPieceId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const piece = items.find((p) => p.pieceId === pieceId) ?? null
  const n = Number(qty || 0)

  if (!items.length) return <Banner tone="info">SKU này không có mảnh nào qua công đoạn này.</Banner>
  const ask = () => { if (piece && n) setConfirming(true) }
  const submit = async () => {
    if (!piece || !n) return
    setBusy(true)
    const ok = await onSubmit(piece.pieceId, n, `${n} ${piece.pieceName}`)
    setBusy(false)
    setConfirming(false) // lỗi thì banner đỏ ở đầu trang, số vẫn còn nguyên để bấm lại
    if (ok) setQty('')
  }
  // Đã báo (cả phần chờ QLSX gửi) + lần này so với kế hoạch của mảnh.
  const reported = piece ? piece.passedQty + piece.awaitingQcQty + piece.openQty : 0
  const over = piece ? overBy(piece.plannedQty, reported, n) : 0
  return (
    <>
      <div style={{ ...card, padding: 0 }}>
        {items.map((p, i) => {
          const on = p.pieceId === pieceId
          const done = p.passedQty + p.awaitingQcQty
          return (
            <button key={p.pieceId} type="button" aria-pressed={on} onClick={() => { setPieceId(p.pieceId); setQty('') }} style={{
              display: 'flex', width: '100%', textAlign: 'left', alignItems: 'center', gap: 12,
              padding: '14px 16px', border: 'none', borderTop: i ? '1px solid var(--border)' : 'none',
              background: on ? 'var(--blue-bg)' : 'transparent', color: 'var(--text)', cursor: 'pointer',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{p.pieceName}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                  Đã gửi KCS {done}/{p.plannedQty}
                  {p.openQty > 0 && <> · <span style={{ color: 'var(--amber)' }}>chờ QLSX gửi {p.openQty}</span></>}
                </div>
              </div>
              <span aria-hidden style={{ fontSize: 20, color: on ? 'var(--blue)' : 'var(--floor-hint)' }}>{on ? '●' : '○'}</span>
            </button>
          )
        })}
      </div>
      <StickyBar>
        {piece ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input aria-label={`Số mảnh ${piece.pieceName}`} inputMode="numeric" value={qty} placeholder="0"
              autoFocus style={{ ...numInput, width: 96 }} onChange={(e) => setQty(digits(e.target.value))} />
            <button type="button" disabled={!n || busy} style={btn(true, !n || busy)} onClick={ask}>
              {busy ? 'Đang lưu…' : n ? `Lưu ${n} ${piece.pieceName}` : 'Nhập số mảnh'}
            </button>
          </div>
        ) : (
          <button type="button" disabled style={btn(true, true)}>Chọn mảnh</button>
        )}
      </StickyBar>
      {confirming && piece && (
        <ConfirmSheet
          title={`Xác nhận báo ${stageLabel}`}
          context={context}
          rows={[{
            label: piece.pieceName,
            value: `${n} mảnh`,
            warn: over > 0 ? `vượt ${over} so với kế hoạch (cần ${piece.plannedQty}, đã báo ${reported})` : undefined,
          }]}
          notes={over > 0 ? ['Vượt kế hoạch - đếm lại cho chắc. QLSX sẽ thấy cảnh báo vượt khi kiểm.'] : undefined}
          confirmLabel={`Đúng, lưu ${n} mảnh`}
          busy={busy}
          onConfirm={() => void submit()}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

// ─── khu nhận sắt ────────────────────────────────────────────────────────────

function SteelReceiveRow({ issue, onReceive }: {
  issue: BeSteelToReceive; onReceive: (issue: BeSteelToReceive, count: number) => Promise<boolean>
}) {
  // Ô để TRỐNG (không điền sẵn số kho xuất): công nhân phải đếm rồi gõ số - điền sẵn thì bấm xác nhận mà không đếm
  // vẫn xong. Chip "Đủ N cây" chỉ ĐIỀN vào ô giúp gõ nhanh khi đếm thấy đủ, không tự gửi.
  const [count, setCount] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const verdict = receiveVerdict(count, issue.barCount)
  const n = Number(count || 0)
  const send = async () => { setBusy(true); const ok = await onReceive(issue, n); setBusy(false); if (!ok) setConfirming(false) }
  // Mọi lần nhận đều hỏi xác nhận (người dùng 2026-10-15). Lệch so với kho xuất thì nói rõ: số này làm kho + QLSX nhận cảnh báo.
  const onPress = () => { if (verdict.kind !== 'empty') setConfirming(true) }
  const diffText = verdict.kind === 'short' ? `thiếu ${-verdict.diff}` : verdict.kind === 'over' ? `thừa ${verdict.diff}` : ''
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{issue.materialName}</div>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>
          {issue.piCode} · kho xuất <b style={{ color: 'var(--text)' }}>{issue.barCount} cây</b> × {fmtMm(issue.barLengthMm)}mm
          {issue.issuedByName ? ` · ${issue.issuedByName}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 15 }}>Đếm được</span>
        <input aria-label={`Số cây ${issue.materialName} đếm được`} inputMode="numeric" value={count} placeholder="?" style={numInput}
          onChange={(e) => { setCount(digits(e.target.value)); setConfirming(false) }} />
        <span style={{ fontSize: 15, color: 'var(--text2)' }}>cây</span>
        <button type="button" style={{ ...chip(false), marginLeft: 'auto' }}
          onClick={() => { setCount(String(issue.barCount)); setConfirming(false) }}>
          Đủ {issue.barCount} cây
        </button>
      </div>
      {confirming && verdict.kind !== 'empty' ? (
        <>
          {verdict.kind === 'exact' ? (
            <Banner tone="info">Bạn đếm <b>{n} cây</b>, kho xuất {issue.barCount} cây: khớp. Xác nhận đã nhận?</Banner>
          ) : (
            <Banner tone="warn">
              Bạn đếm <b>{n} cây</b>, kho xuất {issue.barCount} cây: <b>{diffText} cây</b>. Kho và QLSX sẽ được báo. Đã đếm kỹ chưa?
            </Banner>
          )}
          <button type="button" disabled={busy} style={btn(true, busy)} onClick={() => void send()}>
            {busy ? 'Đang lưu…' : `Đúng, nhận ${n} cây`}
          </button>
          <button type="button" disabled={busy} style={btn(false, busy)} onClick={() => setConfirming(false)}>Đếm lại</button>
        </>
      ) : (
        <button type="button" disabled={verdict.kind === 'empty' || busy} style={btn(true, verdict.kind === 'empty' || busy)} onClick={onPress}>
          {busy ? 'Đang lưu…' : verdict.kind === 'empty' ? 'Nhập số cây đếm được' : 'Xác nhận đã nhận'}
        </button>
      )}
    </div>
  )
}

// ─── tab Báo sản lượng ───────────────────────────────────────────────────────

function ReportTab({ ws }: { ws: string }) {
  const [ctx, setCtx] = useState<BeScanContext | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [selectedPi, setSelectedPi] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err' | 'warn'; text: string; alert?: boolean } | null>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const retryKey = useRetrySafeKey()

  const load = useCallback(async (piId?: string | null) => {
    try {
      const c = await getScanContext(ws, piId ?? undefined)
      setCtx(c); setLoadErr(null)
      if (c.pi) setSelectedPi(c.pi.productionInvoiceId)
    } catch (e) { setLoadErr(errText(e)) }
  }, [ws])

  // Tải dữ liệu máy khi mở màn (đồng bộ với BE) - setState chỉ xảy ra sau khi request trả về.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const orders = ctx?.pi?.orders ?? []
  const effectiveOrder = orders.find((o) => o.productionOrderId === orderId)
    ?? orders.find((o) => o.floorStage === 'ACTIVE') ?? orders[0] ?? null
  // Tổ chỉ có 1 PI (đang chạy, không PI bù lỗi): bỏ hàng chọn PI, mã PI ghép vào dòng SKU.
  const onlyRunning = !!ctx?.runningPi && (ctx.reworkPis ?? []).length === 0

  const send = async (payload: Parameters<typeof postScanReport>[1], summary: string) => {
    setFlash(null)
    try {
      await postScanReport(ws, payload, retryKey.take(payload))
      retryKey.settle()
      setFlash({ tone: 'ok', text: `Đã lưu ${summary} · ${hhmm()}` })
      await load(selectedPi)
      return true
    } catch (e) {
      retryKey.settle(e)
      const info = describeError(e, true)
      setFlash({ tone: info.tone, text: info.text, alert: true })
      return false
    }
  }

  // Banner kết quả nằm đầu trang; công nhân bấm Lưu ở thanh dưới khi đang kéo xuống thì không thấy -> cuộn tới.
  useEffect(() => { flashRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [flash])

  if (loadErr) return <div style={{ marginTop: 16 }}><Banner tone="err">{loadErr}</Banner></div>
  if (!ctx) return <div style={{ marginTop: 24, color: 'var(--text2)' }}>Đang tải…</div>

  const w = ctx.workstation
  const title = w.kind === 'STEEL_RECEIVE' ? 'Nhận sắt'
    : w.kind === 'CUT' ? 'Báo cắt' : w.kind === 'STEP' ? `Báo ${STEP_LABEL[w.processStep ?? ''] ?? 'công đoạn'}`
      : `Báo ${STAGE_LABEL[w.stage]}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 700 }}>{title}</h2>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>{w.name} · {w.code} · tổ {STAGE_LABEL[w.stage]}</div>
      </div>
      {flash && <div ref={flashRef} style={{ scrollMarginTop: 120 }}><Banner tone={flash.tone} alert={flash.alert}>{flash.text}</Banner></div>}

      {w.kind === 'STEEL_RECEIVE' ? (
        (ctx.steelToReceive ?? []).length === 0
          ? <Banner tone="info">Không có đợt sắt nào đang chờ nhận.</Banner>
          : (ctx.steelToReceive ?? []).map((iss) => (
            <SteelReceiveRow key={iss.steelIssueId} issue={iss} onReceive={async (issue, count) => {
              setFlash(null)
              try {
                await receiveSteelByScan(ws, issue.steelIssueId, count)
                setFlash({ tone: 'ok', text: `Đã nhận ${count}/${issue.barCount} cây ${issue.materialName} · ${hhmm()}` })
                await load()
                return true
              } catch (e) {
                const info = describeError(e, true)
                setFlash({ tone: info.tone, text: info.text, alert: true })
                return false
              }
            }} />
          ))
      ) : !ctx.pi ? (
        <Banner tone="info">Tổ {STAGE_LABEL[w.stage]} chưa có PI đang chạy - báo QLSX bấm “Chuyển PI tiếp”.</Banner>
      ) : (
        <>
          {!onlyRunning && (
            <PiPicker ctx={ctx} selectedPi={selectedPi} onSelect={(id) => { setSelectedPi(id); setOrderId(null); setFlash(null); void load(id) }} />
          )}
          {selectedPi && selectedPi !== ctx.runningPi?.productionInvoiceId && (
            <Banner tone="warn">Đang báo BÙ LỖI cho {ctx.pi.code} (PI tổ đã chuyển qua).</Banner>
          )}
          <SkuPicker orders={orders} value={effectiveOrder?.productionOrderId ?? null} onChange={setOrderId}
            piCode={onlyRunning ? ctx.pi.code : undefined} />
          {effectiveOrder && effectiveOrder.floorStage !== 'ACTIVE' && (
            <Banner tone="warn">SKU này QLSX chưa bấm “Bắt đầu” (hoặc đang tạm dừng) - chưa báo được.</Banner>
          )}
          {effectiveOrder && (w.kind === 'PIECE' ? (
            <PieceForm
              key={effectiveOrder.productionOrderId}
              items={ctx.pi.piecePlans?.[effectiveOrder.productionOrderId]?.items ?? []}
              context={`${ctx.pi.code} · ${effectiveOrder.sku}`}
              stageLabel={STAGE_LABEL[w.stage].toLowerCase()}
              onSubmit={(pieceId, qty, summary) => send({
                productionInvoiceId: ctx.pi!.productionInvoiceId,
                productionOrderId: effectiveOrder.productionOrderId, pieceId, qty,
              }, summary)}
            />
          ) : (
            <SegmentForm
              key={effectiveOrder.productionOrderId}
              materials={ctx.pi.materials ?? []}
              orderId={effectiveOrder.productionOrderId}
              kindLabel={w.kind === 'CUT' ? 'Cắt' : STEP_LABEL[w.processStep ?? ''] ?? 'Làm'}
              context={`${ctx.pi.code} · ${effectiveOrder.sku}`}
              onSubmit={(materialId, segments, summary) => send({
                productionInvoiceId: ctx.pi!.productionInvoiceId,
                productionOrderId: effectiveOrder.productionOrderId, materialId, segments,
              }, summary)}
            />
          ))}
        </>
      )}
    </div>
  )
}

// ─── tab Sản lượng của tôi ───────────────────────────────────────────────────

const STATE_LABEL: Record<string, [string, string, string]> = {
  OPEN: ['Chưa gửi KCS', 'var(--surface2)', 'var(--text2)'],
  AWAITING_QC: ['Chờ KCS', 'var(--amber-bg)', 'var(--amber)'],
  QC_DONE: ['Đã KCS', 'var(--green-bg)', 'var(--green)'],
  REMOVED: ['—', 'var(--surface2)', 'var(--floor-hint)'],
}

// "đoạn đã cắt" / "đoạn đã uốn" / "mảnh đã báo" - chú thích dưới con số tổng. Không cộng chung các loại việc (đếm đôi).
function opCaption(t: OutputTotal): string {
  if (t.op === 'PIECE') return 'mảnh đã báo'
  return `đoạn đã ${t.op === 'STEP' ? 'làm công đoạn' : (STEP_LABEL[t.op] ?? t.op).toLowerCase()}`
}

// "Cắt 120 đoạn · Uốn 40 đoạn" - gọn cho dòng đầu mỗi ngày.
function totalsText(totals: OutputTotal[]): string {
  return totals.map((t) => t.op === 'PIECE'
    ? `${fmtQty(t.qty)} mảnh`
    : `${t.op === 'STEP' ? 'Công đoạn' : (STEP_LABEL[t.op] ?? t.op)} ${fmtQty(t.qty)} đoạn`).join(' · ')
}

const MAX_OUTPUT_ROWS = 500 // BE chỉ trả tối đa chừng này lần báo gần nhất (floor-scan.service myOutput: take 500)

function MyOutputTab() {
  const [range, setRange] = useState<OutputRange>('7d')
  const [result, setResult] = useState<{ range: OutputRange; rows: BeMyOutputRow[] | null; err: string | null } | null>(null)

  // Đổi khoảng thời gian thì tải lại; kết quả gắn với khoảng đã hỏi nên kết quả cũ (trả về muộn) không đè lên.
  useEffect(() => {
    let alive = true
    const { from, to } = rangeBounds(range)
    getMyOutput(from.toISOString(), to.toISOString())
      .then((rows) => { if (alive) setResult({ range, rows, err: null }) })
      .catch((e) => { if (alive) setResult({ range, rows: null, err: errText(e) }) })
    return () => { alive = false }
  }, [range])

  // Số ĐÃ KCS duyệt của chính mình (BE lấy id từ token - không xem được số của công nhân khác). Lỗi tải thì chỉ ẩn thẻ này,
  // danh sách "đã báo" bên dưới vẫn dùng được.
  const [kcs, setKcs] = useState<{ range: OutputRange; data: BeFloorStats | null } | null>(null)
  useEffect(() => {
    let alive = true
    const { from, to } = outputRangeDays(range)
    getMyStats({ from, to, groupBy: 'month' })
      .then((data) => { if (alive) setKcs({ range, data }) })
      .catch(() => { if (alive) setKcs({ range, data: null }) })
    return () => { alive = false }
  }, [range])

  const cur = result && result.range === range ? result : null
  const periodLabel = rangeBounds(range).label
  const kcsNow = kcs && kcs.range === range ? kcs : null
  const kcsTotals = kcsNow?.data ? totalsByOp(kcsNow.data.rows) : []
  const kcsWait = kcsNow?.data ? pendingText(kcsNow.data.pending) : ''

  let body: React.ReactNode
  if (!cur) {
    body = <div style={{ color: 'var(--text2)' }}>Đang tải…</div>
  } else if (cur.err) {
    body = <Banner tone="err">{cur.err}</Banner>
  } else if (!cur.rows?.length) {
    body = <Banner tone="info">Không có lần báo nào trong {periodLabel}.</Banner>
  } else {
    const rows = cur.rows
    const byDay = new Map<string, BeMyOutputRow[]>()
    for (const r of rows) {
      const k = dayKey(r.createdAt)
      byDay.set(k, [...(byDay.get(k) ?? []), r])
    }
    const totals = outputTotals(rows)
    const counted = rows.filter((r) => !r.reversed).length
    body = (
      <>
        {totals.length > 0 && (
          <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {totals.map((t) => (
              <div key={t.op}>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtQty(t.qty)}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>{opCaption(t)}</div>
              </div>
            ))}
            <div style={{ flexBasis: '100%', fontSize: 14, color: 'var(--text2)' }}>{counted} lần báo trong {periodLabel}</div>
          </div>
        )}
        {[...byDay.entries()].map(([k, list]) => {
          const dayTotals = outputTotals(list)
          return (
            <div key={k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <div style={{ ...label, marginBottom: 0 }}>
                  {new Date(list[0].createdAt).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </div>
                {dayTotals.length > 0 && <div style={{ fontSize: 14, fontWeight: 600, textAlign: 'right' }}>{totalsText(dayTotals)}</div>}
              </div>
              <div style={{ ...card, padding: 0 }}>
                {list.map((r, i) => {
                  const st = STATE_LABEL[r.state]
                  return (
                    <div key={r.id} style={{ padding: '12px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <div style={{ fontSize: 14, color: 'var(--text2)' }}>
                          <b style={{ fontSize: 16, color: 'var(--text)' }}>
                            {new Date(r.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </b>
                          {r.piCode ? ` · ${r.piCode}` : ''}
                          {r.kind === 'CUT' ? ' · Cắt' : r.step ? ` · ${STEP_LABEL[r.step] ?? r.step}` : ''}
                          {r.workstation ? ` · ${r.workstation.code}` : ' · màn thống kê'}
                        </div>
                        {!r.reversed && (
                          <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: st[1], color: st[2], whiteSpace: 'nowrap' }}>{st[0]}</span>
                        )}
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {r.lines.map((l, j) => (
                          <div key={j} style={{
                            display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 16, fontWeight: 600,
                            textDecoration: r.reversed ? 'line-through' : 'none',
                            color: r.reversed ? 'var(--floor-hint)' : 'var(--text)',
                          }}>
                            <span>{l.segment ? `${fmtMm(l.segment.cutLengthMm)} mm` : (l.piece?.name ?? 'Mảnh')}</span>
                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQty(l.qty)} {l.segment ? 'đoạn' : 'mảnh'}</span>
                          </div>
                        ))}
                      </div>
                      {r.reversed && (
                        <div style={{ marginTop: 6 }}>
                          <Banner tone="warn">
                            Đã bị đảo{r.reversed.byName ? ` bởi ${r.reversed.byName}` : ''}: {r.reversed.reason ?? 'không ghi lý do'}
                          </Banner>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        {rows.length >= MAX_OUTPUT_ROWS && (
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Chỉ hiện {MAX_OUTPUT_ROWS} lần báo gần nhất trong khoảng này.</div>
        )}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
      <div role="group" aria-label="Khoảng thời gian" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(Object.keys(RANGE_LABEL) as OutputRange[]).map((k) => (
          <button key={k} type="button" aria-pressed={range === k} style={chip(range === k)} onClick={() => setRange(k)}>
            {RANGE_LABEL[k]}
          </button>
        ))}
      </div>
      <section aria-label="Số đã KCS duyệt" style={card}>
        <div style={label}>Đã KCS duyệt · {periodLabel}</div>
        {!kcsNow ? (
          <div style={{ color: 'var(--text2)' }}>Đang tải…</div>
        ) : !kcsNow.data ? (
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Chưa xem được số KCS lúc này.</div>
        ) : kcsTotals.length === 0 ? (
          <div style={{ fontSize: 14, color: 'var(--text2)' }}>Chưa có số nào của bạn được KCS duyệt trong {periodLabel}.</div>
        ) : (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {kcsTotals.map((t) => (
              <div key={t.op}>
                <div style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>{opTitle(t.op)} đạt</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtQty(t.passed)}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)' }}>Lỗi {fmtQty(t.failed)} {OP_UNIT[t.op]} · tỷ lệ đạt {fmtRate(passRate(t))}</div>
              </div>
            ))}
          </div>
        )}
        {kcsWait && <div style={{ marginTop: 10, fontSize: 14, color: 'var(--text2)' }}>Đang chờ KCS: {kcsWait}</div>}
      </section>
      <div style={{ fontSize: 14, color: 'var(--text2)' }}>
        Số bạn ĐÃ BÁO trong {periodLabel} (chưa phải số đạt KCS). Lần bị QLSX đảo có ghi lý do.
      </div>
      {body}
    </div>
  )
}

// ─── khung chính ─────────────────────────────────────────────────────────────

function FloorScanInner() {
  const { user, loading, logout } = useAuth()
  const params = useSearchParams()
  const urlWs = params.get('ws')
  // Nhớ máy quét gần nhất - mở lại /floor (không có ?ws) thì vẫn về đúng máy đó.
  const [storedWs] = useState(() => safeGet(LAST_WS_KEY))
  const ws = urlWs ?? storedWs
  const [tab, setTab] = useState<'report' | 'mine'>('report')
  useEffect(() => { if (urlWs) safeSet(LAST_WS_KEY, urlWs) }, [urlWs])

  const isFloorTeam = !!user?.mfgRole && ['PHOI', 'HAN', 'SON'].includes(user.mfgRole)

  return (
    <div style={page} className="floor-root">
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ ...wrap, paddingBottom: 0, display: 'flex', alignItems: 'center', gap: 12, minHeight: 56 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700 }}>DNA · Báo sản lượng</h1>
            {user && <div style={{ fontSize: 14, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.name}{user.mfgRole ? ` · tổ ${STAGE_LABEL[user.mfgRole] ?? user.mfgRole}` : ''}
            </div>}
          </div>
          {user && <button type="button" onClick={logout} style={{ ...chip(false), minHeight: 40 }}>Đăng xuất</button>}
        </div>
        {user && isFloorTeam && (
          <div role="tablist" style={{ ...wrap, paddingBottom: 0, display: 'flex' }}>
            {([['report', 'Báo sản lượng'], ['mine', 'Sản lượng của tôi']] as const).map(([k, t]) => (
              <button key={k} role="tab" id={`floor-tab-${k}`} aria-controls="floor-panel" aria-selected={tab === k} type="button" onClick={() => setTab(k)} style={{
                flex: 1, minHeight: 48, border: 'none', background: 'transparent', fontSize: 15,
                fontWeight: tab === k ? 700 : 500, color: tab === k ? 'var(--floor-tab-active)' : 'var(--text2)',
                borderBottom: `3px solid ${tab === k ? 'var(--blue)' : 'transparent'}`, cursor: 'pointer',
              }}>{t}</button>
            ))}
          </div>
        )}
      </header>
      <main style={wrap}>
        <div {...(user && isFloorTeam ? { role: 'tabpanel', id: 'floor-panel', 'aria-labelledby': `floor-tab-${tab}` } : {})}>
        {loading ? (
          <div style={{ marginTop: 24, color: 'var(--text2)' }}>Đang tải…</div>
        ) : !user ? (
          <PinLogin />
        ) : !isFloorTeam ? (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Banner tone="warn">Màn này dành cho công nhân tổ Phôi, Hàn, Sơn. Tài khoản {user.name} không thuộc tổ nào.</Banner>
            <Link href="/" style={{ ...btn(false), display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Về trang chính</Link>
          </div>
        ) : tab === 'mine' ? (
          <MyOutputTab />
        ) : !ws ? (
          // Không có nút quét trong app (người dùng 2026-10-15): công nhân quét tem bằng app camera của điện thoại.
          <div style={{ marginTop: 16 }}>
            <Banner tone="info">Quét mã QR dán ở máy / điểm làm việc bằng <b>app camera của điện thoại</b> để bắt đầu báo.</Banner>
          </div>
        ) : (
          <ReportTab key={ws} ws={ws} />
        )}
        </div>
      </main>
    </div>
  )
}

export default function FloorScanApp() {
  return (
    <Suspense fallback={null}>
      <FloorScanInner />
    </Suspense>
  )
}

'use client'

/** Đăng nhập PIN ngay trên màn quét để không mất mã máy trong link. Trạng thái ở usePinLogin. */

import type { CSSProperties, ReactNode } from 'react'
import { digitsOnly } from './scanModel'
import { Banner } from './ScanParts'
import { btn, card, chip, column, fieldInput, heading, hint, hintFaint, label } from './scanUi'
import { usePinLogin, type PinLoginState } from './usePinLogin'

const form: CSSProperties = { ...card, ...column(14), marginTop: 24 }
const fieldLabel: CSSProperties = column(6)
const pinStyle = (show: boolean): CSSProperties => ({ ...fieldInput, letterSpacing: show ? '0.2em' : '0.4em', fontSize: 22 })

/** Dòng "Tài khoản: abc [Đổi]" ở bước 2/3 - sai tên thì quay lại bước 1. */
function Who({ name, onChange }: { name: string; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
      <span style={{ flex: 1, minWidth: 0, color: 'var(--text2)' }}>
        Tài khoản: <b style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{name}</b>
      </span>
      <button type="button" onClick={onChange} style={{ ...chip(false), minHeight: 40 }}>Đổi</button>
    </div>
  )
}

function PinField({ title, children }: { title: string; children: ReactNode }) {
  return (
    <label style={fieldLabel}>
      <span style={label}>{title}</span>
      {children}
    </label>
  )
}

function SetupForm({ s }: { s: PinLoginState }) {
  const type = s.show ? 'text' : 'password'
  return (
    <form onSubmit={s.submitSetup} style={form}>
      <h2 style={heading}>Đặt PIN lần đầu</h2>
      <Who name={s.name} onChange={s.changeUser} />
      <div style={hint}>
        Bạn chưa có PIN. Hãy chọn 6 số làm PIN. Chỉ mình bạn biết PIN này, quản lý cũng không xem được. Số bạn báo sẽ ghi theo tên bạn.
      </div>
      <PinField title="PIN mới (6 số)">
        <input value={s.pin} onChange={(e) => s.setPin(digitsOnly(e.target.value))} inputMode="numeric" autoFocus
          type={type} autoComplete="new-password" style={pinStyle(s.show)} placeholder="••••••" />
      </PinField>
      <PinField title="Nhập lại PIN để xác nhận">
        <input value={s.pin2} onChange={(e) => s.setPin2(digitsOnly(e.target.value))} inputMode="numeric"
          type={type} autoComplete="new-password" style={pinStyle(s.show)} placeholder="••••••" />
      </PinField>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, minHeight: 44 }}>
        <input type="checkbox" checked={s.show} onChange={(e) => s.setShow(e.target.checked)} style={{ width: 22, height: 22 }} />
        Hiện PIN
      </label>
      <div style={hintFaint}>Đừng chọn số dễ đoán như 123456, 000000. Quên PIN thì báo quản lý cho đặt lại.</div>
      {s.error && <Banner tone="err">{s.error}</Banner>}
      <button type="submit" disabled={s.busy} style={btn(true, s.busy)}>{s.busy ? 'Đang lưu…' : 'Lưu PIN và đăng nhập'}</button>
    </form>
  )
}

function ExpiredNotice({ s }: { s: PinLoginState }) {
  return (
    <div style={form}>
      <h2 style={heading}>Chưa đặt được PIN</h2>
      <Who name={s.name} onChange={s.changeUser} />
      <Banner tone="warn">Hết hạn đặt PIN. Báo quản lý cho đặt lại, rồi mở lại màn này.</Banner>
    </div>
  )
}

function EnterPinForm({ s }: { s: PinLoginState }) {
  return (
    <form onSubmit={s.submitPin} style={form}>
      <h2 style={heading}>Nhập PIN để đăng nhập</h2>
      <Who name={s.name} onChange={s.changeUser} />
      <PinField title="PIN (6 số)">
        <input value={s.pin} onChange={(e) => s.setPin(digitsOnly(e.target.value))} autoFocus
          inputMode="numeric" type="password" autoComplete="current-password" style={pinStyle(s.show)} placeholder="••••••" />
      </PinField>
      {s.error && <Banner tone="err">{s.error}</Banner>}
      <button type="submit" disabled={s.busy} style={btn(true, s.busy)}>{s.busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
      <div style={hintFaint}>Quên PIN: báo quản lý. Nhập sai 5 lần sẽ bị khoá 15 phút.</div>
    </form>
  )
}

function UsernameForm({ s }: { s: PinLoginState }) {
  return (
    <form onSubmit={s.submitUsername} style={form}>
      <h2 style={heading}>Đăng nhập để báo sản lượng</h2>
      <PinField title="Tên đăng nhập">
        <input value={s.username} onChange={(e) => s.setUsername(e.target.value)} autoCapitalize="none" autoCorrect="off"
          autoComplete="username" style={fieldInput} placeholder="ví dụ: phoi.tuan" />
      </PinField>
      {s.error && <Banner tone="err">{s.error}</Banner>}
      <button type="submit" disabled={s.busy} style={btn(true, s.busy)}>{s.busy ? 'Đang kiểm tra…' : 'Tiếp tục'}</button>
      <div style={hintFaint}>Chưa có tài khoản: báo quản lý.</div>
    </form>
  )
}

export default function PinLogin() {
  const s = usePinLogin()
  if (s.auto && s.step.kind === 'username') {
    return <div style={{ ...card, marginTop: 24 }} role="status">Đang kiểm tra tài khoản…</div>
  }
  if (s.step.kind === 'setup') return s.step.expired ? <ExpiredNotice s={s} /> : <SetupForm s={s} />
  if (s.step.kind === 'pin') return <EnterPinForm s={s} />
  return <UsernameForm s={s} />
}

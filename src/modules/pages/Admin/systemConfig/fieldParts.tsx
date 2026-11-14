'use client'

/** Mảnh dùng chung của các ô nhập: lời giải thích có "Xem thêm", ô nhập kèm lỗi, ô số của nhóm Máy cắt / Kế hoạch. */

import { useState, type CSSProperties } from 'react'
import type { SystemConfig } from '../../../../types/admin'
import { fmtMcNum, type McField, type McKey } from './mcFields'
import { errBorder, errorStyle, helpStyle, inputStyle, labelStyle } from './systemConfigStyles'
import type { McErrors, McText } from './validate'

/** Trạng thái form mà các khối con đọc / ghi: giá trị hiện tại, chữ đang gõ, lỗi theo ô. */
export interface ConfigForm {
  values: SystemConfig
  text: McText
  errors: McErrors
  /** Ghi chữ đang gõ của ô `key` và xoá lỗi của ô đó. */
  setText: (key: McKey, value: string) => void
  /** Sửa trực tiếp giá trị cấu hình (ô bật/tắt, chọn máy theo xưởng, IP...). */
  patch: (p: Partial<SystemConfig>) => void
}

/** Lời giải thích dưới ô: phần ngắn luôn hiện, phần dài (`more`) bấm "Xem thêm" mới mở - không mất thông tin. */
export function HelpText({ id, text, more }: { id: string; text: string; more?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div id={id} style={helpStyle}>
      {text}
      {more && open && <> {more}</>}
      {more && (
        <>
          {' '}
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            style={{
              padding: 0, border: 'none', background: 'none', font: 'inherit', fontWeight: 600, color: 'var(--fg-3949ab)',
              cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {open ? 'Thu gọn' : 'Xem thêm'}
          </button>
        </>
      )}
    </div>
  )
}

/** Ô nhập chữ của khoá `k`: giá trị đang gõ (nếu có) không thì `value`; lỗi hiện ngay dưới ô (aria-invalid, aria-describedby). */
export function McInput({ k, form, value, helpId, placeholder, inputMode, disabled, style }: {
  k: McKey
  form: ConfigForm
  /** Giá trị hiện khi chưa gõ gì (dữ liệu đã lưu). */
  value: string
  helpId?: string
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  disabled?: boolean
  style?: CSSProperties
}) {
  const err = form.errors[k]
  const errId = `mc-${k}-error`
  return (
    <>
      <input
        id={`mc-${k}`}
        value={form.text[k] ?? value}
        onChange={(e) => form.setText(k, e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        disabled={disabled}
        aria-invalid={err ? true : undefined}
        aria-describedby={helpId ? `${helpId}${err ? ` ${errId}` : ''}` : err ? errId : undefined}
        style={{ ...inputStyle, ...errBorder(err), ...style }}
      />
      {err && <div id={errId} role="alert" style={errorStyle}>{err}</div>}
    </>
  )
}

/** Ô nhập số của nhóm Máy cắt / Kế hoạch: nhãn gắn ô, báo lỗi ngay dưới ô, giải thích ngắn + "Xem thêm". */
export function NumField({ f, form, fallback, style }: { f: McField; form: ConfigForm; fallback?: number; style?: CSSProperties }) {
  return (
    <div>
      <label htmlFor={`mc-${f.name}`} style={labelStyle}>{f.label}</label>
      <McInput
        k={f.name} form={form} value={fmtMcNum(form.values[f.name] ?? fallback)} helpId={`mc-${f.name}-help`}
        inputMode={f.integer ? 'numeric' : 'decimal'} style={style}
      />
      <HelpText id={`mc-${f.name}-help`} text={f.help} more={f.more} />
    </div>
  )
}

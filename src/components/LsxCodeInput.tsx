import { useEffect, useState } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { updateItemLsx } from '../services/production-invoices-api'
import { errMsg } from '../utils/errors'
import { lsxCodeError, lsxNumberOf, lsxPrefixOf, normalizeLsxCode } from '../utils/lenhCode'

/**
 * Phần A – Đợt 2 (V3-1): ô "Số LSX" của 1 dòng SKU (chọn tiền tố + gõ số). Lưu thẳng qua `PATCH .../items/:itemId/lsx`.
 *
 * `mode`:
 *  - 'edit': sửa tự do (dòng chưa được Sếp duyệt; hoặc Admin) - có nút bút chì khi đã có số.
 *  - 'fill': chỉ ĐIỀN khi đang trống (dòng đã duyệt - bổ sung cho lệnh cũ); đã có số thì chỉ hiện, muốn đổi phải nhờ Admin.
 *  - 'view': chỉ xem.
 * `prefixes` rỗng = cho gõ tiền tố tự do (BE vẫn kiểm). Lỗi BE (trùng số 409, sai dạng 400, không có quyền 403) hiện ngay dưới ô.
 */
export interface LsxCodeInputProps {
  piId: string | number
  itemId: string | number
  value: string | null | undefined
  mode: 'edit' | 'fill' | 'view'
  prefixes: string[]
  /** Tiền tố gợi ý theo khách hàng (xem utils/lsxSuggest). null = không đoán được -> ô tiền tố để TRỐNG (không tự điền);
   *  không truyền (undefined) = như cũ, điền sẵn tiền tố đầu tiên Admin khai. */
  suggestedPrefix?: string | null
  /** Gọi sau khi BE lưu xong (để trang tải lại danh sách). */
  onSaved?: (lsxCode: string | null) => void
  /** Ẩn chip "LSX …" khi số đã hiện ở chỗ khác (vd mã lệnh 1 SKU ở đầu trang) - chỉ còn nút sửa / ghi chú. */
  hideChip?: boolean
}

const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
  color: 'var(--fg-1d4ed8)', background: 'var(--bg-dbeafe)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
}
const input: React.CSSProperties = {
  padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: 'var(--surface)',
  color: 'var(--text)', fontFamily: 'monospace', outline: 'none', minWidth: 0,
}
const iconBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)',
}

export default function LsxCodeInput({ piId, itemId, value, mode, prefixes, suggestedPrefix, onSaved, hideChip = false }: LsxCodeInputProps) {
  const current = value?.trim() || null
  // Tiền tố điền sẵn khi chưa có số: gợi ý theo khách; không truyền gợi ý thì tiền tố đầu tiên Admin khai (như cũ).
  const defaultPrefix = suggestedPrefix === undefined ? (prefixes[0] ?? '') : (suggestedPrefix ?? '')
  const [editing, setEditing] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [num, setNum] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Mở ô nhập: điền sẵn số hiện có; chưa có thì tiền tố đầu tiên Admin khai.
  const startEdit = () => {
    setPrefix((current && lsxPrefixOf(current)) ?? defaultPrefix)
    setNum((current && lsxNumberOf(current)) ?? '')
    setError(null)
    setEditing(true)
  }
  // Dòng chưa có số -> hiện sẵn ô nhập (không bắt bấm "sửa" trước).
  const showForm = mode !== 'view' && (editing || (!current && (mode === 'edit' || mode === 'fill')))
  useEffect(() => {
    if (!current && mode !== 'view' && !editing) {
      setPrefix((p) => p || defaultPrefix)
    }
  }, [current, mode, editing, defaultPrefix])

  if (!showForm) {
    if (!current) {
      return <span style={{ fontSize: 12, color: 'var(--text3)' }}>Chưa có số LSX</span>
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {!hideChip && <span style={chip} title="Số lệnh sản xuất của nhà máy">LSX {current}</span>}
        {mode === 'edit' && (
          <button type="button" onClick={startEdit} aria-label={`Sửa số LSX ${current}`} title="Sửa số LSX"
            style={{ ...iconBtn, padding: 4, border: 'none', background: 'transparent' }}>
            <Pencil size={12} />
          </button>
        )}
        {mode === 'fill' && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }} title="Lệnh đã được Sếp duyệt - muốn đổi số LSX phải nhờ Admin">
            (đổi số: nhờ Admin)
          </span>
        )}
      </span>
    )
  }

  // Gõ/dán cả "MY-313" vào ô số -> tự tách tiền tố + số.
  const onNumChange = (raw: string) => {
    const norm = normalizeLsxCode(raw)
    const p = lsxPrefixOf(norm)
    if (p) {
      setPrefix(p)
      setNum(lsxNumberOf(norm) ?? '')
    } else {
      setNum(raw.replace(/\D/g, '').slice(0, 6))
    }
    setError(null)
  }

  const code = normalizeLsxCode(`${prefix}-${num}`)
  const save = async () => {
    // Thiếu số: báo ngay dưới ô thay vì im lặng (test tay 09/11 điểm 13).
    if (!num) { setError('Chưa nhập số LSX'); return }
    const err = lsxCodeError(code, prefixes)
    if (err) { setError(err); return }
    if (code === current) { setEditing(false); return }
    setSaving(true)
    setError(null)
    try {
      await updateItemLsx(piId, itemId, code)
      setEditing(false)
      onSaved?.(code)
    } catch (e) {
      setError(errMsg(e, 'Không lưu được số LSX'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>Số LSX</span>
        {prefixes.length > 0 ? (
          <select value={prefixes.includes(prefix) ? prefix : ''} onChange={(e) => { setPrefix(e.target.value); setError(null) }}
            aria-label="Tiền tố số LSX" disabled={saving} style={{ ...input, width: 76 }}>
            {!prefixes.includes(prefix) && <option value="" disabled>{prefix || 'Tiền tố'}</option>}
            {prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <input value={prefix} onChange={(e) => { setPrefix(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)); setError(null) }}
            placeholder="Tiền tố" aria-label="Tiền tố số LSX" disabled={saving} style={{ ...input, width: 76 }} />
        )}
        <span style={{ color: 'var(--text3)' }}>-</span>
        <input value={num} onChange={(e) => onNumChange(e.target.value)} inputMode="numeric" placeholder="Số"
          aria-label="Số LSX" disabled={saving}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save() } if (e.key === 'Escape' && current) setEditing(false) }}
          style={{ ...input, width: 80 }} />
        <button type="button" onClick={() => void save()} disabled={saving}
          style={{ ...iconBtn, background: 'var(--bg-2e7d32)', border: 'none', color: '#fff', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
          {saving ? <Loader2 size={12} className="spin" /> : <Check size={12} />} Lưu
        </button>
        {current && (
          <button type="button" onClick={() => { setEditing(false); setError(null) }} disabled={saving} aria-label="Huỷ sửa số LSX" style={iconBtn}>
            <X size={12} />
          </button>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 12, color: 'var(--fg-b91c1c)' }}>{error}</div>}
    </div>
  )
}

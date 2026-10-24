import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import Modal from './Modal'
import ZoomableImage from './ZoomableImage'
import type { SkuMaterialOption } from '../types/sku'

/** Vật tư có thể tick (đủ để dựng SkuMaterialOption) - mượn shape của danh mục vật tư (BeMaterial). */
export interface OptionCandidate {
  id: string | number
  code: string
  name: string
  spec?: string | null
  unit: string
  imageUrl?: string | null
}

const toOption = (m: OptionCandidate): SkuMaterialOption => ({
  materialId: String(m.id),
  materialCode: m.code,
  materialName: m.name,
  materialSpec: m.spec ?? null,
  materialUnit: m.unit,
  imageUrl: m.imageUrl ?? null,
})

// globals.css đặt width:100% + padding cho MỌI input - checkbox phải ghi đè kích thước, nếu không bị kéo giãn
// hết hàng và đẩy chữ ra ngoài khung.
const checkboxStyle: React.CSSProperties = { width: 16, height: 16, padding: 0, margin: 0, flexShrink: 0, cursor: 'pointer' }

function Thumb({ url, size, title }: { url?: string | null; size: number; title: string }) {
  return url
    ? <ZoomableImage url={url} size={size} title={title} />
    : <span style={{ width: size, height: size, borderRadius: 4, background: 'var(--surface2)', flexShrink: 0, border: '1px solid var(--border)' }} />
}

/**
 * Ô "tick các loại dây/nệm Sales được chọn khi lên đơn" của 1 SKU. Hiện các loại đã chọn dạng chip
 * (ảnh mẫu + mã), nút mở hộp chọn nhiều có tìm kiếm trong danh mục vật tư của nhóm. Người nhập định
 * mức tick ở đây - Sales chỉ chọn được trong danh sách này (xem OrderManagementPage).
 */
export default function MaterialOptionsPanel({ title, noun, candidates, selected, onChange, disabled }: {
  title: string
  /** "dây" / "nệm" - ghép vào nhãn nút và ô tìm kiếm. */
  noun: string
  candidates: OptionCandidate[]
  selected: SkuMaterialOption[]
  onChange: (next: SkuMaterialOption[]) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')

  const openPicker = () => {
    setDraft(new Set(selected.map((o) => o.materialId)))
    setQuery('')
    setOpen(true)
  }
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter((m) => `${m.code} ${m.name} ${m.spec ?? ''}`.toLowerCase().includes(q))
  }, [candidates, query])

  const toggle = (id: string) => setDraft((d) => { const n = new Set(d); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const allFilteredChecked = filtered.length > 0 && filtered.every((m) => draft.has(String(m.id)))
  const toggleAllFiltered = () => setDraft((d) => {
    const n = new Set(d)
    for (const m of filtered) { if (allFilteredChecked) n.delete(String(m.id)); else n.add(String(m.id)) }
    return n
  })

  const confirm = () => {
    // Giữ thứ tự: loại đã chọn từ trước đứng trước, loại mới tick nối sau - đỡ nhảy lung tung khi mở lại.
    const byId = new Map(candidates.map((m) => [String(m.id), m]))
    const kept = selected.filter((o) => draft.has(o.materialId))
    const keptIds = new Set(kept.map((o) => o.materialId))
    const added = [...draft].filter((id) => !keptIds.has(id) && byId.has(id)).map((id) => toOption(byId.get(id)!))
    onChange([...kept, ...added])
    setOpen(false)
  }
  const remove = (id: string) => onChange(selected.filter((o) => o.materialId !== id))

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: selected.length > 0 ? 10 : 0 }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{title}</div>
        </div>
        {!disabled && (
          <button onClick={openPicker} style={{
            padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)',
            cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)', whiteSpace: 'nowrap',
          }}>
            {selected.length > 0 ? `Sửa danh sách màu ${noun}` : `Chọn các màu ${noun}`}
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {selected.map((o) => (
            <span key={o.materialId} title={`${o.materialCode} — ${o.materialName}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 6px 3px 4px', borderRadius: 999,
              background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text)',
            }}>
              <Thumb url={o.imageUrl} size={22} title={`${o.materialCode} — ${o.materialName}`} />
              <strong>{o.materialName}</strong>
              {!disabled && (
                <button onClick={() => remove(o.materialId)} aria-label={`Bỏ ${o.materialCode}`} style={{ display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text3)' }}>
                  <X size={13} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} maxWidth={560}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
        <input
          autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Tìm theo mã, tên ${noun}…`}
          style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text2)', padding: '4px 2px 8px', cursor: 'pointer' }}>
          <input type="checkbox" style={checkboxStyle} checked={allFilteredChecked} onChange={toggleAllFiltered} disabled={filtered.length === 0} />
          Chọn tất cả {query.trim() ? 'kết quả đang lọc' : `${filtered.length} màu ${noun}`}
        </label>
        <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          {filtered.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
              {candidates.length === 0 ? `Chưa có vật tư ${noun} nào trong danh mục` : 'Không tìm thấy'}
            </div>
          )}
          {filtered.map((m, i) => {
            const id = String(m.id)
            return (
              <label key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderTop: i > 0 ? '1px solid var(--border)' : undefined, cursor: 'pointer', background: draft.has(id) ? 'var(--bg-e3f2fd)' : undefined }}>
                <input type="checkbox" style={checkboxStyle} checked={draft.has(id)} onChange={() => toggle(id)} />
                <Thumb url={m.imageUrl} size={36} title={`${m.code} — ${m.name}`} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                  <strong>{m.name}</strong>
                  {m.spec && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.spec}</div>}
                </span>
              </label>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Đã chọn {draft.size} màu</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setOpen(false)} style={{ padding: '7px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13, color: 'var(--text2)' }}>Hủy</button>
            <button onClick={confirm} style={{ padding: '7px 16px', border: 'none', borderRadius: 'var(--radius)', background: 'var(--bg-1565c0)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Xong</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

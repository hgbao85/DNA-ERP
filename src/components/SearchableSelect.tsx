import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface SearchableSelectProps<T> {
  displayValue: string
  options: T[]
  getKey: (o: T) => string
  getSearchText: (o: T) => string
  renderOption: (o: T) => React.ReactNode
  onSelect: (o: T) => void
  /** Gọi mỗi khi người dùng gõ — cho phép nhập giá trị tự do khi không chọn từ danh sách gợi ý. */
  onQueryChange?: (text: string) => void
  placeholder?: string
  emptyText?: string
}

/**
 * Input gõ-để-lọc dùng chung: gợi ý danh sách khớp bên dưới, chọn để điền vào ô.
 *
 * Dropdown gợi ý render qua PORTAL vào document.body, định vị bằng getBoundingClientRect() của
 * input (2026-09-24) - trước đây `position: absolute` lồng trong wrapper thường thì không sao,
 * nhưng bất kỳ tổ tiên nào có overflow: auto/hidden/scroll (vd khung cuộn danh sách SKU trong modal
 * "Chọn kho thành phẩm", LenhSXPage.tsx) sẽ CẮT MẤT dropdown vì overflow luôn cắt cả con
 * position:absolute, không chỉ tràn theo flow bình thường - hộp cuộn đó tự co theo chiều cao NỘI
 * DUNG THẬT (bỏ qua phần tử absolute) nên khi chỉ có 1-2 SKU, hộp còn thấp hơn cả dropdown, cắt mất
 * gần hết. Portal thoát khỏi MỌI ancestor overflow, dùng `position: fixed` (toạ độ viewport, không
 * cần trừ scroll offset của document).
 */
export default function SearchableSelect<T>({
  displayValue, options, getKey, getSearchText, renderOption, onSelect, onQueryChange,
  placeholder, emptyText = 'Không tìm thấy kết quả',
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(displayValue)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; bottom: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) setQuery(displayValue)
  }, [displayValue, open])

  // Đo lại vị trí MỖI LẦN mở, và theo dõi scroll/resize khi đang mở - modal chứa ô này thường tự
  // cuộn (overflowY:auto), cuộn xong mà không đo lại thì dropdown portal đứng yên trong khi ô input
  // đã trôi đi nơi khác. `capture:true` để bắt được cả scroll của ancestor lồng sâu bên trong (scroll
  // không bubbling lên window theo cách thường, phải nghe ở capture phase).
  useEffect(() => {
    if (!open) return
    const measure = () => {
      const el = inputRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom })
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter(o => getSearchText(o).toLowerCase().includes(q)) : options

  return (
    <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onQueryChange?.(e.target.value) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
      />
      {open && rect && createPortal(
        <div style={{
          position: 'fixed', top: rect.bottom + 2, left: rect.left, width: rect.width, zIndex: 2000,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 14px rgba(0,0,0,.12)',
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>{emptyText}</div>
          )}
          {filtered.map(o => (
            <button
              key={getKey(o)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(o); setOpen(false) }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              {renderOption(o)}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

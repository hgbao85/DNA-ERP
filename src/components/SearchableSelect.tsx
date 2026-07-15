import { useState, useEffect } from 'react'

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

/** Input gõ-để-lọc dùng chung: gợi ý danh sách khớp bên dưới, chọn để điền vào ô. */
export default function SearchableSelect<T>({
  displayValue, options, getKey, getSearchText, renderOption, onSelect, onQueryChange,
  placeholder, emptyText = 'Không tìm thấy kết quả',
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(displayValue)

  useEffect(() => {
    if (!open) setQuery(displayValue)
  }, [displayValue, open])

  const q = query.trim().toLowerCase()
  const filtered = q ? options.filter(o => getSearchText(o).toLowerCase().includes(q)) : options

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onQueryChange?.(e.target.value) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
      />
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 2, zIndex: 20,
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
        </div>
      )}
    </div>
  )
}

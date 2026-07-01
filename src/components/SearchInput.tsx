import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  width?: number
}

/** Ô tìm kiếm có icon kính lúp, dùng chung cho thanh filter của các trang danh sách. */
export default function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', width = 280 }: SearchInputProps) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ paddingLeft: 32, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', outline: 'none', width }}
      />
    </div>
  )
}

interface FilterPillOption<K extends string> {
  key: K
  label: string
  /** Màu chữ khi đang active — mặc định trắng (#fff) như pill "Tất cả" */
  color?: string
  /** Màu nền khi đang active — mặc định xám đậm (#1f2937) như pill "Tất cả" */
  bg?: string
}

interface FilterPillsProps<K extends string> {
  options: FilterPillOption<K>[]
  active: K
  onChange: (key: K) => void
  /** Trả về số lượng hiển thị bên cạnh nhãn; bỏ qua nếu không cần đếm */
  countFor?: (key: K) => number
}

/** Thanh pill lọc theo trạng thái (kèm số đếm), dùng chung cho các trang danh sách có status filter. */
export default function FilterPills<K extends string,>({ options, active, onChange, countFor }: FilterPillsProps<K>) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map(opt => {
        const isActive = active === opt.key
        const count = countFor?.(opt.key)
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20,
              border: isActive ? 'none' : '1px solid var(--border)',
              cursor: 'pointer',
              background: isActive ? (opt.bg ?? '#1f2937') : 'var(--surface)',
              color: isActive ? (opt.color ?? '#fff') : 'var(--text2)',
              transition: 'all 0.15s',
            }}
          >
            {opt.label}
            {count !== undefined && (
              <span style={{
                fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: 'center',
                padding: '1px 5px', borderRadius: 10,
                background: isActive ? 'rgba(0,0,0,0.12)' : 'var(--surface2)',
                color: 'inherit',
              }}>{count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

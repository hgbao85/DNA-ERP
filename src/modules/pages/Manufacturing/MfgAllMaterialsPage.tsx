import { useEffect, useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Search, Boxes } from 'lucide-react'

// Vật tư gộp từ mọi kho (kèm thông tin kho)
interface AllItem {
  id: number
  code?: string | null
  codeIea?: string | null
  name: string
  color?: string | null   // = Đặc tính
  size?: string | null
  unit: string
  quantity: number
  warehouse?: { id: number; name: string; category?: string | null } | null
}

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])

/** Tổng hợp vật tư — get toàn bộ vật tư từ các kho, tìm kiếm chung (chỉ xem/tra cứu). */
export default function MfgAllMaterialsPage() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  // debounce 300ms cho ô tìm kiếm
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: items, isLoading, error } = useFetch<AllItem[]>(() => api.getAllMfgWarehouseItems(q || undefined), [q])
  const list = safeArr(items)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Tổng hợp vật tư/SKU</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 16 }}>Toàn bộ vật tư/SKU từ tất cả các kho — tìm kiếm nguyên liệu nhanh</div>

      <div style={{ position: 'relative', maxWidth: 380, marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text3)' }} />
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Tìm tên vật tư / mã / đặc tính / kích thước…"
          style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
        />
      </div>

      {error && <div style={{ color: '#c62828' }}>{error}</div>}
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Boxes size={14} /> {isLoading ? 'Đang tải…' : `${list.length} vật tư${q ? ` khớp “${q}”` : ''}`}
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>Kho</th>
              <th style={th}>Tên vật tư</th>
              <th style={th}>Đặc tính</th>
              <th style={th}>Mã</th>
              <th style={th}>ĐVT</th>
              <th style={{ ...th, textAlign: 'right' }}>Tồn</th>
            </tr>
          </thead>
          <tbody>
            {list.map(it => (
              <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text2)' }}>{it.warehouse?.name ?? '—'}</td>
                <td style={{ ...td, fontWeight: 600 }}>{it.name}</td>
                <td style={td}>{it.color || '—'}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>{it.code || it.codeIea || '—'}</td>
                <td style={td}>{it.unit}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: it.quantity <= 0 ? '#c62828' : 'var(--text)' }}>{it.quantity}</td>
              </tr>
            ))}
            {!isLoading && list.length === 0 && (
              <tr><td colSpan={6} style={{ ...td, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
                {q ? 'Không tìm thấy vật tư khớp' : 'Chưa có vật tư — kiểm tra kho hoặc nạp catalog vật tư.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }

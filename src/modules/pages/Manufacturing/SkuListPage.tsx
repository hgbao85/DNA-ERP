import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, Search } from 'lucide-react'

const COLOR_LABEL: Record<string, string> = {
  BLACK: 'Đen',
  GRAY:  'Xám',
  WHITE: 'Trắng',
  BROWN: 'Nâu',
  BEIGE: 'Be',
  BLUE:  'Xanh dương',
  GREEN: 'Xanh lá',
}

export default function SkuListPage() {
  const { data, isLoading } = useFetch(() => (api as any).getAllProductVariants(), [])
  const all: any[] = Array.isArray(data) ? data : []
  const [q, setQ] = useState('')

  const variants = q.trim()
    ? all.filter(v => {
        const kw = q.toLowerCase()
        return (
          v.description?.toLowerCase().includes(kw) ||
          v.mfgProduct?.factoryCode?.toLowerCase().includes(kw) ||
          v.mfgProduct?.name?.toLowerCase().includes(kw) ||
          v.exportCustomer?.name?.toLowerCase().includes(kw)
        )
      })
    : all

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách SKU</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Toàn bộ mã SKU sản phẩm và khách hàng đặt mua — {variants.length} SKU
        </p>
      </div>

      <div style={{ position: 'relative', maxWidth: 380, marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text3)' }} />
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Tìm mã SKU, tên sản phẩm, khách hàng…"
          style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }}
        />
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)', padding: 32 }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 72 }} />
              <col style={{ width: 160 }} />
              <col style={{ width: 180 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>#</th>
                <th style={th}>Mã SKU</th>
                <th style={th}>Tên SKU</th>
                <th style={th}>Màu</th>
                <th style={th}>Sản phẩm</th>
                <th style={th}>Khách hàng</th>
                <th style={th}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, idx) => (
                <tr
                  key={v.id}
                  style={{ borderTop: '1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...td, color: 'var(--text3)', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ ...td, fontWeight: 700, color: '#2e7d32', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                    {v.mfgProduct?.factoryCode ?? '—'}
                  </td>
                  <td style={{ ...td, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.description}
                  </td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: colorBg(v.colorCode), color: colorText(v.colorCode),
                    }}>
                      {COLOR_LABEL[v.colorCode] ?? v.colorCode}
                    </span>
                  </td>
                  <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.mfgProduct?.name ?? '—'}
                  </td>
                  <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{v.exportCustomer?.name ?? '—'}</div>
                    {v.exportCustomer?.market && (
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{v.exportCustomer.market}</div>
                    )}
                  </td>
                  <td style={td}>
                    <span style={{
                      display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: v.isActive ? '#dcfce7' : '#f3f4f6',
                      color: v.isActive ? '#16a34a' : '#6b7280',
                    }}>
                      {v.isActive ? 'Đang hoạt động' : 'Ngừng'}
                    </span>
                  </td>
                </tr>
              ))}
              {variants.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                    {q.trim() ? `Không tìm thấy SKU phù hợp với "${q}"` : 'Không có SKU nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function colorBg(code: string) {
  const map: Record<string, string> = { BLACK: '#1f2937', GRAY: '#e5e7eb', WHITE: '#f9fafb', BROWN: '#92400e', BEIGE: '#fef3c7', BLUE: '#dbeafe', GREEN: '#dcfce7' }
  return map[code] ?? '#e5e7eb'
}
function colorText(code: string) {
  const map: Record<string, string> = { BLACK: '#fff', GRAY: '#374151', WHITE: '#374151', BROWN: '#fff', BEIGE: '#92400e', BLUE: '#1e40af', GREEN: '#166534' }
  return map[code] ?? '#374151'
}

const th: React.CSSProperties = { padding: '10px 14px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const td: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'middle' }

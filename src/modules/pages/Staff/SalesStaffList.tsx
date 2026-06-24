import { useFetch } from '../../../hooks/useFetch'
import { getSalesUsers } from '../../../services/api'
import type { SalesUserSummary } from '../../../types'
import { UserCheck } from 'lucide-react'

export default function SalesStaffList() {
  const { data, isLoading, error } = useFetch<SalesUserSummary[]>(getSalesUsers)
  const list = data ?? []

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
  if (error)     return <div style={{ padding: 40, color: '#E24B4A' }}>Lỗi: {error}</div>

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Nhân viên Sales</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{list.length} nhân viên</div>
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text2)', background: 'var(--surface2)',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '6px 12px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2e7d32', flexShrink: 0 }} />
            Xanh lá — Khách lẻ
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#1565c0', flexShrink: 0 }} />
            Xanh dương — Khách sỉ
          </div>
        </div>
      </div>

      <div className="card">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
              {['#', 'Họ tên', 'Email', 'Vai trò'].map(h => (
                <th key={h} style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((s: SalesUserSummary, i: number) => (
              <tr key={s.id}
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text3)', width: 40 }}>{i + 1}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: '50%',
                      background: 'var(--blue-bg)', color: 'var(--blue)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 12, flexShrink: 0,
                    }}>
                      {s.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text2)' }}>{s.email}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: s.salesType === 'WHOLESALE' ? '#e3f2fd' : '#e8f5e9',
                    color: s.salesType === 'WHOLESALE' ? '#1565c0' : '#2e7d32',
                  }}>
                    <UserCheck size={10} />
                    {s.salesType === 'WHOLESALE' ? 'Sales Sỉ' : s.salesType === 'RETAIL' ? 'Sales Lẻ' : 'Telesales'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            Chưa có nhân viên sales nào
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import { calcStatus } from '../hooks/useStore'
import { Search, Plus, Filter } from 'lucide-react'
import type { Customer, Settings } from '../types'

const STATUS_MAP: Record<string, React.ReactNode> = {
  overdue: <span className="badge red">Quá hạn</span>,
  today:   <span className="badge amber">Hôm nay</span>,
  soon:    <span className="badge blue">Sắp tới</span>,
  ok:      <span className="badge green">Đã xong</span>,
}

interface CustomerTableProps {
  customers: any[]
  settings: Settings
  onSelect: (customer: any) => void
  onAdd: () => void
}

export default function CustomerTable({ customers, settings, onSelect, onAdd }: CustomerTableProps) {
  const [search, setSearch] = useState('')
  const [filterSales, setFilterSales] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const salesList = [...new Set(customers.map((c: any) => c.sales))].filter(Boolean) as string[]

  const filtered = customers.filter((c: any) => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.name.toLowerCase().includes(q) ||
      (c.products || []).some((p: string) => p.toLowerCase().includes(q)) ||
      (c.sales || '').toLowerCase().includes(q)
    const matchSales = filterSales === 'all' || c.sales === filterSales
    const { status } = calcStatus(c, settings.remindDaysBefore)
    const matchStatus = filterStatus === 'all' || status === filterStatus
    return matchSearch && matchSales && matchStatus
  })

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }} />
          <input
            placeholder="Tìm khách hàng, mã SP, sales..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft:30 }}
          />
        </div>
        <select value={filterSales} onChange={e => setFilterSales(e.target.value)} style={{ width:140 }}>
          <option value="all">Tất cả sales</option>
          {salesList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width:140 }}>
          <option value="all">Tất cả trạng thái</option>
          <option value="overdue">Quá hạn</option>
          <option value="today">Hôm nay</option>
          <option value="soon">Sắp tới</option>
          <option value="ok">Đã xong</option>
        </select>
        <button className="primary" onClick={onAdd} style={{ display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap' }}>
          <Plus size={13}/> Thêm KH
        </button>
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'var(--surface2)', borderBottom:'1px solid var(--border)' }}>
              {['Khách hàng','Mã sản phẩm','Sales','Chu kỳ','Lần cuối','Lần tiếp','Trạng thái'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'8px 12px', fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign:'center', padding:32, color:'var(--text3)', fontSize:13 }}>Không tìm thấy khách hàng nào</td></tr>
            )}
            {filtered.map((c: any) => {
              const { nextDate, status } = calcStatus(c, settings.remindDaysBefore)
              return (
                <tr key={c.id}
                  onClick={() => onSelect(c)}
                  style={{ borderBottom:'1px solid var(--border)', cursor:'pointer', transition:'background .1s' }}
                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2)'}
                  onMouseLeave={e => e.currentTarget.style.background=''}
                >
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ fontWeight:500, fontSize:13 }}>{c.name}</div>
                    <div style={{ fontSize:11, color:'var(--text3)' }}>{c.id} · {c.city}</div>
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    {(c.products || []).map((p: string) => <span key={p} className="chip">{p}</span>)}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:13 }}>{c.sales}</td>
                  <td style={{ padding:'10px 12px', fontSize:13 }}>{c.cycleDays} ngày</td>
                  <td style={{ padding:'10px 12px', fontSize:13, color:'var(--text2)' }}>
                    {(() => {
                      if (!c.lastContact) return '—';
                      try {
                        const parsed = typeof c.lastContact === 'string' ? parseISO(c.lastContact) : new Date(c.lastContact);
                        return format(parsed, 'dd/MM/yyyy');
                      } catch {
                        return '—';
                      }
                    })()}
                  </td>
                  <td style={{ padding:'10px 12px', fontSize:13, fontWeight:500, color: status !== 'ok' ? 'var(--blue)' : 'var(--text2)' }}>
                    {format(nextDate, 'dd/MM/yyyy')}
                  </td>
                  <td style={{ padding:'10px 12px' }}>{STATUS_MAP[status]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:8, fontSize:11, color:'var(--text3)' }}>
        Hiển thị {filtered.length}/{customers.length} khách hàng
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { listTh as thStyle, listTd as tdStyle } from '../../../styles/table'

interface NhapDanItem {
  id: string
  name: string        // tên mảnh đan
  total: number       // tổng mảnh cần nhận
  daGiao: number      // contractor đã giao (đang trên đường / chờ xác nhận)
  daNhan: number      // kho thành phẩm đã nhận về
}

interface NhapDanOrder {
  id: string
  poNumber: string
  skuCode: string
  skuName: string
  deadline: string
  contractor: string  // đơn vị đan gia công
  items: NhapDanItem[]
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct   = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0
  const color = pct === 100 ? '#16a34a' : pct >= 60 ? '#2563eb' : '#d97706'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

// Dữ liệu gương với KhoXuatDanPage — cùng PO, cùng mảnh, nhưng góc nhìn nhập kho thành phẩm
const MOCK_ORDERS: NhapDanOrder[] = [
  {
    id: 'nhap-dan-1', poNumber: 'PO-2501', skuCode: 'GX-001', skuName: 'Ghế xoay văn phòng',
    deadline: '2026-01-15', contractor: 'Xưởng đan Minh Châu',
    items: [
      { id: 'n1-1', name: 'Mảnh tựa lưng A',   total: 50, daGiao: 20, daNhan: 30 },
      { id: 'n1-2', name: 'Mảnh tựa lưng B',   total: 50, daGiao: 25, daNhan: 15 },
      { id: 'n1-3', name: 'Mảnh ngồi chính',   total: 50, daGiao: 15, daNhan: 30 },
      { id: 'n1-4', name: 'Mảnh tay vịn trái', total: 50, daGiao: 20, daNhan: 10 },
      { id: 'n1-5', name: 'Mảnh tay vịn phải', total: 50, daGiao: 20, daNhan: 10 },
    ],
  },
  {
    id: 'nhap-dan-2', poNumber: 'PO-2502', skuCode: 'SF-002', skuName: 'Ghế sofa phòng khách',
    deadline: '2026-01-28', contractor: 'Xưởng đan Bình Dương',
    items: [
      { id: 'n2-1', name: 'Mảnh lưng ghế', total: 20, daGiao: 5,  daNhan: 15 },
      { id: 'n2-2', name: 'Mảnh chỗ ngồi', total: 20, daGiao: 0,  daNhan: 20 },
      { id: 'n2-3', name: 'Mảnh tay sofa', total: 40, daGiao: 15, daNhan: 20 },
    ],
  },
  {
    id: 'nhap-dan-3', poNumber: 'PO-2503', skuCode: 'BV-003', skuName: 'Bàn làm việc L',
    deadline: '2026-02-10', contractor: 'Xưởng đan Minh Châu',
    items: [
      { id: 'n3-1', name: 'Mảnh mặt bàn chính', total: 30, daGiao: 10, daNhan: 5  },
      { id: 'n3-2', name: 'Mảnh mặt bàn phụ',   total: 30, daGiao: 8,  daNhan: 2  },
      { id: 'n3-3', name: 'Mảnh ngăn tủ',        total: 60, daGiao: 20, daNhan: 10 },
    ],
  },
  {
    id: 'nhap-dan-4', poNumber: 'PO-2504', skuCode: 'GA-004', skuName: 'Ghế ăn cao cấp',
    deadline: '2026-01-20', contractor: 'Xưởng đan Tiến Phát',
    items: [
      { id: 'n4-1', name: 'Mảnh lưng ghế ăn', total: 100, daGiao: 0,  daNhan: 100 },
      { id: 'n4-2', name: 'Mảnh mặt ngồi',     total: 100, daGiao: 10, daNhan: 90  },
    ],
  },
]

export default function KhoNhapDanPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = MOCK_ORDERS.find(o => o.id === selectedId) ?? null

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selected) {
    const total   = selected.items.reduce((s, i) => s + i.total,   0)
    const daGiao  = selected.items.reduce((s, i) => s + i.daGiao,  0)
    const daNhan  = selected.items.reduce((s, i) => s + i.daNhan,  0)
    const conThieu = total - daNhan

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}
          >
            <ChevronLeft size={15} /> Quay lại
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {selected.skuCode}
              <span style={{ fontWeight: 400, color: 'var(--text2)', marginLeft: 6 }}>— {selected.skuName}</span>
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 2 }}>
              PO: {selected.poNumber} · Deadline: {format(new Date(selected.deadline), 'dd/MM/yyyy')}
              {' · '}<span style={{ color: 'var(--text2)' }}>{selected.contractor}</span>
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {([
            { label: 'Tổng mảnh',  value: total,    color: 'var(--text)' },
            { label: 'Đã giao về', value: daGiao,   color: '#2563eb' },
            { label: 'Đã nhận',    value: daNhan,   color: '#16a34a' },
            { label: 'Còn thiếu',  value: conThieu, color: conThieu > 0 ? '#dc2626' : '#16a34a' },
          ] as const).map(s => (
            <div key={s.label} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 72 }} />
              <col style={{ width: 160 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Tên mảnh</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Tổng</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã giao về</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã nhận</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Còn thiếu</th>
                <th style={thStyle}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map(item => {
                const thieu = item.total - item.daNhan
                return (
                  <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{item.name}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{item.total}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.daGiao > 0 ? '#2563eb' : 'var(--text3)' }}>{item.daGiao}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.daNhan > 0 ? '#16a34a' : 'var(--text3)' }}>{item.daNhan}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: thieu > 0 ? '#dc2626' : '#16a34a' }}>{thieu}</td>
                    <td style={tdStyle}><ProgressBar value={item.daNhan} max={item.total} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── List view ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Theo dõi nhập đan</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Theo dõi tiến độ nhận mảnh đan từ xưởng gia công theo từng PO
        </p>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 110 }} />
            <col />
            <col style={{ width: 60 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 150 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={thStyle}>PO</th>
              <th style={thStyle}>SKU</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Tổng</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Đã giao về</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Đã nhận</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Còn thiếu</th>
              <th style={thStyle}>Tiến độ</th>
              <th style={thStyle}>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ORDERS.map(order => {
              const total    = order.items.reduce((s, i) => s + i.total,   0)
              const daGiao   = order.items.reduce((s, i) => s + i.daGiao,  0)
              const daNhan   = order.items.reduce((s, i) => s + i.daNhan,  0)
              const conThieu = total - daNhan
              return (
                <tr
                  key={order.id}
                  onClick={() => setSelectedId(order.id)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--text3)' }}>{order.poNumber}</td>
                  <td style={{ ...tdStyle, overflow: 'hidden' }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600 }}>{order.skuCode}</span>
                      <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{order.skuName}</span>
                    </div>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{total}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: daGiao > 0 ? '#2563eb' : 'var(--text3)' }}>{daGiao}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: daNhan > 0 ? '#16a34a' : 'var(--text3)' }}>{daNhan}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: conThieu > 0 ? '#dc2626' : '#16a34a' }}>{conThieu}</td>
                  <td style={tdStyle}><ProgressBar value={daNhan} max={total} /></td>
                  <td style={{ ...tdStyle, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                    {format(new Date(order.deadline), 'dd/MM/yyyy')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

'use client'
import { useState } from 'react'
import { ChevronLeft } from 'lucide-react'
import { format } from 'date-fns'
import { listTh as thStyle, listTd as tdStyle } from '../../../styles/table'
import ProgressBar from '../../../components/ProgressBar'

interface DanItem {
  id: string
  name: string
  total: number
  choXuat: number
  daXuat: number
  daThu: number
}

interface DanOrder {
  id: string
  poNumber: string
  skuCode: string
  skuName: string
  deadline: string
  items: DanItem[]
}

const MOCK_ORDERS: DanOrder[] = [
  {
    id: 'dan-1', poNumber: 'PO-2501', skuCode: 'GX-001', skuName: 'Ghế xoay văn phòng', deadline: '2026-01-15',
    items: [
      { id: 'd1-1', name: 'Mảnh tựa lưng A',    total: 50, choXuat: 0,  daXuat: 20, daThu: 30 },
      { id: 'd1-2', name: 'Mảnh tựa lưng B',    total: 50, choXuat: 10, daXuat: 25, daThu: 15 },
      { id: 'd1-3', name: 'Mảnh ngồi chính',    total: 50, choXuat: 5,  daXuat: 15, daThu: 30 },
      { id: 'd1-4', name: 'Mảnh tay vịn trái',  total: 50, choXuat: 20, daXuat: 20, daThu: 10 },
      { id: 'd1-5', name: 'Mảnh tay vịn phải',  total: 50, choXuat: 20, daXuat: 20, daThu: 10 },
    ],
  },
  {
    id: 'dan-2', poNumber: 'PO-2502', skuCode: 'SF-002', skuName: 'Ghế sofa phòng khách', deadline: '2026-01-28',
    items: [
      { id: 'd2-1', name: 'Mảnh lưng ghế',      total: 20, choXuat: 0, daXuat: 5,  daThu: 15 },
      { id: 'd2-2', name: 'Mảnh chỗ ngồi',      total: 20, choXuat: 0, daXuat: 0,  daThu: 20 },
      { id: 'd2-3', name: 'Mảnh tay sofa',      total: 40, choXuat: 5, daXuat: 15, daThu: 20 },
    ],
  },
  {
    id: 'dan-3', poNumber: 'PO-2503', skuCode: 'BV-003', skuName: 'Bàn làm việc L', deadline: '2026-02-10',
    items: [
      { id: 'd3-1', name: 'Mảnh mặt bàn chính', total: 30, choXuat: 15, daXuat: 10, daThu: 5  },
      { id: 'd3-2', name: 'Mảnh mặt bàn phụ',   total: 30, choXuat: 20, daXuat: 8,  daThu: 2  },
      { id: 'd3-3', name: 'Mảnh ngăn tủ',        total: 60, choXuat: 30, daXuat: 20, daThu: 10 },
    ],
  },
  {
    id: 'dan-4', poNumber: 'PO-2504', skuCode: 'GA-004', skuName: 'Ghế ăn cao cấp', deadline: '2026-01-20',
    items: [
      { id: 'd4-1', name: 'Mảnh lưng ghế ăn',   total: 100, choXuat: 0, daXuat: 0,  daThu: 100 },
      { id: 'd4-2', name: 'Mảnh mặt ngồi',       total: 100, choXuat: 0, daXuat: 10, daThu: 90  },
    ],
  },
]

export default function KhoXuatDanPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = MOCK_ORDERS.find(o => o.id === selectedId) ?? null

  // ── Detail view ────────────────────────────────────────────────────────────

  if (selected) {
    const total   = selected.items.reduce((s, i) => s + i.total,   0)
    const choXuat = selected.items.reduce((s, i) => s + i.choXuat, 0)
    const daXuat  = selected.items.reduce((s, i) => s + i.daXuat,  0)
    const daThu   = selected.items.reduce((s, i) => s + i.daThu,   0)

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
            </div>
          </div>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {([
            { label: 'Tổng',     value: total,   color: 'var(--text)' },
            { label: 'Chờ xuất', value: choXuat, color: '#d97706' },
            { label: 'Đã xuất',  value: daXuat,  color: '#2563eb' },
            { label: 'Đã thu',   value: daThu,   color: '#16a34a' },
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
                <th style={{ ...thStyle, textAlign: 'right' }}>Số lượng</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Chờ xuất</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Đã thu</th>
                <th style={thStyle}>Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {selected.items.map(item => (
                <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{item.name}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{item.total}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.choXuat > 0 ? '#d97706' : 'var(--text3)' }}>{item.choXuat}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.daXuat > 0 ? '#2563eb' : 'var(--text3)' }}>{item.daXuat}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: item.daThu > 0 ? '#16a34a' : 'var(--text3)' }}>{item.daThu}</td>
                  <td style={tdStyle}><ProgressBar value={item.daThu} max={item.total} /></td>
                </tr>
              ))}
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
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Theo dõi xuất đan</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Theo dõi tiến độ xuất và thu đan theo từng PO
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
              <th style={{ ...thStyle, textAlign: 'right' }}>Chờ xuất</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Đã xuất</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Đã thu</th>
              <th style={thStyle}>Tiến độ</th>
              <th style={thStyle}>Deadline</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_ORDERS.map(order => {
              const total   = order.items.reduce((s, i) => s + i.total,   0)
              const choXuat = order.items.reduce((s, i) => s + i.choXuat, 0)
              const daXuat  = order.items.reduce((s, i) => s + i.daXuat,  0)
              const daThu   = order.items.reduce((s, i) => s + i.daThu,   0)
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
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: choXuat > 0 ? '#d97706' : 'var(--text3)' }}>{choXuat}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: daXuat > 0 ? '#2563eb' : 'var(--text3)' }}>{daXuat}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: daThu > 0 ? '#16a34a' : 'var(--text3)' }}>{daThu}</td>
                  <td style={tdStyle}><ProgressBar value={daThu} max={total} /></td>
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

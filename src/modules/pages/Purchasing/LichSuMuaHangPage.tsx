'use client'
import { useState } from 'react'
import { ChevronLeft, History } from 'lucide-react'
import { format } from 'date-fns'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { getMaterials } from '../../../services/api'
import { visibleProposalsFor, buildBuyerByMaterialId } from '../../../utils/purchasingRouting'

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px' }

interface Row {
  key: string
  poNumber: string | null
  itemName: string
  ncc: string
  unitPrice: number | null
  buyQty: number
  unit: string
  total: number | null
}

function buildRows(p: PurchaseProposal): Row[] {
  return p.items.map(item => {
    // Key theo materialId (KHÔNG phải item.name) - 2 vật tư khác nhau có thể trùng tên hiển thị,
    // xem purchasing-api.ts D.p6-quote-key-collision.
    const key = String(item.materialId)
    const ncc = p.chosenSuppliers?.[key] ?? ''
    const offers = p.quotes?.[key] ?? []
    const chosenQuote = offers.find(q => q.supplierName === ncc) ?? offers[0]
    const unitPrice = chosenQuote?.unitPrice ?? null
    return {
      key: `${p.id}-${key}`,
      poNumber: p.salesOrderCode,
      itemName: item.name,
      ncc: ncc || '—',
      unitPrice,
      buyQty: item.buyQty,
      unit: item.unit,
      total: unitPrice != null && unitPrice > 0 ? unitPrice * item.buyQty : null,
    }
  })
}

// Các lệnh mua đã nhận đủ hàng (status 'purchased') — lưu lại làm lịch sử, không còn hiển thị
// ở "Theo dõi mua hàng" (đang chờ về) hay "Lệnh mua vật tư" (đang xử lý) nữa.
export default function LichSuMuaHangPage() {
  const { user } = useAuth()
  const { proposals: allProposals } = useInspection()
  const { data: materials } = useFetch(getMaterials)
  const buyerByMaterialId = buildBuyerByMaterialId(materials ?? [])
  const proposals = visibleProposalsFor(user, allProposals, buyerByMaterialId).filter(p => p.status === 'purchased')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = proposals.find(p => p.id === selectedId) ?? null

  // ── Detail view: danh sách vật tư đã mua của 1 PO ─────────────────────────────
  if (selected) {
    const rows = buildRows(selected)
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button
            onClick={() => setSelectedId(null)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
          >
            <ChevronLeft size={14} /> Danh sách
          </button>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{selected.salesOrderCode ?? '—'}</span>
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>{selected.skuCode}{selected.skuName ? ` — ${selected.skuName}` : ''}</span>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>PO</th>
                <th style={th}>Tên vật tư</th>
                <th style={th}>NCC</th>
                <th style={{ ...th, textAlign: 'right' }}>Đơn giá</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã mua</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text3)' }}>{r.poNumber ?? '—'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.itemName}</td>
                  <td style={td}>{r.ncc}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.unitPrice ? r.unitPrice.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#166534' }}>{r.buyQty}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{r.unit}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 600, color: '#4527a0' }}>{r.total ? r.total.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderTop: '1px solid #86efac', background: '#dcfce7', fontSize: 13, color: '#166534' }}>
            Đã nhận đủ hàng lúc {selected.purchasedAt ? format(new Date(selected.purchasedAt), 'HH:mm dd/MM/yyyy') : '—'}
          </div>
        </div>
      </div>
    )
  }

  // ── List view: theo từng PO đã mua xong ───────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Lịch sử đã mua</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Các lệnh mua đã nhận đủ hàng — lưu lại làm lịch sử tra cứu.
      </div>

      {proposals.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Chưa có lệnh mua nào hoàn tất
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <History size={16} color="#166534" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#166534' }}>Đã mua</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#166534', border: '1px solid #86efac' }}>
              {proposals.length}
            </span>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={th}>PO</th>
                  <th style={th}>PI</th>
                  <th style={th}>Mã nhà máy</th>
                  <th style={th}>Kho phụ trách</th>
                  <th style={th}>Hoàn tất lúc</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map(p => {
                  const khos = [...new Set(p.items.map(i => i.khoLabel))].join(', ')
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedId(p.id)}
                      style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace' }}>{p.salesOrderCode ?? '—'}</td>
                      <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text3)' }}>{p.piCode}</td>
                      <td style={td}>
                        <span style={{ fontWeight: 600 }}>{p.skuCode}</span>
                        {p.skuName && <span style={{ marginLeft: 6, color: 'var(--text3)', fontSize: 12 }}>{p.skuName}</span>}
                      </td>
                      <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{khos}</td>
                      <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>
                        {p.purchasedAt ? format(new Date(p.purchasedAt), 'HH:mm dd/MM/yyyy') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

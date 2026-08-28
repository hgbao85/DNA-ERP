'use client'
import { useState } from 'react'
import { ChevronLeft, Truck } from 'lucide-react'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal } from '../../../context/InspectionContext'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import { getMaterials } from '../../../services/api'
import { visibleProposalsFor, buildBuyerByMaterialId } from '../../../utils/purchasingRouting'

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '9px 12px' }

// 3 cột NCC / Đơn giá / NCC hẹn giao đã gỡ 2026-08-27: cả 3 lấy từ báo giá đã chọn, mà luồng báo
// giá trong phần mềm đã bỏ - giá và NCC nay nằm trong file Excel Sếp ký (item.approvalFileUrl).
interface Row {
  key: string
  poNumber: string | null
  itemName: string
  buyQty: number
  unit: string
  boughtQty: number
  remaining: number
  deadline?: string
  approvalFileUrl?: string
}

// Chỉ liệt kê đúng các dòng ĐANG purchasing (2026-08-25) - không phải toàn bộ p.items: 1 đề xuất
// gộp có thể còn vật tư khác chưa tới lượt, hiện chúng ở đây (màn "chờ hàng về") sẽ gây hiểu nhầm
// là đã duyệt xong.
function buildRows(p: PurchaseProposal): Row[] {
  return p.items.filter(item => item.status === 'purchasing').map(item => {
    // Key theo itemId (2026-08-26, L6) - KHÔNG phải materialId lẫn item.name, xem
    // purchasing-api.ts đầu file (1 vật tư đã PURCHASED phát sinh thiếu thêm tách DÒNG MỚI cùng
    // materialId).
    const key = item.itemId ?? String(item.materialId)
    const boughtQty = item.receivedQty ?? 0
    return {
      key: `${p.id}-${key}`,
      poNumber: p.salesOrderCode,
      itemName: item.name,
      buyQty: item.buyQty,
      unit: item.unit,
      boughtQty,
      remaining: Math.max(0, item.buyQty - boughtQty),
      deadline: p.deadline,
      approvalFileUrl: item.approvalFileUrl,
    }
  })
}

function statusTag(p: PurchaseProposal) {
  const cfg = PROPOSAL_STATUS_LABELS[p.status]
  return <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 6, padding: '2px 8px' }}>{cfg.label}</span>
}

// Các lệnh mua đã được Giám đốc duyệt (status 'purchasing') — chờ hàng về,
// nhận hàng thực hiện ở Nhập kho (receivedQty cộng dồn từ đó).
export default function TheoDoiMuaHangPage() {
  const { user } = useAuth()
  const { proposals: allProposals } = useInspection()
  const { data: materials, isLoading: materialsLoading } = useFetch(getMaterials)
  const buyerByMaterialId = buildBuyerByMaterialId(materials ?? [])
  // materials chưa tải xong -> buyerByMaterialId RỖNG -> canPurchaserSeeProposal() coi mọi đề
  // xuất là "chưa gán ai" (buyerId undefined) -> hiện NHẦM cho mọi nhân viên mua hàng trong
  // khoảnh khắc đang tải, biến mất ngay khi materials tải xong và bộ lọc thật chạy lại (D.p7-
  // buyer-filter-loading-flash, 2026-08-22). Chặn hẳn ở đây - rỗng lúc đang tải (thiếu tạm thời,
  // an toàn) thay vì lộ nhầm đề xuất của người khác.
  // Lọc theo ITEM (2026-08-25) - p.status (rollup) không lên 'purchasing' cho tới khi MỌI dòng
  // của đề xuất gộp cùng ở đó; giữ đề xuất trong "chờ hàng về" chừng nào còn ít nhất 1 dòng đang
  // purchasing, kể cả khi phần của đồng nghiệp khác trong cùng đề xuất vẫn còn dở báo giá.
  const proposals = materialsLoading
    ? []
    : visibleProposalsFor(user, allProposals, buyerByMaterialId).filter(p => p.items.some(item => item.status === 'purchasing'))

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = proposals.find(p => p.id === selectedId) ?? null

  // ── Detail view: danh sách vật tư của 1 PO ────────────────────────────────────
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
                <th style={{ ...th, textAlign: 'right' }}>Tổng SL</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Đã mua</th>
                <th style={{ ...th, textAlign: 'right' }}>Còn lại</th>
                <th style={th}>Hạn giao</th>
                <th style={th}>Phiếu duyệt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text3)' }}>{r.poNumber ?? '—'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{r.itemName}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{r.buyQty}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>{r.unit}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.boughtQty > 0 ? '#16a34a' : 'var(--text3)' }}>{r.boughtQty}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: r.remaining > 0 ? '#d97706' : '#16a34a' }}>{r.remaining}</td>
                  <td style={{ ...td, color: r.deadline ? '#dc2626' : 'var(--text3)', fontWeight: r.deadline ? 600 : 400, whiteSpace: 'nowrap' }}>
                    {r.deadline ? new Date(r.deadline).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  {/* Giá + NCC nằm TRONG file này (2026-08-27) - phần mềm không lưu tách ra. */}
                  <td style={td}>
                    {r.approvalFileUrl ? (
                      <a href={r.approvalFileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
                        Xem file Sếp duyệt
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text3)' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── List view: theo từng PO ────────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Theo dõi mua hàng</h2>
      <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
        Các lệnh mua đã được Giám đốc duyệt, đang chờ hàng về — nhận hàng thực hiện ở Nhập kho.
      </div>

      {proposals.length === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text3)' }}>
          Không có lệnh mua nào đang chờ hàng về
        </div>
      ) : (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Truck size={16} color="#92400e" />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>Đang mua hàng</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
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
                  <th style={th}>Deadline</th>
                  <th style={th}>Trạng thái</th>
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
                      <td style={{ ...td, color: p.deadline ? '#dc2626' : 'var(--text3)', fontSize: 12, fontWeight: p.deadline ? 600 : 400 }}>
                        {p.deadline ? new Date(p.deadline).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td style={td}>{statusTag(p)}</td>
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

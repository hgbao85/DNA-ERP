'use client'
import { FileText } from 'lucide-react'
import { useInspection, PROPOSAL_STATUS_LABELS, type PurchaseProposal } from '../../../../context/InspectionContext'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

export default function PurchaseProposalsPage() {
  const { proposals } = useInspection()

  const config: AdminReadOnlyListConfig<PurchaseProposal> = {
    title: 'Đề xuất mua hàng',
    icon: <FileText size={16} color="#3949ab" />,
    searchFields: ['salesOrderCode', 'skuCode', 'skuName'],
    searchPlaceholder: 'Tìm theo mã PO hoặc SKU...',
    emptyMessage: 'Chưa có đề xuất mua hàng nào',
    pageSize: 10,
    columns: [
      { key: 'salesOrderCode', label: 'Mã PO', render: (p) => p.salesOrderCode ?? '—' },
      { key: 'skuCode', label: 'SKU', render: (p) => p.skuName ? `${p.skuCode} — ${p.skuName}` : p.skuCode },
      {
        // Vấn đề M6 audit 26/08 - trước đây hiện thẳng p.warehouseScope (mã kho lỗi thời, dùng để
        // route theo cách phân việc CŨ), trong khi phân việc hiện nay theo từng vật tư
        // (Material.buyerId, xem purchasingRouting.ts). Đổi sang gộp khoLabel thật của từng dòng
        // vật tư trong đề xuất - cùng cách LenhMuaNCCPage.tsx/TheoDoiMuaHangPage.tsx đang hiển thị.
        key: 'kho', label: 'Kho', render: (p) => [...new Set(p.items.map((i) => i.khoLabel))].join(', ') || '—',
      },
      {
        key: 'status', label: 'Trạng thái', render: (p) => {
          const s = PROPOSAL_STATUS_LABELS[p.status]
          return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
        },
      },
      { key: 'createdAt', label: 'Ngày tạo', render: (p) => fmtDate(p.createdAt) },
    ],
    filters: Object.entries(PROPOSAL_STATUS_LABELS).map(([key, s]) => ({
      key, label: s.label, color: s.color, bg: s.bg, predicate: (p: PurchaseProposal) => p.status === key,
    })),
    fetch: () => Promise.resolve(proposals),
  }

  return <AdminReadOnlyList config={config} />
}

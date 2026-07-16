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
    searchFields: ['poNumber', 'skuCode', 'skuName'],
    searchPlaceholder: 'Tìm theo mã PO hoặc SKU...',
    emptyMessage: 'Chưa có đề xuất mua hàng nào',
    pageSize: 10,
    columns: [
      { key: 'poNumber', label: 'Mã PO' },
      { key: 'skuCode', label: 'SKU', render: (p) => p.skuName ? `${p.skuCode} — ${p.skuName}` : p.skuCode },
      { key: 'warehouseScope', label: 'Kho' },
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

'use client'
import { Truck } from 'lucide-react'
import { getWarehouseTransfers } from '../../../../services/api'
import { TRANSFER_STATUS_MAP, type WarehouseTransfer, type TransferStatus } from '../../../../types/warehouse-transfer'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

export default function WarehouseTransfersPage() {
  const config: AdminReadOnlyListConfig<WarehouseTransfer> = {
    title: 'Chuyển kho',
    icon: <Truck size={16} color="#3949ab" />,
    searchFields: ['code', 'fromWarehouseName', 'toWarehouseName'],
    searchPlaceholder: 'Tìm theo mã phiếu hoặc kho...',
    emptyMessage: 'Chưa có phiếu chuyển kho nào',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã phiếu' },
      { key: 'fromWarehouseName', label: 'Từ kho' },
      { key: 'toWarehouseName', label: 'Đến kho' },
      { key: 'note', label: 'Ghi chú', render: (t) => t.note ?? '—' },
      {
        key: 'status', label: 'Trạng thái', render: (t) => {
          const s = TRANSFER_STATUS_MAP[t.status]
          return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
        },
      },
      { key: 'createdAt', label: 'Ngày tạo', render: (t) => fmtDate(t.createdAt) },
    ],
    filters: (Object.entries(TRANSFER_STATUS_MAP) as [TransferStatus, typeof TRANSFER_STATUS_MAP[TransferStatus]][]).map(([key, s]) => ({
      key, label: s.label, color: s.color, bg: s.bg, predicate: (t: WarehouseTransfer) => t.status === key,
    })),
    fetch: getWarehouseTransfers,
  }

  return <AdminReadOnlyList config={config} />
}

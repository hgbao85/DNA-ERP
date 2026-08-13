'use client'
import { ClipboardList } from 'lucide-react'
import { getSalesOrders } from '../../../../services/api'
import type { SalesOrder } from '../../../../types/sales'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

const fmtMoney = (n: number) => n.toLocaleString('vi-VN') + 'đ'
const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

export default function SalesPOsPage() {
  const config: AdminReadOnlyListConfig<SalesOrder> = {
    title: 'Đơn hàng bán',
    icon: <ClipboardList size={16} color="#3949ab" />,
    searchFields: ['code', 'customerName'],
    searchPlaceholder: 'Tìm theo mã đơn hoặc khách hàng...',
    emptyMessage: 'Chưa có đơn hàng bán nào',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã đơn' },
      { key: 'customerName', label: 'Khách hàng' },
      { key: 'orderDate', label: 'Ngày đặt', render: (p) => fmtDate(p.orderDate) },
      { key: 'deliveryDate', label: 'Ngày giao', render: (p) => fmtDate(p.deliveryDate) },
      { key: 'items', label: 'Số SKU', align: 'right', render: (p) => p.items.length },
      { key: 'totalValue', label: 'Tổng giá trị', align: 'right', render: (p) => fmtMoney(p.totalValue) },
      { key: 'depositAmount', label: 'Đã cọc', align: 'right', render: (p) => fmtMoney(p.depositAmount) },
    ],
    fetch: getSalesOrders,
  }

  return <AdminReadOnlyList config={config} />
}

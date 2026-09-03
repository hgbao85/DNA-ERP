'use client'
import { Layers3 } from 'lucide-react'
import { getSkus } from '../../../../services/api'
import { buildProductionOrderInfoByMfgProduct, lookupProductionOrderInfo } from '../../../../services/production-invoice-item'
import type { Sku, SkuStatus } from '../../../../types/sku'
import { STATUS_MAP } from '../../../../constants/skuStatus'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

// Mảnh/chi tiết giờ là 2 nhánh độc lập tiến song song - status chỉ còn 3 giá trị pipeline thật sự
// dùng (DRAFT không bao giờ được BE set, giữ trong SkuStatus chỉ vì các trang kho khác còn lọc
// phòng thủ theo nó - xem types/sku.ts). Dùng chung nhãn với STATUS_MAP thay vì định nghĩa lại.
const STATUS_LABEL: Record<SkuStatus, string> = {
  DRAFT: 'Nháp',
  IN_PROGRESS: STATUS_MAP.IN_PROGRESS.label,
  WAITING_BOSS_APPROVAL: STATUS_MAP.WAITING_BOSS_APPROVAL.label,
  APPROVED: STATUS_MAP.APPROVED.label,
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('vi-VN')

export default function SkuPage() {
  const config: AdminReadOnlyListConfig<Sku> = {
    title: 'SKU / Định mức',
    icon: <Layers3 size={16} color="#3949ab" />,
    searchFields: ['piCode', 'customerName'],
    searchPlaceholder: 'Tìm theo mã PI hoặc khách hàng...',
    emptyMessage: 'Chưa có SKU nào',
    pageSize: 10,
    columns: [
      { key: 'piCode', label: 'Mã PI' },
      { key: 'mfgProduct', label: 'Sản phẩm', render: (f) => f.mfgProduct ? `${f.mfgProduct.factoryCode} — ${f.mfgProduct.name}` : '—' },
      { key: 'customerName', label: 'Khách hàng', render: (f) => f.customerName ?? '—' },
      { key: 'status', label: 'Trạng thái', render: (f) => STATUS_LABEL[f.status] ?? f.status },
      { key: 'createdAt', label: 'Ngày tạo', render: (f) => fmtDate(f.createdAt) },
    ],
    filters: [
      // PlanForm.status không có giá trị REJECTED (từ chối chỉ rewind về IN_PROGRESS + xoá quyết
      // định duyệt, xem SkusService.rejectByBoss) nên chỉ còn 2 nhóm thật sự phân biệt được.
      { key: 'pending', label: 'Đang xử lý', predicate: (f) => f.status !== 'APPROVED' },
      { key: 'APPROVED', label: 'Đã duyệt', predicate: (f) => f.status === 'APPROVED' },
    ],
    // Medium fix: piCode trước đây đọc thẳng Sku.piCode (field tĩnh, gán 1 lần lúc tạo SKU) -
    // cùng lỗi pattern với H6 (ThongKePagePlan). Ưu tiên PI thật suy từ ProductionOrder đã duyệt
    // (buildProductionOrderInfoByMfgProduct - xem services/production-invoice-item.ts), fallback
    // về field tĩnh khi SKU chưa vào sản xuất (chưa có PO nào để suy). lookupProductionOrderInfo()
    // tra đúng theo (Sku.productionInvoiceId, mfgProductId) - không lấy nhầm PI khác khi cùng
    // mfgProduct chạy song song nhiều PI (bug #1, changelog 31/8).
    fetch: async () => {
      const [skus, poInfoMap] = await Promise.all([getSkus(), buildProductionOrderInfoByMfgProduct()])
      return skus.map((f) => ({ ...f, piCode: lookupProductionOrderInfo(poInfoMap, f)?.piCode ?? f.piCode }))
    },
  }

  return <AdminReadOnlyList config={config} />
}

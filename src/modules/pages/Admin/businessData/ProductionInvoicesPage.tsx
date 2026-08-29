'use client'
import { useState } from 'react'
import { AlertTriangle, Factory } from 'lucide-react'
import { getProductionInvoices, retryProductionOrder } from '../../../../services/api'
import { errMsg } from '../../../../utils/errors'
import ConfirmModal from '../../../../components/ConfirmModal'
import AdminReadOnlyList, { type AdminReadOnlyListConfig } from '../shared/AdminReadOnlyList'

interface ProductionInvoiceItem {
  id: string
  productVariant?: { mfgProduct?: { factoryCode?: string } }
  prodApproval?: { status: string }
  productionOrderId?: string | null
}

interface ProductionInvoice {
  id: string
  code: string
  deadline?: string
  status: string
  exportOrder?: { poNumber: string }
  createdBy?: { name: string }
  items?: ProductionInvoiceItem[]
}

const STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Lên kế hoạch',
  PRODUCING: 'Đang sản xuất',
  DONE: 'Hoàn thành',
}

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('vi-VN') : '—'

/** SKU "kẹt": Sếp đã duyệt (APPROVED) nhưng lệnh sản xuất tạo thất bại (race hiếm - BOM bị
 *  deactivate đúng khoảnh khắc giữa 2 lệnh, xem ProductionInvoicesService.retryProductionOrder()
 *  ở BE) - productionOrderId=null dù prodApproval.status vẫn là APPROVED như bình thường. */
const stuckItems = (pi: ProductionInvoice) =>
  (pi.items ?? []).filter(it => it.prodApproval?.status === 'APPROVED' && !it.productionOrderId)

export default function ProductionInvoicesPage() {
  // Phase Lệnh SX chưa có màn nào cho Sếp xem lại PI đã duyệt để tự bấm sửa (đã kiểm - LenhSXPage
  // chỉ hiện PI đang CHỜ duyệt, biến mất ngay sau khi duyệt xong) - "Tạo lại lệnh SX" tạm thời đặt
  // ở đây cho Admin xử lý, cùng tinh thần "Tính lại" ở CuttingProposalsPage.tsx (sự cố kỹ thuật
  // hiếm gặp, không phải quyết định nghiệp vụ duyệt/từ chối - đính chính 2026-08-29).
  const [retryTarget, setRetryTarget] = useState<{ pi: ProductionInvoice; item: ProductionInvoiceItem } | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const doRetry = async (refetch: () => void) => {
    if (!retryTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await retryProductionOrder(retryTarget.pi.id, retryTarget.item.id)
      setRetryTarget(null)
      refetch()
    } catch (e) {
      setActionError(errMsg(e, 'Lỗi tạo lại lệnh sản xuất'))
    } finally {
      setBusy(false)
    }
  }

  const config: AdminReadOnlyListConfig<ProductionInvoice> = {
    title: 'Lệnh sản xuất (PI)',
    icon: <Factory size={16} color="#3949ab" />,
    searchFields: ['code'],
    searchPlaceholder: 'Tìm theo mã PI...',
    emptyMessage: 'Chưa có lệnh sản xuất nào',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã PI' },
      { key: 'exportOrder', label: 'Đơn xuất khẩu', render: (p) => p.exportOrder?.poNumber ?? '—' },
      { key: 'deadline', label: 'Deadline', render: (p) => fmtDate(p.deadline) },
      { key: 'status', label: 'Trạng thái', render: (p) => STATUS_LABEL[p.status] ?? p.status },
      { key: 'createdBy', label: 'Người tạo', render: (p) => p.createdBy?.name ?? '—' },
      {
        key: 'stuck',
        label: 'Sự cố',
        render: (p, refetch) => {
          const stuck = stuckItems(p)
          if (stuck.length === 0) return '—'
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {stuck.map(item => (
                <button
                  key={item.id}
                  onClick={() => setRetryTarget({ pi: p, item })}
                  title="Đã duyệt nhưng chưa tạo được lệnh sản xuất - nhấn để thử tạo lại"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '3px 8px', cursor: 'pointer', width: 'fit-content' }}
                >
                  <AlertTriangle size={11} />
                  {item.productVariant?.mfgProduct?.factoryCode ?? 'SKU'} - Tạo lại lệnh SX
                </button>
              ))}
              {/* refetch chỉ dùng ở đây (đóng modal xong load lại danh sách) - render() nhận refetch
                  từ AdminReadOnlyList cho đúng mục đích hiếm này, không dùng cho cột nào khác. */}
              {retryTarget?.pi.id === p.id && (
                <ConfirmModal
                  open={true}
                  title="Tạo lại lệnh sản xuất"
                  message={`SKU ${retryTarget.item.productVariant?.mfgProduct?.factoryCode ?? ''} của ${p.code} đã được Sếp duyệt nhưng lệnh sản xuất tạo thất bại (sự cố kỹ thuật hiếm gặp). Tạo lại lệnh sản xuất và tính lại đề xuất cắt sắt/mua vật tư cho SKU này?`}
                  confirmLabel="Tạo lại"
                  busy={busy}
                  error={actionError}
                  onConfirm={() => void doRetry(refetch)}
                  onCancel={() => { setRetryTarget(null); setActionError(null) }}
                />
              )}
            </div>
          )
        },
      },
    ],
    filters: [
      { key: 'PLANNING', label: 'Lên kế hoạch', predicate: (p) => p.status === 'PLANNING' },
      { key: 'PRODUCING', label: 'Đang sản xuất', predicate: (p) => p.status === 'PRODUCING' },
      { key: 'DONE', label: 'Hoàn thành', predicate: (p) => p.status === 'DONE' },
    ],
    fetch: () => getProductionInvoices() as Promise<ProductionInvoice[]>,
  }

  return <AdminReadOnlyList config={config} />
}

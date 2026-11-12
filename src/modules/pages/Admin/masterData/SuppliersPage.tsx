'use client'
import { useState } from 'react'
import { Truck } from 'lucide-react'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../../../../services/api'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'
import SupplierOrderCountersPanel from './SupplierOrderCountersPanel'

interface Supplier {
  id: number
  name: string
  phone?: string | null
  address?: string | null
  taxCode?: string | null
  contactName?: string | null
  isActive: boolean
}

/**
 * Danh sách NCC = "sheet quản lý NCC" (12/11/2026, anh Nhân): người mua chọn tên NCC từ đây khi tạo đơn đặt hàng.
 * Dùng chung cho Admin › Danh mục hệ thống › Nhà cung cấp và Mua hàng › Nhà cung cấp (`purchasingView`): người mua tự
 * thêm/sửa NCC, CHỈ Admin xoá (BE chặn DELETE theo vai trò) và chỉ Admin nạp khung số đơn.
 */
export default function SuppliersPage({ purchasingView = false }: { purchasingView?: boolean } = {}) {
  const { logAction } = useAuditLog()
  // Thêm/sửa/xoá NCC thì tải lại khung số đơn đặt hàng (2026-11-04) - NCC mới hiện ngay, không cần F5.
  const [countersKey, setCountersKey] = useState(0)

  const config: AdminEntityConfig<Supplier> = {
    title: 'Nhà cung cấp',
    icon: <Truck size={18} color="var(--fg-3949ab)" />,
    searchFields: ['name', 'phone', 'taxCode', 'contactName'],
    searchPlaceholder: 'Tìm theo tên, SĐT, mã số thuế, người liên hệ...',
    emptyMessage: 'Chưa có nhà cung cấp nào',
    addLabel: 'Thêm nhà cung cấp',
    pageSize: 10,
    columns: [
      { key: 'name', label: 'Tên nhà cung cấp' },
      { key: 'contactName', label: 'Người liên hệ' },
      { key: 'phone', label: 'Điện thoại' },
      { key: 'taxCode', label: 'Mã số thuế' },
      { key: 'address', label: 'Địa chỉ' },
      {
        key: 'isActive', label: 'Trạng thái', align: 'center', render: (s) => (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: s.isActive ? 'var(--green-bg)' : 'var(--red-bg)',
            color: s.isActive ? 'var(--green)' : 'var(--red)',
          }}>
            {s.isActive ? 'Hoạt động' : 'Ngừng hợp tác'}
          </span>
        ),
      },
    ],
    filters: [
      { key: 'active', label: 'Đang hoạt động', predicate: (s) => s.isActive },
      { key: 'inactive', label: 'Ngừng hợp tác', predicate: (s) => !s.isActive },
    ],
    formFields: [
      { name: 'name', label: 'Tên nhà cung cấp', type: 'text', required: true },
      { name: 'contactName', label: 'Người liên hệ', type: 'text' },
      { name: 'phone', label: 'Điện thoại', type: 'text' },
      { name: 'taxCode', label: 'Mã số thuế', type: 'text' },
      { name: 'address', label: 'Địa chỉ', type: 'text' },
      { name: 'isActive', label: 'Trạng thái', type: 'checkbox', placeholder: 'Đang hoạt động', defaultValue: true },
    ],
    deleteConfirm: (s) => ({
      title: 'Xóa nhà cung cấp',
      message: `Xóa nhà cung cấp "${s.name}"? Các liên kết vật tư — nhà cung cấp hiện có sẽ không còn hiển thị NCC này. Hành động này không thể hoàn tác.`,
    }),
    onMutate: (action, s) => {
      setCountersKey(k => k + 1)
      if (action === 'create') logAction('supplier', String(s.id), 'masterdata.created', s.name)
      else if (action === 'update') logAction('supplier', String(s.id), 'masterdata.updated', s.name)
      else logAction('supplier', String(s.id), 'masterdata.deleted', s.name)
    },
    api: {
      list: getSuppliers as () => Promise<Supplier[]>,
      create: (data) => createSupplier(data) as unknown as Promise<Supplier>,
      update: (id, data) => updateSupplier(id, data) as Promise<Supplier | undefined>,
      // Mua hàng không có nút Xóa - chỉ Admin xoá NCC (12/11/2026).
      remove: purchasingView ? undefined : (id) => deleteSupplier(id),
    },
  }

  return (
    <>
      <AdminEntityPage config={config} />
      {/* Số đơn đặt hàng theo NCC + năm (2026-11-04, bản v8 mục 4.13) - Admin nạp số cuối năm trước khi dùng. */}
      {!purchasingView && <SupplierOrderCountersPanel key={countersKey} />}
    </>
  )
}

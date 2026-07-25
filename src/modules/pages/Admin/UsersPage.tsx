'use client'
import { Users } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getUsers, createUser, updateUser, deleteUser } from '../../../services/api'
import type { SystemUser } from '../../../types/admin'
import AdminEntityPage, { type AdminEntityConfig } from './shared/AdminEntityPage'

const ROLE_LABEL: Record<SystemUser['role'], string> = {
  ADMIN: 'Quản trị viên',
  BOSS: 'Giám đốc',
  WAREHOUSE_STAFF: 'Nhân viên',
}

const ROLE_BADGE_COLOR: Record<SystemUser['role'], { bg: string; text: string }> = {
  ADMIN: { bg: 'var(--amber-bg)', text: 'var(--amber)' },
  BOSS: { bg: 'var(--blue-bg)', text: 'var(--blue-text)' },
  WAREHOUSE_STAFF: { bg: 'var(--green-bg)', text: 'var(--green)' },
}

const MFG_ROLE_LABEL: Record<string, string> = {
  PRODUCTION_MANAGER: 'Quản lý SX',
  PHOI: 'Thống kê Phôi',
  HAN: 'Bộ phận Hàn',
  SON: 'Bộ phận Sơn',
  KCS: 'KCS — Kiểm tra chất lượng',
  WEAVING_MANAGER: 'Quản lý nhập đan',
  WEAVING_EXPORT: 'Quản lý xuất đan',
  BOM_MANAGER: 'NV Định mức',
  SPEC_STEEL: 'NV Định mức - Sắt',
  SPEC_WIRE_PAINT: 'NV Định mức - Dây/Sơn',
  SPEC_ACCESSORY: 'NV Định mức - Phụ kiện/Bao bì',
  SPEC_PACKAGING: 'NV Định mức - Đóng gói',
}

const WAREHOUSE_SCOPE_LABEL: Record<string, string> = {
  'phu-kien': 'Phụ kiện',
  'bao-bi': 'Bao bì',
  'day': 'Dây',
  'sat': 'Sắt',
  'thanh-pham': 'Thành phẩm',
  'thanh-pham-2': 'Thành phẩm 2',
  'thanh-pham-3': 'Thành phẩm 3',
  'vat-tu-tp': 'Vật tư / Thành phẩm',
  'phoi-son-han': 'Phôi Sơn Hàn',
}

function chucNangOf(u: SystemUser): string {
  const tags: string[] = []
  if (u.mfgRole) tags.push(MFG_ROLE_LABEL[u.mfgRole] ?? u.mfgRole)
  if (u.isPurchaser) tags.push('Mua hàng')
  if (u.isProductPlanner) tags.push('KH Sản xuất')
  if (u.isSale) tags.push('Sales')
  if (!u.mfgRole && u.warehouseScope) tags.push(`Kho ${WAREHOUSE_SCOPE_LABEL[u.warehouseScope] ?? u.warehouseScope}`)
  return tags.length > 0 ? tags.join(', ') : '—'
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const { logAction } = useAuditLog()

  const config: AdminEntityConfig<SystemUser> = {
    title: 'Người dùng',
    icon: <Users size={18} color="#3949ab" />,
    searchFields: ['name', 'email'],
    searchPlaceholder: 'Tìm theo tên hoặc email...',
    emptyMessage: 'Chưa có tài khoản nào',
    addLabel: 'Thêm tài khoản',
    pageSize: 10,
    columns: [
      {
        key: 'name', label: 'Tên', render: (u) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e8eaf6', color: '#3949ab', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {u.name.split(' ').pop()?.substring(0, 2).toUpperCase()}
            </div>
            <span style={{ fontWeight: 600 }}>{u.name}</span>
          </div>
        ),
      },
      { key: 'username', label: 'Tên đăng nhập', render: (u) => u.username ?? '—' },
      { key: 'email', label: 'Email' },
      {
        key: 'role', label: 'Vai trò', render: (u) => (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: ROLE_BADGE_COLOR[u.role].bg,
            color: ROLE_BADGE_COLOR[u.role].text,
          }}>
            {ROLE_LABEL[u.role]}
          </span>
        ),
      },
      { key: 'chucNang', label: 'Chức năng', render: chucNangOf },
      {
        key: 'isActive', label: 'Trạng thái', align: 'center', render: (u) => (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: u.isActive ? 'var(--green-bg)' : 'var(--red-bg)',
            color: u.isActive ? 'var(--green)' : 'var(--red)',
          }}>
            {u.isActive ? 'Hoạt động' : 'Đã khóa'}
          </span>
        ),
      },
      { key: 'createdAt', label: 'Ngày tạo', render: (u) => new Date(u.createdAt).toLocaleDateString('vi-VN') },
    ],
    filters: [
      { key: 'admin', label: 'Quản trị viên', predicate: (u) => u.role === 'ADMIN' },
      { key: 'boss', label: 'Giám đốc', predicate: (u) => u.role === 'BOSS' },
      { key: 'mfg', label: 'Sản xuất', predicate: (u) => !!u.mfgRole },
      { key: 'purchasing', label: 'Mua hàng', predicate: (u) => !!u.isPurchaser },
      { key: 'planner', label: 'KH Sản xuất', predicate: (u) => !!u.isProductPlanner },
      { key: 'sales', label: 'Sales', predicate: (u) => !!u.isSale },
      { key: 'warehouse', label: 'Kho', predicate: (u) => u.role === 'WAREHOUSE_STAFF' && !u.mfgRole && !u.isPurchaser && !u.isProductPlanner && !u.isSale },
    ],
    formFields: [
      { name: 'name', label: 'Họ tên', type: 'text', required: true },
      {
        // Dùng để đăng nhập (BE thật). Không sửa được sau khi tạo — BE PATCH không nhận username.
        name: 'username', label: 'Tên đăng nhập', type: 'text', placeholder: 'chỉ chữ/số . _ -',
        validate: (v, all) =>
          (!all.id && !v) ? 'Bắt buộc khi tạo mới'
          : (v && !/^[a-zA-Z0-9._-]{3,}$/.test(String(v))) ? 'Tối thiểu 3 ký tự, chỉ chữ/số . _ -'
          : undefined,
      },
      {
        name: 'email', label: 'Email', type: 'email', required: true,
        validate: (v) => (!v || !/^\S+@\S+\.\S+$/.test(String(v))) ? 'Email không hợp lệ' : undefined,
      },
      {
        name: 'password', label: 'Mật khẩu', type: 'password', placeholder: 'Để trống nếu không đổi',
        skipIfBlankOnEdit: true,
        // BE yêu cầu tối thiểu 8 ký tự (đổi từ 6 khi cắt sang API thật).
        validate: (v, all) => (!all.id && !v) ? 'Bắt buộc khi tạo mới' : (v && String(v).length < 8) ? 'Tối thiểu 8 ký tự' : undefined,
      },
      {
        name: 'role', label: 'Vai trò', type: 'select', required: true,
        options: [
          { value: 'ADMIN', label: 'Quản trị viên' },
          { value: 'BOSS', label: 'Giám đốc' },
          { value: 'WAREHOUSE_STAFF', label: 'Nhân viên' },
        ],
      },
      {
        name: 'mfgRole', label: 'Vai trò sản xuất', type: 'select',
        showIf: (v) => v.role === 'WAREHOUSE_STAFF',
        // Ẩn WEAVING_EXPORT & BOM_MANAGER: BE chưa có business role tương ứng (sẽ có mfgRole nhưng không quyền).
        options: Object.entries(MFG_ROLE_LABEL)
          .filter(([value]) => value !== 'WEAVING_EXPORT' && value !== 'BOM_MANAGER')
          .map(([value, label]) => ({ value, label })),
      },
      {
        name: 'warehouseScope', label: 'Nhóm kho phụ trách', type: 'select',
        showIf: (v) => v.role === 'WAREHOUSE_STAFF' && !v.mfgRole,
        options: Object.entries(WAREHOUSE_SCOPE_LABEL).map(([value, label]) => ({ value, label })),
      },
      { name: 'isPurchaser', label: 'Mua hàng', type: 'checkbox', placeholder: 'Là nhân viên mua hàng', showIf: (v) => v.role === 'WAREHOUSE_STAFF' && !v.mfgRole },
      { name: 'isProductPlanner', label: 'KH Sản xuất', type: 'checkbox', placeholder: 'Là nhân viên kế hoạch sản xuất', showIf: (v) => v.role === 'WAREHOUSE_STAFF' && !v.mfgRole },
      { name: 'isSale', label: 'Sales', type: 'checkbox', placeholder: 'Là nhân viên kinh doanh', showIf: (v) => v.role === 'WAREHOUSE_STAFF' && !v.mfgRole },
      { name: 'isActive', label: 'Trạng thái', type: 'checkbox', placeholder: 'Tài khoản đang hoạt động', defaultValue: true },
    ],
    deleteConfirm: (u) => ({
      title: 'Xóa tài khoản',
      message: `Xóa tài khoản "${u.name}" (${u.email})? Người dùng sẽ không thể đăng nhập nữa. Hành động này không thể hoàn tác.`,
    }),
    guardDelete: (u) => (u.id === currentUser?.id ? 'Không thể xóa chính tài khoản đang đăng nhập' : undefined),
    guardSave: (values, isNew) =>
      (!isNew && values.id === currentUser?.id && values.role !== currentUser?.role)
        ? 'Không thể tự đổi vai trò tài khoản đang đăng nhập'
        : undefined,
    onMutate: (action, u) => {
      const label = `${u.name} (${u.email})`
      if (action === 'create') logAction('user', String(u.id), 'user.created', label)
      else if (action === 'update') logAction('user', String(u.id), 'user.updated', label)
      else logAction('user', String(u.id), 'user.deleted', label)
    },
    api: { list: getUsers, create: createUser, update: updateUser, remove: deleteUser },
  }

  return <AdminEntityPage config={config} />
}

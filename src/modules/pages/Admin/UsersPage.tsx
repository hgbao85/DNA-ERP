'use client'
import { useState } from 'react'
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

// Nhãn hiển thị cho mfgRole — kể cả giá trị legacy SPEC_PACKAGING (không còn cho chọn mới)
// để bản ghi cũ (nếu có) vẫn hiện tên thay vì mã enum thô ở cột "Chức năng".
const MFG_ROLE_LABEL: Record<string, string> = {
  PRODUCTION_MANAGER: 'Quản lý SX',
  PHOI: 'Bộ phận Phôi',
  HAN: 'Bộ phận Hàn',
  SON: 'Bộ phận Sơn',
  KCS: 'KCS — Kiểm tra chất lượng',
  SPEC_STEEL: 'NV Định mức — Sắt',
  SPEC_WIRE_PAINT: 'NV Định mức — Vật tư/Phụ kiện',
  SPEC_ACCESSORY: 'NV Định mức — Bao bì/Đóng gói',
  SPEC_PACKAGING: 'NV Định mức — Đóng gói (không còn dùng)',
}

// Công đoạn sản xuất (nhóm "Nhân viên sản xuất") và vị trí định mức (nhóm "Nhân viên định
// mức") đều lưu chung vào mfgRole — 2 tập hợp con này quyết định option nào hiện ở đâu.
const MFG_FLOOR_VALUES: NonNullable<SystemUser['mfgRole']>[] = ['PHOI', 'HAN', 'SON', 'KCS']
const SPEC_VALUES: NonNullable<SystemUser['mfgRole']>[] = ['SPEC_STEEL', 'SPEC_WIRE_PAINT', 'SPEC_ACCESSORY']

const SPEC_HINT: Record<string, string> = {
  SPEC_STEEL: 'Nhập định mức mảnh Sắt.',
  SPEC_WIRE_PAINT: 'Nhập định mức mảnh Dây, định mức chi tiết Sơn/Đinh.',
  SPEC_ACCESSORY: 'Nhập định mức Vật tư/Phụ kiện và định mức Bao bì/Đóng gói.',
}

// 3 kho thật đang vận hành (trước có thêm Phụ kiện/Bao bì/Dây/Sắt — dữ liệu mock mồ côi,
// không nghiệp vụ nào dùng, đã bỏ). "Thành phẩm" có thể có nhiều kho đánh số song song.
const WAREHOUSE_SCOPE_LABEL: Record<string, string> = {
  'phoi-son-han': 'Phôi - Sơn - Hàn',
  'vat-tu-tp': 'Vật tư thành phẩm',
  'thanh-pham': 'Thành phẩm',
  'thanh-pham-2': 'Thành phẩm 2',
  'thanh-pham-3': 'Thành phẩm 3',
}
const WAREHOUSE_SCOPE_OPTIONS = Object.entries(WAREHOUSE_SCOPE_LABEL).map(([value, label]) => ({ value, label }))

function chucNangOf(u: SystemUser): string {
  const tags: string[] = []
  if (u.mfgRole) tags.push(MFG_ROLE_LABEL[u.mfgRole] ?? u.mfgRole)
  if (u.isPurchaser) tags.push('Mua hàng')
  if (u.isProductPlanner) tags.push('KH Sản xuất')
  if (u.isSale) tags.push('Sales')
  if (!u.mfgRole && u.warehouseScope) tags.push(`Kho ${WAREHOUSE_SCOPE_LABEL[u.warehouseScope] ?? u.warehouseScope}`)
  return tags.length > 0 ? tags.join(', ') : '—'
}

// ─── Khối "Loại nhân viên" ─────────────────────────────────────────────────
// 4 loại song song: Văn phòng / Kho / Định mức / Sản xuất — mỗi loại dẫn tới đúng 1 field
// dữ liệu thật (mfgRole hoặc warehouseScope/cờ boolean có sẵn), không phát sinh cột DB mới.

type StaffCategory = 'office' | 'warehouse' | 'spec' | 'mfg'
type OfficeFn = 'SALE' | 'PLANNER' | 'PROD_MGR' | 'PURCHASE'

const STAFF_CATEGORIES: { value: StaffCategory; label: string }[] = [
  { value: 'office', label: 'Văn phòng' },
  { value: 'warehouse', label: 'Kho' },
  { value: 'spec', label: 'Định mức' },
  { value: 'mfg', label: 'Sản xuất' },
]

const OFFICE_FUNCTIONS: { value: OfficeFn; label: string }[] = [
  { value: 'SALE', label: 'Sales' },
  { value: 'PLANNER', label: 'KH Sản xuất (KHSX)' },
  { value: 'PROD_MGR', label: 'Quản lý sản xuất (QLSX)' },
  { value: 'PURCHASE', label: 'Mua hàng' },
]

function deriveStaffCategory(v: Partial<SystemUser>): StaffCategory | undefined {
  if (v.mfgRole && MFG_FLOOR_VALUES.includes(v.mfgRole)) return 'mfg'
  if (v.mfgRole && SPEC_VALUES.includes(v.mfgRole)) return 'spec'
  if (v.mfgRole === 'PRODUCTION_MANAGER') return 'office'
  if (v.isSale || v.isProductPlanner || v.isPurchaser) return 'office'
  if (v.warehouseScope) return 'warehouse'
  return undefined
}

function deriveOfficeFn(v: Partial<SystemUser>): OfficeFn | undefined {
  if (v.mfgRole === 'PRODUCTION_MANAGER') return 'PROD_MGR'
  if (v.isPurchaser) return 'PURCHASE'
  if (v.isProductPlanner) return 'PLANNER'
  if (v.isSale) return 'SALE'
  return undefined
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }
const fieldSelect: React.CSSProperties = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }

function EmployeeTypeField({ values, setField }: { value: unknown; values: Partial<SystemUser>; setField: (name: string, value: unknown) => void }) {
  // Suy ra nhánh ban đầu từ dữ liệu đã lưu (sửa user có sẵn) — nhưng sau đó phải tự nhớ nhánh
  // đang chọn bằng state riêng, vì bấm sang 1 nhánh mới sẽ xoá sạch field của nhánh cũ (xem
  // selectCategory dưới), lúc đó suy luận lại từ values sẽ ra "chưa chọn gì".
  const [category, setCategory] = useState<StaffCategory | undefined>(() => deriveStaffCategory(values))

  const selectCategory = (next: StaffCategory) => {
    if (next === category) return
    setCategory(next)
    // Đổi loại nhân viên → dọn sạch field của loại cũ trước khi áp loại mới, tránh lẫn dữ liệu.
    setField('mfgRole', undefined)
    setField('warehouseScope', undefined)
    setField('isPurchaser', false)
    setField('isProductPlanner', false)
    setField('isSale', false)
  }

  const officeFn = deriveOfficeFn(values)
  const onOfficeFnChange = (fn: OfficeFn) => {
    setField('isSale', fn === 'SALE')
    setField('isProductPlanner', fn === 'PLANNER')
    setField('isPurchaser', fn === 'PURCHASE')
    setField('mfgRole', fn === 'PROD_MGR' ? 'PRODUCTION_MANAGER' : undefined)
    if (fn !== 'PURCHASE') setField('warehouseScope', undefined)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label style={fieldLabel}>Loại nhân viên</label>
        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {STAFF_CATEGORIES.map((c, i) => (
            <button
              key={c.value}
              type="button"
              onClick={() => selectCategory(c.value)}
              style={{
                flex: 1, padding: '8px 6px', fontSize: 12, fontWeight: 600, border: 'none',
                borderRight: i < STAFF_CATEGORIES.length - 1 ? '1px solid var(--border)' : 'none',
                background: category === c.value ? '#3949ab' : 'var(--surface)',
                color: category === c.value ? '#fff' : 'var(--text2)',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {category === 'office' && (
        <>
          <div>
            <label style={fieldLabel}>Chức năng</label>
            <select value={officeFn ?? ''} onChange={e => onOfficeFnChange(e.target.value as OfficeFn)} style={fieldSelect}>
              <option value="">— Chọn chức năng —</option>
              {OFFICE_FUNCTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          {officeFn === 'PURCHASE' && (
            <div>
              <label style={fieldLabel}>Kho phụ trách</label>
              <select value={String(values.warehouseScope ?? '')} onChange={e => setField('warehouseScope', e.target.value || undefined)} style={fieldSelect}>
                <option value="">— Chọn kho —</option>
                {WAREHOUSE_SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {category === 'warehouse' && (
        <div>
          <label style={fieldLabel}>Kho phụ trách</label>
          <select value={String(values.warehouseScope ?? '')} onChange={e => setField('warehouseScope', e.target.value || undefined)} style={fieldSelect}>
            <option value="">— Chọn kho —</option>
            {WAREHOUSE_SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      )}

      {category === 'spec' && (
        <div>
          <label style={fieldLabel}>Vị trí định mức</label>
          <select value={String(values.mfgRole ?? '')} onChange={e => setField('mfgRole', e.target.value || undefined)} style={fieldSelect}>
            <option value="">— Chọn vị trí —</option>
            {SPEC_VALUES.map(v => <option key={v} value={v}>{MFG_ROLE_LABEL[v]}</option>)}
          </select>
          {values.mfgRole && SPEC_HINT[values.mfgRole] && (
            <span style={{ display: 'block', fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{SPEC_HINT[values.mfgRole]}</span>
          )}
        </div>
      )}

      {category === 'mfg' && (
        <div>
          <label style={fieldLabel}>Công đoạn sản xuất</label>
          <select value={String(values.mfgRole ?? '')} onChange={e => setField('mfgRole', e.target.value || undefined)} style={fieldSelect}>
            <option value="">— Chọn công đoạn —</option>
            {MFG_FLOOR_VALUES.map(v => <option key={v} value={v}>{MFG_ROLE_LABEL[v]}</option>)}
          </select>
        </div>
      )}
    </div>
  )
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
      { key: 'office', label: 'Văn phòng', predicate: (u) => deriveStaffCategory(u) === 'office' },
      { key: 'warehouse', label: 'Kho', predicate: (u) => deriveStaffCategory(u) === 'warehouse' },
      { key: 'spec', label: 'Định mức', predicate: (u) => deriveStaffCategory(u) === 'spec' },
      { key: 'mfg', label: 'Sản xuất', predicate: (u) => deriveStaffCategory(u) === 'mfg' },
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
        name: 'employeeType', label: 'Loại nhân viên', type: 'custom',
        showIf: (v) => v.role === 'WAREHOUSE_STAFF',
        excludeFromPayload: true,
        Render: EmployeeTypeField,
        validate: (_v, all) => {
          const cat = deriveStaffCategory(all)
          if (!cat) return 'Chọn loại nhân viên'
          if (cat === 'office') {
            const fn = deriveOfficeFn(all)
            if (!fn) return 'Chọn chức năng'
            if (fn === 'PURCHASE' && !all.warehouseScope) return 'Chọn kho phụ trách cho Mua hàng'
          }
          if (cat === 'warehouse' && !all.warehouseScope) return 'Chọn kho phụ trách'
          if ((cat === 'spec' || cat === 'mfg') && !all.mfgRole) return 'Chọn vị trí'
          return undefined
        },
      },
      // 5 field dưới đây là dữ liệu thật (được khối "Loại nhân viên" ở trên set) — không tự vẽ
      // dòng riêng (type 'hidden'), nhưng vẫn theo showIf/payload như field bình thường.
      { name: 'mfgRole', label: 'Bộ phận / Vị trí', type: 'hidden', showIf: (v) => v.role === 'WAREHOUSE_STAFF' },
      { name: 'warehouseScope', label: 'Kho phụ trách', type: 'hidden', showIf: (v) => v.role === 'WAREHOUSE_STAFF' },
      { name: 'isPurchaser', label: 'Mua hàng', type: 'hidden', showIf: (v) => v.role === 'WAREHOUSE_STAFF' },
      { name: 'isProductPlanner', label: 'KH Sản xuất', type: 'hidden', showIf: (v) => v.role === 'WAREHOUSE_STAFF' },
      { name: 'isSale', label: 'Sales', type: 'hidden', showIf: (v) => v.role === 'WAREHOUSE_STAFF' },
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

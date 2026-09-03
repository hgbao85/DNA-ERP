'use client'
import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import {
  updateUser, getUsers, getWarehouses, createWarehouse, deleteWarehouse,
  getMaterials, createMaterial, getMaterialGroups, getStockQuants, getStockLedger, adjustStock,
} from '../../../services/api'
import { Plus, Trash2, X, ArrowLeft, Warehouse, Search, Copy } from 'lucide-react'
import AdjustReasonModal from '../../../components/AdjustReasonModal'
import { warehouseFamilyOf, type WarehouseFamily } from '../../../utils/warehouseFamily'
export { isThanhPhamScope } from '../../../utils/warehouseFamily'

// ── Types (view-model tối giản, khớp field thật cần dùng - xem warehouses-api.ts/
//    materials-api.ts/stock-api.ts cho hợp đồng đầy đủ) ─────────────────────────

interface WhRow {
  id: string
  code: string
  name: string
  note: string | null
}
interface MaterialRow {
  id: number
  code: string
  name: string
  unit: string
  spec: string | null
  materialGroupId: number | null
  warehouseId: string | null
}
interface GroupRow {
  id: number
  name: string
}
interface UserRow {
  id: number
  name: string
  email: string
  role: 'BOSS' | 'WAREHOUSE_STAFF' | 'ADMIN'
  mfgRole?: string | null
  warehouseScope?: string | null
  isPurchaser?: boolean
  isProductPlanner?: boolean
  isSale?: boolean
  isActive: boolean
}
interface QuantRow {
  materialId: string | null
  warehouseId: string
  qty: number
  /** Vấn đề #13 audit 26/08 - tồn còn dùng được (đã trừ phần giữ chỗ cắt sắt/chuyển kho), BE tính
   *  sẵn qua getAvailableQty() dùng chung với màn Xuất sắt - xem stock-api.ts. */
  availableQty: number
}
interface LedgerRow {
  id: string
  fromWarehouseCode: string
  toWarehouseCode: string
  materialCode: string | null
  qty: number
  note: string | null
  createdAt: string
}
export interface StockItem {
  materialId: number
  code: string
  name: string
  unit: string
  spec: string | null
  groupName: string
  qty: number
  /** Xem QuantRow.availableQty - mặc định === qty nếu vật tư này không có dòng stock_quant nào
   *  (chưa từng phát sinh giao dịch, tồn = 0 = khả dụng). */
  availableQty: number
}

// ── Config nhóm (label/mô tả header + gate nút "Tạo kho thành phẩm mới") ───────

interface WhGroup { key: string; label: string; desc: string }

const WAREHOUSE_GROUPS: WhGroup[] = [
  { key: 'all',          label: 'Tất cả kho',             desc: 'Tổng hợp tất cả kho' },
  { key: 'phoi-son-han', label: 'Kho phôi sơn hàn',      desc: 'Phôi kim loại, sơn, vật tư hàn và cơ khí' },
  { key: 'vat-tu-tp',    label: 'Kho vật tư thành phẩm', desc: 'Vật tư, phụ kiện, dây đan dùng cho thành phẩm' },
  { key: 'thanh-pham',   label: 'Kho thành phẩm',         desc: 'Thành phẩm và bao bì đóng gói hoàn chỉnh' },
]

const BASE_CODES = new Set(['phoi-son-han', 'vat-tu-tp', 'thanh-pham'])

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MfgWarehousesPage({ groupKey }: { groupKey?: string | null }) {
  const { user } = useAuth()
  // Quyền "Thêm vật tư" thuộc về Thủ kho (biết rõ tồn vật lý thực tế của kho mình khi khai
  // báo Tồn kho ban đầu lúc tạo vật tư) - không còn cấp cho QLSX, xem role-permissions.constant.ts.
  const canWrite = user?.role === 'WAREHOUSE_STAFF' && !user?.mfgRole
  const isAdmin  = user?.role === 'ADMIN'

  const { data: warehouses, isLoading: whLoading, error: whError, refetch: refetchWarehouses } = useFetch<WhRow[]>(getWarehouses)
  const { data: materials, refetch: refetchMaterials } = useFetch<MaterialRow[]>(getMaterials)
  const { data: groups } = useFetch<GroupRow[]>(getMaterialGroups)
  const { data: quants, refetch: refetchQuants } = useFetch<QuantRow[]>(() => getStockQuants())

  const [openId, setOpenId]                 = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const group = groupKey ? WAREHOUSE_GROUPS.find(g => g.key === groupKey) : null

  // Lọc theo groupKey (khớp code trực tiếp thay vì regex tên)
  const visibleWhs = (groupKey && groupKey !== 'all')
    ? (warehouses ?? []).filter(w => w.code === groupKey || w.code.startsWith(groupKey + '-'))
    : (warehouses ?? [])

  // Gia đình gợi ý sẵn khi mở form tạo kho - suy từ nhóm đang xem (nếu có, vd Thủ kho vào đúng tab
  // "Kho phôi sơn hàn"); về null khi xem "Tổng hợp kho" (Admin > Quản lý kho không có khái niệm
  // nhóm - luôn hiện gộp cả 7 kho, KHÔNG suy ra được gia đình nào) - modal tự hỏi lại bằng dropdown
  // riêng trong trường hợp đó (2026-09-03: bản đầu lỡ chỉ hiện nút khi có sẵn gia đình, khiến nút
  // biến mất hoàn toàn trên trang Admin > Quản lý kho - phát hiện qua test tay thật).
  const suggestedFamily: WarehouseFamily | null = group ? warehouseFamilyOf(group.key) : null

  const itemsOf = (whId: string): StockItem[] => {
    const rowByMaterial = new Map(
      (quants ?? []).filter(q => q.warehouseId === whId && q.materialId).map(q => [q.materialId, q]),
    )
    const groupNameById = new Map((groups ?? []).map(g => [String(g.id), g.name]))
    return (materials ?? [])
      .filter(m => m.warehouseId === whId)
      .map(m => {
        const row = rowByMaterial.get(String(m.id))
        return {
          materialId: m.id, code: m.code, name: m.name, unit: m.unit, spec: m.spec,
          groupName: m.materialGroupId ? (groupNameById.get(String(m.materialGroupId)) ?? '—') : '—',
          qty: row?.qty ?? 0,
          availableQty: row?.availableQty ?? 0,
        }
      })
  }

  const openWh = (warehouses ?? []).find(w => w.code === openId) ?? null
  // Kho ảo đối ứng cho "Sửa nhanh tồn kho" (bút toán ADJUST qua lại với kho ảo này) - xem
  // adjustStock() ở stock-api.ts và role-permissions.constant.ts (STOCK:UPDATE của Thủ kho).
  const openingBalanceWarehouseId = (warehouses ?? []).find(w => w.code === 'OPENING_BALANCE')?.id ?? null

  if (whLoading) return <div style={{ color: 'var(--text3)' }}>Đang tải...</div>
  if (whError)   return <div style={{ color: '#c62828' }}>Không tải được danh sách kho: {whError}</div>

  if (openWh) return (
    <WarehouseDetail
      wh={openWh}
      items={itemsOf(openWh.id)}
      canWrite={canWrite}
      isDeletable={isAdmin && !BASE_CODES.has(openWh.code)}
      openingBalanceWarehouseId={openingBalanceWarehouseId}
      warehouses={warehouses ?? []}
      allMaterials={materials ?? []}
      onBack={() => setOpenId(null)}
      onMaterialCreated={() => { void refetchMaterials(); void refetchQuants() }}
      onQtyAdjusted={() => { void refetchQuants() }}
      onWarehouseDeleted={() => { void refetchWarehouses(); setOpenId(null) }}
    />
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{group ? group.label : 'Tổng hợp kho'}</h2>
        {isAdmin && (
          <button onClick={() => setShowCreateForm(true)} style={btnPrimary}>
            <Plus size={14} /> Tạo kho mới
          </button>
        )}
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
        {group ? group.desc : 'Chọn kho để xem tồn & nhập/xuất'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
        {visibleWhs.map(wh => {
          const items = itemsOf(wh.id)
          return (
            <WhCard
              key={wh.code}
              wh={wh}
              itemCount={items.length}
              totalQty={items.reduce((s, it) => s + it.qty, 0)}
              onOpen={() => setOpenId(wh.code)}
            />
          )
        })}
      </div>

      {visibleWhs.length === 0 && (
        <div style={{ color: 'var(--text3)', marginTop: 12 }}>Nhóm này chưa có kho.</div>
      )}

      {showCreateForm && (
        <CreateWarehouseModal
          suggestedFamily={suggestedFamily}
          warehouses={warehouses ?? []}
          onClose={() => setShowCreateForm(false)}
          onDone={() => { setShowCreateForm(false); void refetchWarehouses() }}
        />
      )}
    </div>
  )
}

// ── Modal tạo kho mới (bất kỳ gia đình nào) + chọn người phụ trách (2026-09-03) ────────────────
// Tạo tài khoản là việc của trang Admin > Người dùng (đã có sẵn "Loại nhân viên = Kho" + dropdown
// "Kho phụ trách", không bắt buộc chọn ngay lúc tạo tài khoản) - modal này KHÔNG tạo tài khoản
// mới nữa (tránh trùng lặp logic tạo user ở 2 nơi, đúng chỗ đã lộ ra bug thiếu field username khi
// làm riêng lẻ), chỉ tạo Warehouse rồi cho chọn 1 tài khoản Kho có sẵn để gán warehouseScope -
// việc chọn cũng KHÔNG bắt buộc, giống hệt field "Kho phụ trách" ở form Thêm người dùng.
//
// Trước 2026-09-03 chỉ tạo được kho thuộc gia đình 'thanh-pham' (tên component cũ
// CreateThanhPhamModal) - nay tổng quát hoá cho cả 'phoi-son-han'/'vat-tu-tp' theo đúng cách kho
// thành phẩm phụ đã hoạt động (multi-instance thật, không chỉ đổi UI).

// 3 gia đình chọn được trong modal - loại bỏ entry 'all' của WAREHOUSE_GROUPS (không phải 1 gia
// đình thật, chỉ là lựa chọn hiển thị gộp).
const CREATABLE_FAMILIES = WAREHOUSE_GROUPS.filter((g): g is WhGroup & { key: WarehouseFamily } => g.key !== 'all')

function suggestedWhName(family: WarehouseFamily, warehouses: WhRow[]): string {
  const label = CREATABLE_FAMILIES.find(g => g.key === family)?.label ?? family
  const nextIndex = warehouses.filter(w => w.code === family || w.code.startsWith(`${family}-`)).length + 1
  return `${label} ${nextIndex}`
}

function CreateWarehouseModal({ suggestedFamily, warehouses, onClose, onDone }: {
  suggestedFamily: WarehouseFamily | null
  warehouses: WhRow[]
  onClose: () => void
  onDone: () => void
}) {
  // Gia đình đang tạo - suy sẵn từ nhóm Thủ kho đang xem (nếu có), Admin ở "Tổng hợp kho" thì
  // không suy được gì nên mặc định 'thanh-pham' (gia đình gốc/lâu đời nhất) và TỰ CHỌN LẠI qua
  // dropdown ngay trong form - không còn phụ thuộc phải "đang đứng đúng 1 nhóm" mới tạo được.
  const [family, setFamily] = useState<WarehouseFamily>(suggestedFamily ?? 'thanh-pham')
  const [whName, setWhName] = useState(() => suggestedWhName(family, warehouses))
  const [selectedUserId, setSelectedUserId] = useState('')
  const [err, setErr]       = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: users } = useFetch<UserRow[]>(getUsers)
  // Chỉ liệt kê thủ kho THẬT (Loại nhân viên = "Kho" ở UsersPage.tsx). role WAREHOUSE_STAFF ở
  // tầng RBAC chỉ có nghĩa "Nhân viên" nói chung - Sales/KHSX cũng mang role này (xem
  // deriveRoleIds() ở users-mapper.ts), KHÔNG đủ để coi là thủ kho một mình - phải loại thêm
  // isSale/isProductPlanner (nhóm Văn phòng), ngoài mfgRole (Phôi/Hàn/Sơn/KCS) và isPurchaser
  // (Mua hàng, mượn warehouseScope để lọc theo kho - xem comment isThanhPhamScope() ở
  // LenhSXPage.tsx), khớp đúng deriveStaffCategory() === 'warehouse' ở UsersPage.tsx.
  // 2026-09-03: chỉ liệt kê người CHƯA phụ trách kho nào (!u.warehouseScope) - mỗi tài khoản chỉ
  // phụ trách đúng 1 kho tại 1 thời điểm, nên "đổi thủ kho" thật ra là: gỡ khỏi kho cũ (đặt về
  // rỗng ở Admin > Người dùng, xem hasMfgAttrs() ở users-mapper.ts) rồi mới chọn lại được ở đây -
  // tránh Admin bấm nhầm rút người đang trực 1 kho khác sang kho mới mà không nhận ra.
  const candidates = (users ?? []).filter(u =>
    u.role === 'WAREHOUSE_STAFF' && u.isActive && !u.mfgRole && !u.isPurchaser && !u.isSale && !u.isProductPlanner && !u.warehouseScope,
  )
  const selectedUser = candidates.find(u => String(u.id) === selectedUserId) ?? null
  const selectedUserCurrentWh = selectedUser?.warehouseScope
    ? (warehouses.find(w => w.code === selectedUser.warehouseScope)?.name ?? selectedUser.warehouseScope)
    : null
  const groupLabel = CREATABLE_FAMILIES.find(g => g.key === family)?.label ?? family

  // Đổi gia đình → gợi ý lại tên kho mặc định theo đúng gia đình mới (đè tên cũ, cùng cách
  // EmployeeTypeField ở UsersPage.tsx dọn field khi đổi "Loại nhân viên").
  const onFamilyChange = (next: WarehouseFamily) => {
    setFamily(next)
    setWhName(suggestedWhName(next, warehouses))
  }

  const submit = async () => {
    if (!whName.trim()) { setErr('Tên kho bắt buộc'); return }
    setErr(null)
    setSaving(true)

    const code = `${family}-${Date.now()}`
    let newWh: { id: string } | null = null
    try {
      newWh = await createWarehouse({ code, name: whName, isVirtual: false, note: `Kho phụ - ${groupLabel}` })
      if (selectedUser) {
        // PATCH mfg-attributes là full-replace, không phải merge (xem mfgAttrsPayload() ở
        // users-mapper.ts) - phải gửi kèm nguyên trạng các cờ khác, chỉ đổi warehouseScope, nếu
        // không sẽ vô tình xoá mfgRole/isPurchaser/isProductPlanner/isSale hiện có của họ.
        await updateUser(selectedUser.id, {
          name: selectedUser.name,
          mfgRole: selectedUser.mfgRole,
          warehouseScope: code,
          isPurchaser: selectedUser.isPurchaser,
          isProductPlanner: selectedUser.isProductPlanner,
          isSale: selectedUser.isSale,
        })
      }
      onDone()
    } catch (e) {
      // Kho đã tạo nhưng gán người phụ trách lỗi - dọn lại kho vừa tạo thay vì để mồ côi, để
      // Admin sửa lại rồi bấm lại từ đầu.
      if (newWh) {
        try { await deleteWarehouse(newWh.id) } catch { /* best-effort, không che lỗi gốc */ }
      }
      setErr(e instanceof Error ? e.message : 'Không thể tạo kho/gán người phụ trách')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalCard}>
        <ModalHead title="Tạo kho mới" onClose={onClose} />
        <label style={lbl}>Loại kho *</label>
        <select value={family} onChange={e => onFamilyChange(e.target.value as WarehouseFamily)} style={inp}>
          {CREATABLE_FAMILIES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <label style={lbl}>Tên kho *</label>
        <input value={whName} onChange={e => setWhName(e.target.value)} style={inp} />

        <label style={lbl}>Thủ kho phụ trách</label>
        <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)} style={inp}>
          <option value="">— Chưa chọn, gán sau ở trang Người dùng —</option>
          {candidates.map(u => (
            <option key={u.id} value={String(u.id)}>{u.name} ({u.email})</option>
          ))}
        </select>
        {candidates.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
            Chưa có tài khoản Kho nào để chọn — tạo trước ở Admin &gt; Người dùng (Loại nhân viên = Kho), rồi quay lại đây gán.
          </div>
        )}
        {selectedUserCurrentWh && (
          <div style={{ fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
            Tài khoản này đang phụ trách <strong>{selectedUserCurrentWh}</strong> — gán vào kho mới sẽ <strong>chuyển họ khỏi kho hiện tại</strong> (1 tài khoản chỉ phụ trách được đúng 1 kho tại 1 thời điểm).
          </div>
        )}

        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Đang tạo...' : 'Tạo kho'}</button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Thẻ kho ───────────────────────────────────────────────────────────────────

function WhCard({ wh, itemCount, totalQty, onOpen }: { wh: WhRow; itemCount: number; totalQty: number; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left', cursor: 'pointer', padding: 16, borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        transition: 'box-shadow .1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Warehouse size={18} color="#e65100" />
        <span style={{ fontWeight: 700, fontSize: 15 }}>{wh.name}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{wh.note || '—'}</div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e65100', lineHeight: 1 }}>
            {itemCount} mặt hàng
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Tồn {totalQty.toLocaleString('vi-VN')}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Chi tiết kho ──────────────────────────────────────────────────────────────

function WarehouseDetail({ wh, items, canWrite, isDeletable, openingBalanceWarehouseId, warehouses, allMaterials, onBack, onMaterialCreated, onQtyAdjusted, onWarehouseDeleted }: {
  wh: WhRow
  items: StockItem[]
  canWrite: boolean
  isDeletable: boolean
  openingBalanceWarehouseId: string | null
  warehouses: WhRow[]
  allMaterials: MaterialRow[]
  onBack: () => void
  onMaterialCreated: () => void
  onQtyAdjusted: () => void
  onWarehouseDeleted: () => void
}) {
  const [tab, setTab]       = useState<'stock' | 'history'>('stock')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [copying, setCopying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Sửa nhanh tồn kho ngay trên bảng - đang sửa dòng nào (materialId) + giá trị đang gõ dở.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  // Vấn đề #25 audit 26/08 - chốt số xong KHÔNG gọi API ngay, mà chờ AdjustReasonModal thu lý do
  // thật (trước đây gửi thẳng note cố định) rồi mới ghi bút toán.
  const [pendingAdjust, setPendingAdjust] = useState<{ it: StockItem; newQty: number; delta: number } | null>(null)
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const { data: ledger } = useFetch<LedgerRow[]>(() => getStockLedger({ warehouseId: wh.id }), [wh.id])

  const filteredItems = items.filter(it =>
    !search || it.name.toLowerCase().includes(search.toLowerCase()) || it.code.toLowerCase().includes(search.toLowerCase()),
  )

  const startEdit = (it: StockItem) => {
    setEditingId(it.materialId)
    setEditValue(String(it.qty))
  }

  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const commitEdit = (it: StockItem) => {
    const newQty = Number(editValue)
    if (editValue === '' || Number.isNaN(newQty) || newQty < 0) { cancelEdit(); return }
    const delta = newQty - it.qty
    cancelEdit()
    if (delta === 0) return
    if (!openingBalanceWarehouseId) {
      alert('Chưa xác định được kho đối ứng để điều chỉnh tồn kho')
      return
    }
    setAdjustError(null)
    setPendingAdjust({ it, newQty, delta })
  }

  const confirmAdjust = async (reason: string) => {
    if (!pendingAdjust || !openingBalanceWarehouseId) return
    const { it, delta } = pendingAdjust
    setAdjustBusy(true)
    setAdjustError(null)
    try {
      await adjustStock({
        fromWarehouseId: delta > 0 ? openingBalanceWarehouseId : wh.id,
        toWarehouseId:   delta > 0 ? wh.id : openingBalanceWarehouseId,
        materialId: String(it.materialId),
        qty: Math.abs(delta),
        note: reason,
        expectedWarehouseId: String(wh.id),
        expectedCurrentQty: it.qty,
      })
      setPendingAdjust(null)
      onQtyAdjusted()
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : 'Không thể sửa tồn kho')
    } finally {
      setAdjustBusy(false)
    }
  }

  const cancelAdjust = () => {
    if (adjustBusy) return
    setPendingAdjust(null)
    setAdjustError(null)
  }

  const txns: Txn[] = (ledger ?? []).map(e => ({
    id: e.id,
    itemName: e.materialCode ?? '—',
    type: e.toWarehouseCode === wh.code ? 'IMPORT' : 'EXPORT',
    quantity: e.qty,
    note: e.note ?? (e.toWarehouseCode === wh.code ? `Nhận từ ${e.fromWarehouseCode}` : `Chuyển đến ${e.toWarehouseCode}`),
    date: e.createdAt,
  }))

  const handleDeleteWarehouse = async () => {
    if (!confirm(`Xóa kho "${wh.name}"?`)) return
    setDeleting(true)
    try {
      await deleteWarehouse(wh.id)
      onWarehouseDeleted()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thể xóa kho')
      setDeleting(false)
    }
  }

  const tabBtn = (id: 'stock' | 'history', label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: '8px 20px', fontSize: 13, fontWeight: tab === id ? 700 : 400,
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: tab === id ? '#e65100' : 'var(--text2)',
        borderBottom: tab === id ? '2px solid #e65100' : '2px solid transparent',
        marginBottom: -1,
      }}
    >{label}</button>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={btnGhost}><ArrowLeft size={16} /> Kho</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{wh.name}</h2>
        {tab === 'stock' && (
          <>
            <div style={{ flex: 1 }} />
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--text3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / mã…" style={{ ...inp, paddingLeft: 28, width: 200 }} />
            </div>
            {canWrite && <button onClick={() => setAdding(true)} style={btnPrimary}><Plus size={15} /> Thêm vật tư</button>}
            {canWrite && warehouses.some(w => w.id !== wh.id) && (
              <button onClick={() => setCopying(true)} style={btnGhost}><Copy size={14} /> Sao chép vật tư từ kho khác</button>
            )}
            {isDeletable && (
              <button onClick={handleDeleteWarehouse} disabled={deleting} style={{ ...btnGhost, color: '#dc2626', borderColor: '#fca5a5', opacity: deleting ? 0.6 : 1 }}>
                <Trash2 size={14} /> {deleting ? 'Đang xóa...' : 'Xóa kho'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {tabBtn('stock', 'Tồn kho')}
        {tabBtn('history', 'Lịch sử Nhập/Xuất')}
      </div>

      {/* Tồn kho */}
      {tab === 'stock' && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Mã vật tư</th>
                <th style={th}>Tên vật tư</th>
                <th style={th}>Nhóm vật tư</th>
                <th style={th}>Quy cách</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Tồn</th>
                <th style={{ ...th, textAlign: 'right' }}>Khả dụng</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => {
                const reserved = it.qty - it.availableQty
                return (
                <tr key={it.materialId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{it.code}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{it.name}</td>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{it.groupName}</td>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{it.spec || '—'}</td>
                  <td style={td}>{it.unit}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: it.qty <= 0 ? '#c62828' : 'var(--text)' }}>
                    {editingId === it.materialId ? (
                      <input
                        type="number" min={0} step="any" autoFocus
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onBlur={() => void commitEdit(it)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') void commitEdit(it)
                          else if (e.key === 'Escape') cancelEdit()
                        }}
                        style={{ width: 84, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    ) : canWrite ? (
                      <span onClick={() => startEdit(it)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text3)' }} title="Bấm để sửa">
                        {it.qty.toLocaleString('vi-VN')}
                      </span>
                    ) : (
                      it.qty.toLocaleString('vi-VN')
                    )}
                  </td>
                  <td
                    style={{ ...td, textAlign: 'right', fontWeight: 700, color: it.availableQty <= 0 ? '#c62828' : '#2563eb' }}
                    title={reserved > 0 ? `Đang giữ chỗ ${reserved.toLocaleString('vi-VN')} (cắt sắt/chuyển kho)` : undefined}
                  >
                    {it.availableQty.toLocaleString('vi-VN')}
                  </td>
                </tr>
                )
              })}
              {filteredItems.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
                  {items.length === 0 ? 'Kho chưa có vật tư.' : 'Không tìm thấy vật tư.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lịch sử */}
      {tab === 'history' && <WarehouseHistory txns={txns} />}

      {adding && (
        <AddMaterialModal
          warehouseId={wh.id}
          onClose={() => setAdding(false)}
          onDone={() => { setAdding(false); onMaterialCreated() }}
        />
      )}

      {copying && (
        <CopyMaterialsModal
          targetWarehouse={wh}
          warehouses={warehouses}
          allMaterials={allMaterials}
          onClose={() => setCopying(false)}
          onDone={() => { setCopying(false); onMaterialCreated() }}
        />
      )}

      {pendingAdjust && (
        <AdjustReasonModal
          open
          summary={`${pendingAdjust.it.name}: ${pendingAdjust.it.qty.toLocaleString('vi-VN')} → ${pendingAdjust.newQty.toLocaleString('vi-VN')} ${pendingAdjust.it.unit}`}
          busy={adjustBusy}
          error={adjustError}
          onConfirm={(reason) => void confirmAdjust(reason)}
          onCancel={cancelAdjust}
        />
      )}
    </div>
  )
}

// ── Lịch sử nhập/xuất ────────────────────────────────────────────────────────

interface Txn {
  id: string
  itemName: string
  type: 'IMPORT' | 'EXPORT'
  quantity: number
  note: string
  date: string
}

function WarehouseHistory({ txns }: { txns: Txn[] }) {
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IMPORT' | 'EXPORT'>('ALL')
  const [dateFrom,   setDateFrom]   = useState('')
  const [dateTo,     setDateTo]     = useState('')

  const filtered = [...txns].reverse().filter(t => {
    if (typeFilter !== 'ALL' && t.type !== typeFilter) return false
    if (dateFrom && t.date < dateFrom) return false
    if (dateTo   && t.date > dateTo + 'T23:59:59') return false
    return true
  })

  const TYPE_OPTIONS = [
    { value: 'ALL'    as const, label: 'Tất cả',   color: 'var(--text)',  bg: 'var(--surface2)' },
    { value: 'IMPORT' as const, label: 'Nhập kho', color: '#15803d',      bg: '#dcfce7'         },
    { value: 'EXPORT' as const, label: 'Xuất kho', color: '#c2410c',      bg: '#ffedd5'         },
  ]

  const hasFilter = typeFilter !== 'ALL' || dateFrom || dateTo

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
        padding: '10px 14px', background: 'var(--surface2)',
        border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {TYPE_OPTIONS.map(o => {
            const active = typeFilter === o.value
            return (
              <button key={o.value} onClick={() => setTypeFilter(o.value)} style={{
                padding: '4px 12px', fontSize: 12, fontWeight: active ? 700 : 500,
                borderRadius: 20, border: active ? 'none' : '1px solid var(--border)', cursor: 'pointer',
                background: active ? o.bg : 'var(--surface)', color: active ? o.color : 'var(--text2)',
                boxShadow: active ? `0 0 0 1.5px ${o.color}33` : 'none', transition: 'all .12s',
              }}>{o.label}</button>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasFilter && (
            <button onClick={() => { setTypeFilter('ALL'); setDateFrom(''); setDateTo('') }}
              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'red', cursor: 'pointer' }}>
              ✕ Xóa bộ lọc
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, whiteSpace: 'nowrap' }}>Từ ngày</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ ...inp, width: 136, padding: '5px 8px', fontSize: 12 }} />
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>đến</span>
          <input type="date" value={dateTo}   onChange={e => setDateTo(e.target.value)}   style={{ ...inp, width: 136, padding: '5px 8px', fontSize: 12 }} />
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>Ngày</th>
              <th style={th}>Vật tư</th>
              <th style={th}>Loại</th>
              <th style={{ ...th, textAlign: 'right' }}>SL</th>
              <th style={th}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                  {new Date(t.date).toLocaleDateString('vi-VN')}
                </td>
                <td style={td}>{t.itemName}</td>
                <td style={{ ...td, fontWeight: 600, color: t.type === 'IMPORT' ? '#2e7d32' : '#e65100' }}>
                  {t.type === 'IMPORT' ? 'Nhập' : 'Xuất'}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{t.quantity.toLocaleString('vi-VN')}</td>
                <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{t.note || '—'}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>
                {txns.length === 0 ? 'Chưa có giao dịch nào.' : 'Không có giao dịch khớp bộ lọc.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Modal thêm vật tư (tạo Material thật, gán warehouseId = kho đang xem) ──────

function AddMaterialModal({ warehouseId, onClose, onDone }: {
  warehouseId: string; onClose: () => void; onDone: () => void
}) {
  const [form, setForm] = useState({ code: '', name: '', unit: '', spec: '', openingQty: '' })
  const [err, setErr]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }))

  const submit = async () => {
    if (!form.name.trim()) { setErr('Tên vật tư bắt buộc'); return }
    if (!form.unit.trim()) { setErr('ĐVT bắt buộc'); return }
    setErr(null)
    setSaving(true)
    try {
      await createMaterial({
        code: form.code || undefined, name: form.name, unit: form.unit, spec: form.spec || undefined,
        warehouseId, openingQty: form.openingQty ? Number(form.openingQty) : undefined,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không thể thêm vật tư')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalCard}>
        <ModalHead title="Thêm vật tư" onClose={onClose} />
        <label style={lbl}>Mã vật tư</label>
        <input value={form.code} onChange={e => set('code', e.target.value)} style={inp} placeholder="Để trống sẽ tự sinh" />
        <label style={lbl}>Tên vật tư *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} />
        <label style={lbl}>ĐVT *</label>
        <input value={form.unit} onChange={e => set('unit', e.target.value)} style={inp} />
        <label style={lbl}>Quy cách</label>
        <input value={form.spec} onChange={e => set('spec', e.target.value)} style={inp} placeholder="VD: 10x29x0.8" />
        <label style={lbl}>Tồn kho ban đầu</label>
        <input type="number" min={0} value={form.openingQty} onChange={e => set('openingQty', e.target.value)} style={inp} placeholder="Số lượng đã có sẵn ở kho này (nếu có)" />
        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={saving} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>{saving ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Modal sao chép vật tư từ 1 kho khác (2026-09-03) ──────────────────────────
// Mã vật tư (Material.code) là DUY NHẤT TOÀN HỆ THỐNG (không phải riêng theo kho) - không thể giữ
// nguyên mã cũ khi sao chép sang kho khác, để trống cho BE tự sinh mã mới (đúng cơ chế "để trống
// tự sinh" đã có sẵn ở AddMaterialModal). Chỉ sao chép Tên/ĐVT/Quy cách/Nhóm vật tư - các field
// nâng cao khác (đơn vị mua hàng, hệ số quy đổi, % hao hụt, ảnh...) không có trong MaterialRow
// (view-model tối giản của trang này), Admin tự bổ sung lại ở Admin > Vật tư nếu cần sau khi sao
// chép. Tồn ban đầu do Admin tự nhập riêng cho TỪNG dòng - kho mới không có tồn vật lý thật nào
// tự động cả, không "sao chép" số dư ảo từ kho khác.

function CopyMaterialsModal({ targetWarehouse, warehouses, allMaterials, onClose, onDone }: {
  targetWarehouse: WhRow
  warehouses: WhRow[]
  allMaterials: MaterialRow[]
  onClose: () => void
  onDone: () => void
}) {
  const sourceOptions = warehouses.filter(w => w.id !== targetWarehouse.id)
  const [sourceId, setSourceId] = useState(sourceOptions[0]?.id ?? '')
  const sourceMaterials = allMaterials.filter(m => m.warehouseId === sourceId)

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(allMaterials.filter(m => m.warehouseId === sourceOptions[0]?.id).map(m => m.id)),
  )
  const [openingQtyById, setOpeningQtyById] = useState<Record<number, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Đổi kho nguồn → chọn lại từ đầu (mặc định chọn hết dòng của kho mới), xoá tồn đã nhập dở của
  // kho nguồn cũ (không còn ý nghĩa gì với danh sách vật tư mới).
  const onSourceChange = (id: string) => {
    setSourceId(id)
    setSelected(new Set(allMaterials.filter(m => m.warehouseId === id).map(m => m.id)))
    setOpeningQtyById({})
  }

  const toggleOne = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(prev =>
    prev.size === sourceMaterials.length ? new Set() : new Set(sourceMaterials.map(m => m.id)),
  )

  const submit = async () => {
    const toCopy = sourceMaterials.filter(m => selected.has(m.id))
    if (toCopy.length === 0) { setErr('Chọn ít nhất 1 vật tư để sao chép'); return }
    setErr(null)
    setSaving(true)
    setProgress({ done: 0, total: toCopy.length })

    // Tạo TUẦN TỰ từng dòng (không transaction gộp - BE tạo Material là API đơn lẻ) - lỗi ở 1
    // dòng KHÔNG chặn các dòng còn lại, báo lại đúng dòng nào lỗi ở cuối thay vì rollback hết
    // (đã tạo thành công thì giữ nguyên, tránh mất công của Admin đã chọn/nhập tồn cho các dòng
    // trước đó).
    const failed: { name: string; message: string }[] = []
    for (let i = 0; i < toCopy.length; i++) {
      const m = toCopy[i]
      try {
        await createMaterial({
          name: m.name,
          unit: m.unit,
          spec: m.spec || undefined,
          materialGroupId: m.materialGroupId ?? undefined,
          warehouseId: targetWarehouse.id,
          openingQty: Number(openingQtyById[m.id]) > 0 ? Number(openingQtyById[m.id]) : undefined,
        })
      } catch (e) {
        failed.push({ name: m.name, message: e instanceof Error ? e.message : 'Lỗi không rõ' })
      }
      setProgress({ done: i + 1, total: toCopy.length })
    }

    setSaving(false)
    // Luôn đóng + refetch dù có dòng lỗi - các dòng đã tạo thành công phải hiện ra ngay. alert()
    // TRƯỚC khi đóng để Admin chắc chắn đọc được đúng dòng nào lỗi (modal đóng thì mất setErr).
    if (failed.length > 0) {
      alert(`Đã sao chép ${toCopy.length - failed.length}/${toCopy.length} vật tư.\n\nLỗi:\n${failed.map(f => `- ${f.name}: ${f.message}`).join('\n')}`)
    }
    onDone()
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ ...modalCard, width: 620, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
        <ModalHead title={`Sao chép vật tư vào "${targetWarehouse.name}"`} onClose={onClose} />

        <label style={lbl}>Kho nguồn *</label>
        <select value={sourceId} onChange={e => onSourceChange(e.target.value)} style={inp}>
          {sourceOptions.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        {sourceMaterials.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 16 }}>Kho nguồn này chưa có vật tư nào.</div>
        ) : (
          <div style={{ marginTop: 12, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left', position: 'sticky', top: 0 }}>
                  <th style={{ ...th, width: 30 }}>
                    <input type="checkbox" checked={selected.size === sourceMaterials.length} onChange={toggleAll} />
                  </th>
                  <th style={th}>Tên vật tư</th>
                  <th style={th}>ĐVT</th>
                  <th style={{ ...th, width: 130 }}>Tồn ban đầu</th>
                </tr>
              </thead>
              <tbody>
                {sourceMaterials.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={td}><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} /></td>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>{m.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{m.code}{m.spec ? ` · ${m.spec}` : ''}</div>
                    </td>
                    <td style={{ ...td, color: 'var(--text3)' }}>{m.unit}</td>
                    <td style={td}>
                      <input
                        type="number" min={0} placeholder="0"
                        disabled={!selected.has(m.id)}
                        value={openingQtyById[m.id] ?? ''}
                        onChange={e => setOpeningQtyById(prev => ({ ...prev, [m.id]: e.target.value }))}
                        style={{ width: '100%', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {progress && saving && (
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8 }}>Đang tạo {progress.done}/{progress.total}...</div>
        )}
        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} disabled={saving} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={saving || sourceMaterials.length === 0} style={{ ...btnPrimary, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Đang sao chép...' : `Sao chép ${selected.size} vật tư đã chọn`}
          </button>
        </div>
      </div>
    </Overlay>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}
function ModalHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
      <button onClick={onClose} style={iconBtn}><X size={18} /></button>
    </div>
  )
}

const th: React.CSSProperties         = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties         = { padding: '8px 12px', color: 'var(--text)' }
const inp: React.CSSProperties        = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const lbl: React.CSSProperties        = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '10px 0 4px' }
const btnGhost: React.CSSProperties   = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: '#e65100', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const iconBtn: React.CSSProperties    = { padding: 5, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const modalCard: React.CSSProperties  = { width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.2)' }

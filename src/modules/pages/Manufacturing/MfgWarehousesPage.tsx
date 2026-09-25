'use client'
import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import {
  updateUser, getUsers, getWarehouses, createWarehouse, deleteWarehouse,
  getMaterials, createMaterial, getMaterialGroups, getStockQuants, adjustStock,
} from '../../../services/api'
import { Plus, Trash2, X, ArrowLeft, Warehouse, Search, Copy } from 'lucide-react'
import AdjustReasonModal from '../../../components/AdjustReasonModal'
import WarehouseLedgerHistory from '../../../components/WarehouseLedgerHistory'
import { warehouseFamilyOf, type WarehouseFamily } from '../../../utils/warehouseFamily'
import { useIsMobile } from '../../../hooks/useMediaQuery'
export { isThanhPhamScope } from '../../../utils/warehouseFamily'

// ── Types (view-model tối giản, khớp field thật cần dùng - xem warehouses-api.ts/
//    materials-api.ts/stock-api.ts cho hợp đồng đầy đủ) ─────────────────────────

interface WhRow {
  id: string
  code: string
  name: string
  note: string | null
  isVirtual: boolean
}
interface MaterialRow {
  id: number
  code: string
  name: string
  unit: string
  spec: string | null
  materialGroupId: number | null
  /** Sơn/Phụ kiện/Bao bì - BE bắt buộc với nhóm "Vật tư khác", PHẢI mang theo khi sao chép. */
  detailKind: 'PAINT' | 'ACCESSORY' | 'PACKAGING' | null
  warehouseId: string | null
  warehouseCode: string | null
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
  /** Chiều dài cây (mm) với sắt bán theo chiều dài, 0 cho loại khác - cùng mã sắt khác chiều dài
   *  là 2 lô tồn RIÊNG (unique index warehouseId+materialId+stockLengthMm). */
  stockLengthMm: number
  qty: number
  /** Vấn đề #13 audit 26/08 - tồn còn dùng được (đã trừ phần giữ chỗ cắt sắt/chuyển kho), BE tính
   *  sẵn qua getAvailableQty() dùng chung với màn Xuất sắt - xem stock-api.ts. */
  availableQty: number
}
export interface StockItem {
  materialId: number
  code: string
  name: string
  unit: string
  spec: string | null
  groupName: string
  /** null = vật tư này chưa có dòng stock_quant nào ở kho đang xem (chưa phát sinh giao dịch) -
   *  hiện "—" ở cột Chiều dài. 0 = có phát sinh nhưng chưa gán chiều dài cụ thể (vật tư không bán
   *  theo chiều dài, hoặc dữ liệu cũ trước khi có tính năng này) - CŨNG hiện "—" vì 0 không phải 1
   *  chiều dài vật lý thật. >0 = chiều dài cây thật (mm). 1 vật tư Sắt có thể sinh NHIỀU StockItem
   *  (1 dòng/bucket) khi tồn ở nhiều chiều dài khác nhau cùng lúc - xem itemsOf(). */
  stockLengthMm: number | null
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
  // "Thêm vật tư"/"Sửa nhanh tồn kho" ở màn Quản lý kho CHỈ dành cho Admin (2026-09-14, theo yêu
  // cầu trực tiếp) - trước đây gán cho Thủ kho (WAREHOUSE_STAFF && !mfgRole) nhưng phát hiện qua
  // test tay: KHÔNG có tài khoản Thủ kho thật nào điều hướng tới được màn này (tab "Tổng hợp kho"
  // bị lọc ẩn khỏi sidebar của mọi thủ kho theo từng kho riêng ở InboundWarehouseApp.tsx), khiến
  // toàn bộ nhánh sửa trước đây thực chất không ai dùng được. BE không chặn Admin (STOCK:UPDATE +
  // MATERIAL:CREATE có sẵn trong permissions của role ADMIN, warehouseScope=null bỏ qua kiểm tra
  // phạm vi kho ở StockLedgerService.assertScopeTouchesWarehouses()).
  const canWrite = user?.role === 'ADMIN'
  const isAdmin  = user?.role === 'ADMIN'

  const { data: warehouses, isLoading: whLoading, error: whError, refetch: refetchWarehouses } = useFetch<WhRow[]>(getWarehouses)
  const { data: materials, refetch: refetchMaterials } = useFetch<MaterialRow[]>(getMaterials)
  const { data: groups } = useFetch<GroupRow[]>(getMaterialGroups)
  const { data: quants, refetch: refetchQuants } = useFetch<QuantRow[]>(() => getStockQuants())

  const [openId, setOpenId]                 = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const group = groupKey ? WAREHOUSE_GROUPS.find(g => g.key === groupKey) : null

  // Lọc theo groupKey (khớp code trực tiếp thay vì regex tên)
  const visibleWhs = (
    (groupKey && groupKey !== 'all')
      ? (warehouses ?? []).filter(w => w.code === groupKey || w.code.startsWith(groupKey + '-'))
      : (warehouses ?? [])
  )
    // Kho ẢO (SUPPLIER/PRODUCTION/SCRAP/OPENING_BALANCE) chỉ Admin thấy (2026-09-12, theo yêu cầu
    // người dùng) - Boss/QLSX/KHSX vào "Tổng hợp kho" (groupKey=undefined, thấy cả 7 kho) không
    // cần biết tới các điểm đối ứng bút toán kỹ thuật này, dễ gây hỏi "sao lại có kho không tồn
    // vật lý". Thủ kho (groupKey=scope riêng) vốn đã không thấy kho ảo từ trước do lọc theo code ở
    // trên (SUPPLIER/PRODUCTION/SCRAP/OPENING_BALANCE không khớp bất kỳ family nào) - không đổi gì.
    .filter(w => isAdmin || !w.isVirtual)

  // Gia đình gợi ý sẵn khi mở form tạo kho - suy từ nhóm đang xem (nếu có, vd Thủ kho vào đúng tab
  // "Kho phôi sơn hàn"); về null khi xem "Tổng hợp kho" (Admin > Quản lý kho không có khái niệm
  // nhóm - luôn hiện gộp cả 7 kho, KHÔNG suy ra được gia đình nào) - modal tự hỏi lại bằng dropdown
  // riêng trong trường hợp đó (2026-09-03: bản đầu lỡ chỉ hiện nút khi có sẵn gia đình, khiến nút
  // biến mất hoàn toàn trên trang Admin > Quản lý kho - phát hiện qua test tay thật).
  const suggestedFamily: WarehouseFamily | null = group ? warehouseFamilyOf(group.key) : null

  // Tách theo TỪNG BUCKET chiều dài (KHÔNG gộp 1 dòng/vật tư như bản cũ) - 1 vật tư Sắt có thể có
  // nhiều dòng stock_quant cho ĐÚNG 1 cặp (kho, vật tư) khi tồn ở nhiều chiều dài khác nhau (cây
  // 6m/4m là 2 lô RIÊNG). Bản cũ lấy 1 dòng đại diện qua Map khoá theo materialId - đúng ngẫu
  // nhiên khi 1 bucket = 0 (bug thật, xem MaterialsPage.tsx/VatTuDashboardPage.tsx cùng lỗi đã
  // sửa 14/09/2026), sai thật khi cả 2 bucket đều dương. Chỉ sinh dòng cho bucket CÒN PHÁT SINH
  // (qty !== 0) - bucket 0 chết (di tích trước khi có tính năng chiều dài) không cần hiện; vật tư
  // hoàn toàn chưa có giao dịch nào thì fallback 1 dòng qty=0/stockLengthMm=null (giữ hành vi cũ).
  //
  // Danh mục vật tư của 1 kho - CÙNG quy tắc với trang thủ kho "Tổng hợp vật tư"
  // (materialsInScope ở VatTuDashboardPage.tsx), trước 2026-09-25 chỉ lọc m.warehouseId === whId
  // khiến kho phụ (vd "Kho thành phẩm 2") hiện "0 mặt hàng" ở Admin/KHSX trong khi thủ kho của
  // chính kho đó thấy đủ danh mục của họ - Admin tưởng kho trống rồi bấm "Sao chép" tạo mã trùng.
  // = HỢP của (a) vật tư cùng HỌ kho (luôn hiện, kể cả tồn 0) và (b) vật tư họ khác đang CÒN TỒN
  // THẬT (> 0) tại đúng kho này (hàng đã chuyển tới qua chuyển kho nội bộ). Kho không thuộc họ nào
  // (kho ảo) giữ cách so khớp đúng warehouseId như cũ.
  const itemsOf = (wh: WhRow): StockItem[] => {
    const whId = wh.id
    const rowsByMaterial = new Map<string, QuantRow[]>()
    for (const q of quants ?? []) {
      if (q.warehouseId !== whId || !q.materialId) continue
      const arr = rowsByMaterial.get(q.materialId)
      if (arr) arr.push(q); else rowsByMaterial.set(q.materialId, [q])
    }
    const family = warehouseFamilyOf(wh.code)
    const inCatalog = (m: MaterialRow) => family
      ? warehouseFamilyOf(m.warehouseCode) === family
      : m.warehouseId === whId
    const hasStockHere = (m: MaterialRow) =>
      (rowsByMaterial.get(String(m.id)) ?? []).reduce((s, r) => s + r.qty, 0) > 0
    const groupNameById = new Map((groups ?? []).map(g => [String(g.id), g.name]))
    const result: StockItem[] = []
    for (const m of (materials ?? []).filter(m => inCatalog(m) || hasStockHere(m))) {
      const base = {
        materialId: m.id, code: m.code, name: m.name, unit: m.unit, spec: m.spec,
        groupName: m.materialGroupId ? (groupNameById.get(String(m.materialGroupId)) ?? '—') : '—',
      }
      const buckets = (rowsByMaterial.get(String(m.id)) ?? []).filter(r => r.qty !== 0)
      if (buckets.length === 0) {
        result.push({ ...base, stockLengthMm: null, qty: 0, availableQty: 0 })
      } else {
        for (const r of buckets) {
          result.push({ ...base, stockLengthMm: r.stockLengthMm || null, qty: r.qty, availableQty: r.availableQty })
        }
      }
    }
    return result
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
      items={itemsOf(openWh)}
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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(240px,100%),1fr))', gap: 14 }}>
        {visibleWhs.map(wh => {
          const items = itemsOf(wh)
          return (
            <WhCard
              key={wh.code}
              wh={wh}
              // items.length đếm theo DÒNG (1 vật tư có thể ra nhiều dòng nếu nhiều bucket chiều
              // dài) - đếm distinct materialId mới đúng "số mặt hàng" thật.
              itemCount={new Set(items.map(it => it.materialId)).size}
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
        // role bắt buộc phải gửi kèm - hasMfgAttrs() ở users-mapper.ts xét đúng field này để
        // quyết định có gọi PATCH mfg-attributes hay không (2026-09-04: thiếu field này khiến
        // gán thủ kho lúc tạo kho ở đây âm thầm không có tác dụng, phát hiện qua test tay).
        await updateUser(selectedUser.id, {
          name: selectedUser.name,
          role: selectedUser.role,
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
  // Cột "Chiều dài" CHỈ có ý nghĩa ở họ kho phôi-sơn-hàn (nơi vật tư Sắt bán theo chiều dài cây
  // "sống" - các họ kho khác không có vật tư Sắt nào) - ẩn ở Vật tư TP/Thành phẩm để đỡ rối, dù
  // itemsOf() vẫn tách đúng theo bucket cho MỌI kho (tránh tái phát bug "lấy 1 dòng thay vì cộng
  // dồn" - chỉ khác là không cần LỘ RA cột riêng ở những kho không có vật tư đa-bucket).
  const showLengthColumn = warehouseFamilyOf(wh.code) === 'phoi-son-han'
  const [tab, setTab]       = useState<'stock' | 'history'>('stock')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [copying, setCopying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Sửa nhanh tồn kho ngay trên bảng - đang sửa dòng nào + giá trị đang gõ dở. Khoá theo
  // rowKey() (materialId + stockLengthMm), KHÔNG chỉ materialId - 1 vật tư có thể ra NHIỀU dòng
  // (nhiều bucket chiều dài), khoá đơn theo materialId sẽ khiến bấm sửa 1 dòng vô tình mở luôn ô
  // sửa ở dòng kia của cùng vật tư (2 dòng cùng khớp editingId).
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  // Vấn đề #25 audit 26/08 - chốt số xong KHÔNG gọi API ngay, mà chờ AdjustReasonModal thu lý do
  // thật (trước đây gửi thẳng note cố định) rồi mới ghi bút toán.
  const [pendingAdjust, setPendingAdjust] = useState<{ it: StockItem; newQty: number; delta: number } | null>(null)
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)
  // Điện thoại: bảng tồn 7-8 cột đổi thành thẻ (ô Tồn vẫn bấm sửa được như trên bảng).
  const isMobile = useIsMobile()

  const filteredItems = items.filter(it =>
    !search || it.name.toLowerCase().includes(search.toLowerCase()) || it.code.toLowerCase().includes(search.toLowerCase()),
  )

  const rowKey = (it: StockItem) => `${it.materialId}:${it.stockLengthMm ?? 'none'}`

  const startEdit = (it: StockItem) => {
    setEditingKey(rowKey(it))
    setEditValue(String(it.qty))
  }

  const cancelEdit = () => { setEditingKey(null); setEditValue('') }

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
        // Dòng đã có chiều dài cụ thể (đang tách theo bucket) -> sửa ĐÚNG bucket đó. Dòng "—"
        // (chưa từng phát sinh hoặc vật tư không bán theo chiều dài) -> bỏ trống, BE ghi vào
        // bucket chung (0) - đúng hành vi cũ.
        stockLengthMm: it.stockLengthMm ?? undefined,
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

  // Ô Tồn: Admin bấm để sửa nhanh (ô nhập tại chỗ), người khác chỉ xem - dùng chung bảng và thẻ.
  const qtyCell = (it: StockItem) => editingKey === rowKey(it) ? (
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
  )

  const tabBtn = (id: 'stock' | 'history', label: string) => (
    <button
      onClick={() => setTab(id)}
      style={{
        padding: isMobile ? '8px 14px' : '8px 20px', fontSize: 13, fontWeight: tab === id ? 700 : 400, whiteSpace: 'nowrap',
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
            <div style={{ position: 'relative', width: isMobile ? '100%' : undefined }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--text3)' }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm tên / mã…" style={{ ...inp, paddingLeft: 28, width: isMobile ? '100%' : 200 }} />
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
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 16, overflowX: 'auto' }}>
        {tabBtn('stock', 'Tồn kho')}
        {tabBtn('history', 'Lịch sử Nhập/Xuất')}
      </div>

      {/* Tồn kho */}
      {tab === 'stock' && isMobile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredItems.map(it => (
            <div key={rowKey(it)} className="card" style={{ padding: '11px 13px' }}>
              <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{it.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, wordBreak: 'break-word' }}>
                {[it.code, it.groupName !== '—' ? it.groupName : null, it.spec, showLengthColumn && it.stockLengthMm ? `${it.stockLengthMm.toLocaleString('vi-VN')} mm` : null].filter(Boolean).join(' · ')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 16, marginTop: 8, fontSize: 13 }}>
                <span><span style={{ color: 'var(--text3)', fontSize: 11 }}>Tồn </span><b style={{ color: it.qty <= 0 ? '#c62828' : 'var(--text)' }}>{qtyCell(it)}</b> <span style={{ color: 'var(--text3)', fontSize: 11 }}>{it.unit}</span></span>
                <span><span style={{ color: 'var(--text3)', fontSize: 11 }}>Khả dụng </span><b style={{ color: it.availableQty <= 0 ? '#c62828' : '#2563eb' }}>{it.availableQty.toLocaleString('vi-VN')}</b></span>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>
              {items.length === 0 ? 'Kho chưa có vật tư.' : 'Không tìm thấy vật tư.'}
            </div>
          )}
        </div>
      )}
      {tab === 'stock' && !isMobile && (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={th}>Mã vật tư</th>
                <th style={th}>Tên vật tư</th>
                <th style={th}>Nhóm vật tư</th>
                <th style={th}>Quy cách</th>
                <th style={th}>ĐVT</th>
                {showLengthColumn && <th style={th}>Chiều dài</th>}
                <th style={{ ...th, textAlign: 'right' }}>Tồn</th>
                <th style={{ ...th, textAlign: 'right' }}>Khả dụng</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => {
                const reserved = it.qty - it.availableQty
                return (
                <tr key={rowKey(it)} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{it.code}</td>
                  <td style={{ ...td, fontWeight: 500 }}>{it.name}</td>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{it.groupName}</td>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>{it.spec || '—'}</td>
                  <td style={td}>{it.unit}</td>
                  {showLengthColumn && (
                    <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>
                      {it.stockLengthMm ? `${it.stockLengthMm.toLocaleString('vi-VN')} mm` : '—'}
                    </td>
                  )}
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: it.qty <= 0 ? '#c62828' : 'var(--text)' }}>
                    {qtyCell(it)}
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
                <tr><td colSpan={showLengthColumn ? 8 : 7} style={{ ...td, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
                  {items.length === 0 ? 'Kho chưa có vật tư.' : 'Không tìm thấy vật tư.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lịch sử - 2026-09-12 dùng chung component sổ kho với phân hệ Kho đầu vào (tab "Lịch sử
          kho"). Bảng cũ chỉ 5 cột rút gọn: mất loại đối ứng/người thực hiện/ĐVT, và chỉ hiện được
          dòng vật tư (đoạn sắt/mảnh/thành phẩm đều ra "—"). */}
      {tab === 'history' && <WarehouseLedgerHistory warehouseId={String(wh.id)} warehouseCode={wh.code} />}

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
          targetItems={items}
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
// tự sinh" đã có sẵn ở AddMaterialModal). Chỉ sao chép Tên/ĐVT/Quy cách/Nhóm vật tư/Phân loại
// (detailKind - BE bắt buộc với nhóm "Vật tư khác", thiếu nó mọi dòng nhóm này đều lỗi 400, sửa
// 2026-09-25) - các field
// nâng cao khác (đơn vị mua hàng, hệ số quy đổi, % hao hụt, ảnh...) không có trong MaterialRow
// (view-model tối giản của trang này), Admin tự bổ sung lại ở Admin > Vật tư nếu cần sau khi sao
// chép. Tồn ban đầu do Admin tự nhập riêng cho TỪNG dòng - kho mới không có tồn vật lý thật nào
// tự động cả, không "sao chép" số dư ảo từ kho khác.

// "Đã có" ở kho đích (2026-09-25) - tránh bấm "Sao chép" tạo bản trùng. 1 vật tư nguồn coi là đã
// có khi kho đích ĐÃ THẤY đúng vật tư đó (cùng họ kho -> danh mục dùng chung, xem itemsOf()),
// HOẶC kho đích có 1 vật tư khác cùng Tên + Quy cách + ĐVT (bản đã chép từ lần trước - mã mới
// nên không khớp theo id được). Chỉ BỎ TÍCH MẶC ĐỊNH, không khoá - Admin vẫn tích lại được nếu
// cố ý muốn tách mã riêng.
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const sameItemKey = (x: { name: string; spec: string | null; unit: string }) =>
  `${norm(x.name)}|${norm(x.spec)}|${norm(x.unit)}`

function CopyMaterialsModal({ targetWarehouse, targetItems, warehouses, allMaterials, onClose, onDone }: {
  targetWarehouse: WhRow
  /** Danh mục kho đích ĐANG thấy (itemsOf) - để đánh dấu "Đã có". */
  targetItems: StockItem[]
  warehouses: WhRow[]
  allMaterials: MaterialRow[]
  onClose: () => void
  onDone: () => void
}) {
  const sourceOptions = warehouses.filter(w => w.id !== targetWarehouse.id)
  const [sourceId, setSourceId] = useState(sourceOptions[0]?.id ?? '')
  const materialsOfSource = (id: string) => allMaterials.filter(m => m.warehouseId === id)
  const sourceMaterials = materialsOfSource(sourceId)

  const targetIds = new Set(targetItems.map(it => String(it.materialId)))
  const targetKeys = new Set(targetItems.map(sameItemKey))
  const isExisting = (m: MaterialRow) => targetIds.has(String(m.id)) || targetKeys.has(sameItemKey(m))
  const newIdsOf = (list: MaterialRow[]) => list.filter(m => !isExisting(m)).map(m => m.id)
  const newIds = newIdsOf(sourceMaterials)
  const existingCount = sourceMaterials.length - newIds.length

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(newIdsOf(materialsOfSource(sourceOptions[0]?.id ?? ''))),
  )
  const [openingQtyById, setOpeningQtyById] = useState<Record<number, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  // Đổi kho nguồn → chọn lại từ đầu (mặc định chọn các dòng CHƯA có ở kho đích), xoá tồn đã nhập
  // dở của kho nguồn cũ (không còn ý nghĩa gì với danh sách vật tư mới).
  const onSourceChange = (id: string) => {
    setSourceId(id)
    setSelected(new Set(newIdsOf(materialsOfSource(id))))
    setOpeningQtyById({})
  }

  const toggleOne = (id: number) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  // Ô "chọn tất cả" chỉ bật/tắt các dòng MỚI - không kéo theo dòng "Đã có" (muốn chép trùng thì
  // phải tích tay từng dòng, có chủ ý).
  const allNewSelected = newIds.length > 0 && newIds.every(id => selected.has(id))
  const toggleAll = () => setSelected(prev => {
    const next = new Set(prev)
    if (allNewSelected) newIds.forEach(id => next.delete(id)); else newIds.forEach(id => next.add(id))
    return next
  })

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
          detailKind: m.detailKind ?? undefined,
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

        {existingCount > 0 && (
          <div style={{ fontSize: 12.5, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginTop: 8 }}>
            {newIds.length === 0
              ? <>Tất cả {existingCount} vật tư của kho này <strong>đã có ở {targetWarehouse.name}</strong>, không cần sao chép.</>
              : <><strong>{existingCount}</strong> vật tư đã có ở {targetWarehouse.name} (nhãn &quot;Đã có&quot;) nên đã được bỏ tích. Chỉ <strong>{newIds.length}</strong> vật tư mới được chọn sẵn.</>}
            {' '}Tích lại dòng &quot;Đã có&quot; sẽ tạo vật tư trùng tên với mã mới.
          </div>
        )}

        {sourceMaterials.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 16 }}>Kho nguồn này chưa có vật tư nào.</div>
        ) : (
          <div style={{ marginTop: 12, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left', position: 'sticky', top: 0 }}>
                  <th style={{ ...th, width: 30 }}>
                    <input type="checkbox" checked={allNewSelected} disabled={newIds.length === 0} onChange={toggleAll} title="Chọn/bỏ chọn các vật tư mới" />
                  </th>
                  <th style={th}>Tên vật tư</th>
                  <th style={th}>ĐVT</th>
                  <th style={{ ...th, width: 130 }}>Tồn ban đầu</th>
                </tr>
              </thead>
              <tbody>
                {sourceMaterials.map(m => (
                  <tr key={m.id} style={{ borderTop: '1px solid var(--border)', opacity: isExisting(m) && !selected.has(m.id) ? 0.6 : 1 }}>
                    <td style={td}><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} /></td>
                    <td style={td}>
                      <div style={{ fontWeight: 500 }}>
                        {m.name}
                        {isExisting(m) && (
                          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 600, color: '#15803d', background: '#dcfce7', borderRadius: 4, padding: '1px 6px' }}>Đã có</span>
                        )}
                      </div>
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
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>
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
const modalCard: React.CSSProperties  = { width: 420, maxWidth: '100%', maxHeight: '90dvh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.2)' }


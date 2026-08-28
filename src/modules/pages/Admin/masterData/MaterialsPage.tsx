'use client'
import { useState } from 'react'
import { Package } from 'lucide-react'
import { useFetch } from '../../../../hooks/useFetch'
import { useAuditLog } from '../../../../context/AuditLogContext'
import { getMaterials, createMaterial, updateMaterial, deleteMaterial, getMaterialGroups, getWarehouses, getUsers, getStockQuants, adjustStock } from '../../../../services/api'
import { MATERIAL_GROUP_SYSTEM_KEYS } from '../../../../constants/materialGroupSystemKeys'
import AdminEntityPage, { type AdminEntityConfig } from '../shared/AdminEntityPage'
import AdjustReasonModal from '../../../../components/AdjustReasonModal'

interface Material {
  id: number
  code: string
  name: string
  unit: string
  spec?: string | null
  materialGroupId?: number | null
  detailKind?: 'PAINT' | 'ACCESSORY' | 'PACKAGING' | null
  warehouseId?: string | null
  buyerId?: string | null
  purchaseUnit?: string | null
  khoUnitFactor?: number | null
  /** CHỈ có ý nghĩa với vật tư nhóm Sắt - ngưỡng hao hụt tối đa khi cắt, gửi xuống solver cắt
   *  sắt. null với mọi nhóm khác - xem MaterialsService.resolveWasteFields (BE). */
  maxCuttingWastePercentage?: number | null
  /** CHỈ có ý nghĩa với vật tư KHÔNG thuộc nhóm Sắt - % dự trù cộng thêm vào số lượng đề xuất
   *  mua (chưa nối vào luồng đề xuất mua nào). null với vật tư Sắt. */
  purchaseWastePercentage?: number | null
  imageUrl?: string | null
  /** Chỉ dùng lúc TẠO MỚI (ghi 1 bút toán OPENING_BALANCE vào StockLedger) - không phải cột
   *  thật trên Material nên không hiện ở bảng, và bị bỏ qua khi sửa vật tư (xem BE update()). */
  openingQty?: number
}

interface MaterialGroup {
  id: number
  name: string
  systemKey: string | null
}

const DETAIL_KIND_OPTIONS = [
  { value: 'PAINT', label: 'Sơn' },
  { value: 'ACCESSORY', label: 'Phụ kiện' },
  { value: 'PACKAGING', label: 'Bao bì' },
]
const DETAIL_KIND_LABEL: Record<string, string> = { PAINT: 'Sơn', ACCESSORY: 'Phụ kiện', PACKAGING: 'Bao bì' }

interface Warehouse {
  id: string
  code: string
  name: string
  isVirtual: boolean
}

interface Purchaser {
  id: number
  name: string
  isPurchaser?: boolean
}

interface QuantRow {
  materialId: string | null
  warehouseId: string
  qty: number
  /** Vấn đề #13 audit 26/08 - tồn còn dùng được (đã trừ phần giữ chỗ cắt sắt/chuyển kho), BE tính
   *  sẵn qua getAvailableQty() dùng chung với màn Xuất sắt - xem stock-api.ts. */
  availableQty: number
}

export default function MaterialsPage() {
  const { logAction } = useAuditLog()
  const { data: groups } = useFetch<MaterialGroup[]>(getMaterialGroups)
  const groupList = groups ?? []
  const groupName = (id?: number | null) => groupList.find((g) => g.id === id)?.name ?? '—'
  // Sơn/Phụ kiện/Bao bì (trang Định mức chi tiết) dùng chung nhóm "Vật tư khác" (systemKey
  // OTHER) - field "Phân loại" chỉ hiện/bắt buộc khi đang chọn đúng nhóm này (xem
  // MaterialsService.resolveDetailKind bên BE cho ràng buộc tương ứng).
  const otherGroupId = groupList.find((g) => g.systemKey === MATERIAL_GROUP_SYSTEM_KEYS.OTHER)?.id
  const isOtherGroup = (v: Partial<Material>) => otherGroupId != null && String(v.materialGroupId) === String(otherGroupId)
  // % hao hụt mang 2 nghĩa ngược chiều tuỳ nhóm (xem comment field ở Material interface) - field
  // nào hiện phụ thuộc đúng nhóm đang chọn, mirror cách isOtherGroup làm cho detailKind ở trên.
  const steelGroupId = groupList.find((g) => g.systemKey === MATERIAL_GROUP_SYSTEM_KEYS.STEEL_BAR)?.id
  const isSteelGroup = (v: Partial<Material>) => steelGroupId != null && String(v.materialGroupId) === String(steelGroupId)
  const { data: warehouses } = useFetch<Warehouse[]>(getWarehouses)
  const warehouseList = warehouses ?? []
  const warehouseName = (id?: string | null) => warehouseList.find((w) => w.id === id)?.name ?? '—'
  // Kho ảo (SUPPLIER/PRODUCTION/SCRAP/OPENING_BALANCE...) chỉ là điểm đối ứng cho bút toán kho,
  // không phải nơi vật tư thật sự nằm - loại khỏi dropdown chọn Kho để tránh gán nhầm.
  const realWarehouseOptions = warehouseList.filter((w) => !w.isVirtual)
  // Kho ảo đối ứng cho "Sửa nhanh tồn kho" (bút toán ADJUST qua lại với kho ảo này) - xem
  // adjustStock() ở stock-api.ts và role-permissions.constant.ts (STOCK:UPDATE - ADMIN có sẵn
  // full quyền qua seed, không cần cấp riêng).
  const openingBalanceWarehouseId = warehouseList.find((w) => w.code === 'OPENING_BALANCE')?.id ?? null
  const { data: users } = useFetch<Purchaser[]>(getUsers)
  const buyerList = (users ?? []).filter((u) => u.isPurchaser)
  const buyerName = (id?: string | null) => buyerList.find((u) => String(u.id) === id)?.name ?? '—'

  const { data: quants, refetch: refetchQuants } = useFetch<QuantRow[]>(getStockQuants)
  const quantByMaterialId = new Map(
    (quants ?? []).filter((q) => q.materialId).map((q) => [`${q.materialId}:${q.warehouseId}`, q]),
  )
  const stockQtyOf = (m: Material): number | null =>
    m.warehouseId ? quantByMaterialId.get(`${m.id}:${m.warehouseId}`)?.qty ?? 0 : null
  const availableQtyOf = (m: Material): number | null =>
    m.warehouseId ? quantByMaterialId.get(`${m.id}:${m.warehouseId}`)?.availableQty ?? 0 : null

  // Sửa nhanh tồn kho ngay trên bảng - đang sửa dòng nào (materialId) + giá trị đang gõ dở.
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  // Vấn đề #25 audit 26/08 - chốt số xong KHÔNG gọi API ngay, mà chờ AdjustReasonModal thu lý do
  // thật (trước đây gửi thẳng note cố định) rồi mới ghi bút toán.
  const [pendingAdjust, setPendingAdjust] = useState<{ m: Material; currentQty: number; newQty: number; delta: number } | null>(null)
  const [adjustBusy, setAdjustBusy] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const startEdit = (m: Material, currentQty: number) => {
    setEditingId(m.id)
    setEditValue(String(currentQty))
  }

  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const commitEdit = (m: Material, currentQty: number) => {
    const newQty = Number(editValue)
    if (editValue === '' || Number.isNaN(newQty) || newQty < 0) { cancelEdit(); return }
    const delta = newQty - currentQty
    cancelEdit()
    if (delta === 0) return
    if (!m.warehouseId || !openingBalanceWarehouseId) {
      alert('Chưa xác định được kho để điều chỉnh tồn kho')
      return
    }
    setAdjustError(null)
    setPendingAdjust({ m, currentQty, newQty, delta })
  }

  const confirmAdjust = async (reason: string) => {
    if (!pendingAdjust || !openingBalanceWarehouseId) return
    const { m, currentQty, delta } = pendingAdjust
    if (!m.warehouseId) return
    setAdjustBusy(true)
    setAdjustError(null)
    try {
      await adjustStock({
        fromWarehouseId: delta > 0 ? openingBalanceWarehouseId : m.warehouseId,
        toWarehouseId:   delta > 0 ? m.warehouseId : openingBalanceWarehouseId,
        materialId: String(m.id),
        qty: Math.abs(delta),
        note: reason,
        expectedWarehouseId: String(m.warehouseId),
        expectedCurrentQty: currentQty,
      })
      setPendingAdjust(null)
      void refetchQuants()
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

  const config: AdminEntityConfig<Material> = {
    title: 'Vật tư',
    icon: <Package size={18} color="#3949ab" />,
    searchFields: ['code', 'name'],
    searchPlaceholder: 'Tìm theo mã hoặc tên vật tư...',
    emptyMessage: 'Chưa có vật tư nào',
    addLabel: 'Thêm vật tư',
    pageSize: 10,
    columns: [
      { key: 'code', label: 'Mã vật tư' },
      { key: 'name', label: 'Tên vật tư' },
      { key: 'unit', label: 'Đơn vị' },
      { key: 'purchaseUnit', label: 'Đơn vị mua', render: (m) => m.purchaseUnit || '—' },
      { key: 'spec', label: 'Quy cách', render: (m) => m.spec || '—' },
      { key: 'materialGroupId', label: 'Nhóm vật tư', render: (m) => groupName(m.materialGroupId) },
      { key: 'detailKind', label: 'Phân loại', render: (m) => m.detailKind ? DETAIL_KIND_LABEL[m.detailKind] : '—' },
      { key: 'warehouseId', label: 'Kho', render: (m) => warehouseName(m.warehouseId) },
      {
        key: 'stockQty', label: 'Tồn kho', align: 'right',
        render: (m) => {
          const qty = stockQtyOf(m)
          if (qty == null) return <span style={{ color: 'var(--text3)' }}>—</span>
          // <tr> của AdminEntityPage tự mở modal "Sửa vật tư" khi bấm vào bất kỳ đâu trong dòng
          // (openEdit) - div này phủ kín đúng vùng padding của <td> (9px 14px, xem styles/table.ts)
          // và stopPropagation ngay từ chính nó, để bấm hụt ra ngoài input/số vẫn không lọt xuống
          // <tr> mở nhầm modal (chỉ stopPropagation trên input/span bên trong là không đủ).
          if (editingId === m.id) {
            return (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ margin: '-9px -14px', padding: '9px 14px', textAlign: 'right' }}
              >
                <input
                  type="number" min={0} step="any" autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => void commitEdit(m, qty)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void commitEdit(m, qty)
                    else if (e.key === 'Escape') cancelEdit()
                  }}
                  style={{ width: 84, padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, textAlign: 'right', background: 'var(--surface)', color: 'var(--text)' }}
                />
              </div>
            )
          }
          return (
            <div
              onClick={(e) => { e.stopPropagation(); startEdit(m, qty) }}
              style={{ margin: '-9px -14px', padding: '9px 14px', cursor: 'pointer', textAlign: 'right' }}
              title="Bấm để sửa"
            >
              <span style={{ borderBottom: '1px dashed var(--text3)', fontWeight: 700, color: qty <= 0 ? '#c62828' : 'var(--text)' }}>
                {qty.toLocaleString('vi-VN')}
              </span>
            </div>
          )
        },
      },
      {
        // Vấn đề #13 audit 26/08 - "Tồn kho" ở trên là tồn thực tế; cột này là phần CÒN DÙNG
        // ĐƯỢC sau khi trừ giữ chỗ (cắt sắt/chuyển kho nội bộ ACTIVE) - chỉ đọc, không sửa nhanh
        // ở đây (sửa "Tồn kho" mới là nơi ghi bút toán thật).
        key: 'availableQty', label: 'Khả dụng', align: 'right',
        render: (m) => {
          const qty = availableQtyOf(m)
          if (qty == null) return <span style={{ color: 'var(--text3)' }}>—</span>
          return <span style={{ fontWeight: 700, color: qty <= 0 ? '#c62828' : '#2563eb' }}>{qty.toLocaleString('vi-VN')}</span>
        },
      },
      { key: 'buyerId', label: 'Nhân viên mua hàng', render: (m) => buyerName(m.buyerId) },
      { key: 'khoUnitFactor', label: 'Hệ số quy đổi', align: 'right' },
      {
        // Gộp 2 field (mang 2 nghĩa khác nhau tuỳ nhóm - xem comment Material interface) vào
        // đúng 1 cột kèm nhãn phân biệt, thay vì 2 cột riêng luôn có 1 cột toàn dấu "—" với
        // mọi vật tư cùng nhóm (vd lọc tab "Sắt" thì cột "% dự trù mua" trống suốt cả bảng).
        key: 'wastePercentage', label: '% hao hụt', align: 'right',
        render: (m) => {
          if (m.maxCuttingWastePercentage != null) {
            return <span>{m.maxCuttingWastePercentage}% <span style={{ color: 'var(--text3)', fontSize: 11 }}>· cắt</span></span>
          }
          if (m.purchaseWastePercentage != null) {
            return <span>{m.purchaseWastePercentage}% <span style={{ color: 'var(--text3)', fontSize: 11 }}>· mua</span></span>
          }
          return '—'
        },
      },
    ],
    filters: groupList.map((g) => ({ key: String(g.id), label: g.name, predicate: (m: Material) => m.materialGroupId === g.id })),
    // Không validate gì ở form này (theo yêu cầu) - kể cả Mã/Tên/Đơn vị cũng không bắt buộc
    // nữa. Nhóm vật tư để trống thì vật tư đó sẽ vô hình ở mọi picker Spec cho đến khi được
    // gán nhóm sau (ở đây hoặc lúc nhập định mức - xem skus.service.ts bên BE).
    formFields: [
      { name: 'code', label: 'Mã vật tư', type: 'text', placeholder: 'Để trống sẽ tự sinh theo Nhóm vật tư' },
      { name: 'name', label: 'Tên vật tư', type: 'text' },
      { name: 'unit', label: 'Đơn vị tính', type: 'text' },
      { name: 'spec', label: 'Quy cách', type: 'text', placeholder: 'VD: 10x29x0.8' },
      {
        name: 'materialGroupId', label: 'Nhóm vật tư', type: 'select',
        options: groupList.map((g) => ({ value: String(g.id), label: g.name })),
      },
      {
        name: 'detailKind', label: 'Phân loại', type: 'select', required: true,
        showIf: isOtherGroup,
        options: DETAIL_KIND_OPTIONS,
      },
      {
        name: 'warehouseId', label: 'Kho', type: 'select',
        options: realWarehouseOptions.map((w) => ({ value: w.id, label: w.name })),
      },
      {
        name: 'openingQty', label: 'Tồn kho ban đầu', type: 'number',
        placeholder: 'Số lượng đã có sẵn ở Kho vừa chọn (nếu có)',
        // Chỉ ghi nhận lúc TẠO MỚI (v.id == null) — sửa vật tư không chỉnh tồn kho qua field
        // này (BE update() không đọc openingQty). Cần chọn Kho trước.
        showIf: (v) => v.id == null && !!v.warehouseId,
      },
      {
        name: 'buyerId', label: 'Nhân viên mua hàng', type: 'select',
        options: buyerList.map((u) => ({ value: String(u.id), label: u.name })),
      },
      {
        name: 'purchaseUnit', label: 'Đơn vị mua (nếu khác Đơn vị tính)', type: 'text',
        placeholder: 'VD: kg — để trống nếu vật tư chỉ có 1 đơn vị',
      },
      {
        name: 'khoUnitFactor', label: 'Hệ số quy đổi (số Đơn vị tính / 1 Đơn vị mua)', type: 'number',
        placeholder: 'VD: 250 = 250 cái/kg',
      },
      // % hao hụt mang 2 nghĩa ngược chiều tuỳ nhóm (xem comment Material.maxCuttingWastePercentage
      // ở trên) - chỉ hiện đúng 1 trong 2 ô tuỳ nhóm đang chọn, KHÔNG gộp chung 1 ô.
      {
        name: 'maxCuttingWastePercentage', label: 'Ngưỡng hao hụt cắt cho phép (%)', type: 'number',
        showIf: isSteelGroup,
        placeholder: 'Để trống = dùng mặc định hệ thống. Đặt quá thấp có thể khiến không tìm được phương án cắt.',
        validate: (v) => (v != null && (Number(v) <= 0 || Number(v) > 100)) ? 'Phải trong khoảng (0, 100]' : undefined,
      },
      {
        name: 'purchaseWastePercentage', label: '% dự trù hao hụt khi mua', type: 'number',
        showIf: (v) => !isSteelGroup(v),
        placeholder: 'Để trống nếu vật tư không có hao hụt',
      },
      { name: 'imageUrl', label: 'Ảnh vật tư', type: 'image' },
    ],
    deleteConfirm: (m) => ({
      title: 'Xóa vật tư',
      message: `Xóa vật tư "${m.name}" (${m.code})? Hành động này không thể hoàn tác.`,
    }),
    // Chặn lưu nếu chưa tải được danh sách nhóm vật tư - nếu không, isSteelGroup/isOtherGroup
    // đều trả false (groupList rỗng) -> CẢ 2 field hao hụt lẫn detailKind bị showIf ẩn hết ->
    // form gửi null cho toàn bộ, xoá sạch ngưỡng Sếp đã đặt ở bất kỳ vật tư nào bị sửa lúc đó.
    guardSave: () => (groups == null ? 'Chưa tải được danh sách Nhóm vật tư - thử lại' : undefined),
    onMutate: (action, m) => {
      const label = `${m.code} — ${m.name}`
      if (action === 'create') logAction('material', String(m.id), 'masterdata.created', label)
      else if (action === 'update') logAction('material', String(m.id), 'masterdata.updated', label)
      else logAction('material', String(m.id), 'masterdata.deleted', label)
    },
    api: {
      list: getMaterials,
      create: (data) => createMaterial(data),
      update: (id, data) => updateMaterial(id, data),
      remove: (id) => deleteMaterial(id),
    },
  }

  return (
    <>
      <AdminEntityPage config={config} />
      {pendingAdjust && (
        <AdjustReasonModal
          open
          summary={`${pendingAdjust.m.name}: ${pendingAdjust.currentQty.toLocaleString('vi-VN')} → ${pendingAdjust.newQty.toLocaleString('vi-VN')} ${pendingAdjust.m.unit}`}
          busy={adjustBusy}
          error={adjustError}
          onConfirm={(reason) => void confirmAdjust(reason)}
          onCancel={cancelAdjust}
        />
      )}
    </>
  )
}

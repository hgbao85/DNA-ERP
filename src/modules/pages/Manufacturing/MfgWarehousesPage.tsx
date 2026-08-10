'use client'
import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import {
  createUser, getWarehouses, createWarehouse, deleteWarehouse,
  getMaterials, createMaterial, getMaterialGroups, getStockQuants, getStockLedger, adjustStock,
} from '../../../services/api'
import { Plus, Trash2, X, ArrowLeft, Warehouse, Search } from 'lucide-react'

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
interface QuantRow {
  materialId: string | null
  warehouseId: string
  qty: number
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

/** true nếu scope thuộc "họ" kho thành phẩm — kho gốc 'thanh-pham' hoặc kho phụ 'thanh-pham-{n}'. */
export function isThanhPhamScope(scope?: string | null): boolean {
  return scope === 'thanh-pham' || !!scope?.startsWith('thanh-pham-')
}

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

  const [openId, setOpenId]         = useState<string | null>(null)
  const [newAccount, setNewAccount] = useState<{ whName: string; email: string; password: string } | null>(null)
  const [creating, setCreating]     = useState(false)

  const group = groupKey ? WAREHOUSE_GROUPS.find(g => g.key === groupKey) : null

  // Lọc theo groupKey (khớp code trực tiếp thay vì regex tên)
  const visibleWhs = (groupKey && groupKey !== 'all')
    ? (warehouses ?? []).filter(w => w.code === groupKey || w.code.startsWith(groupKey + '-'))
    : (warehouses ?? [])

  const isThanhPhamContext = !group || group.key === 'all' || group.key === 'thanh-pham'

  const itemsOf = (whId: string): StockItem[] => {
    const qtyByMaterial = new Map(
      (quants ?? []).filter(q => q.warehouseId === whId && q.materialId).map(q => [q.materialId, q.qty]),
    )
    const groupNameById = new Map((groups ?? []).map(g => [String(g.id), g.name]))
    return (materials ?? [])
      .filter(m => m.warehouseId === whId)
      .map(m => ({
        materialId: m.id, code: m.code, name: m.name, unit: m.unit, spec: m.spec,
        groupName: m.materialGroupId ? (groupNameById.get(String(m.materialGroupId)) ?? '—') : '—',
        qty: qtyByMaterial.get(String(m.id)) ?? 0,
      }))
  }

  // Tạo kho thành phẩm mới + tài khoản thủ kho riêng, hoạt động độc lập với các kho
  // thành phẩm khác (chỉ quản lý đúng kho vừa tạo) nhưng có đầy đủ chức năng như
  // khotp@demo.com (xem generalize scope 'thanh-pham-{n}' trong InboundWarehouseApp).
  const createThanhPham = async () => {
    if (creating) return
    setCreating(true)
    try {
      const count = (warehouses ?? []).filter(w => w.code === 'thanh-pham' || w.code.startsWith('thanh-pham-')).length
      const n      = count + 1
      const whCode = `thanh-pham-${Date.now()}`
      const whName = `Kho thành phẩm ${n}`
      const newWh  = await createWarehouse({ code: whCode, name: whName, isVirtual: false, note: 'Kho thành phẩm phụ' })

      const name  = `Thủ kho Thành Phẩm ${n}`
      let   email = `khotp${n}@demo.com`
      const password = 'demo1234'
      try {
        await createUser({ name, email, password, role: 'WAREHOUSE_STAFF', warehouseScope: newWh.code })
      } catch {
        // email trùng (vd. đã có khotp{n}@demo.com từ trước) — fallback email duy nhất theo timestamp
        email = `khotp${n}.${Date.now()}@demo.com`
        await createUser({ name, email, password, role: 'WAREHOUSE_STAFF', warehouseScope: newWh.code })
      }

      await refetchWarehouses()
      setNewAccount({ whName, email, password })
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thể tạo kho mới')
    } finally {
      setCreating(false)
    }
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
      isDeletable={!BASE_CODES.has(openWh.code)}
      openingBalanceWarehouseId={openingBalanceWarehouseId}
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
        {isThanhPhamContext && isAdmin && (
          <button onClick={createThanhPham} disabled={creating} style={{ ...btnPrimary, opacity: creating ? 0.6 : 1, cursor: creating ? 'wait' : 'pointer' }}>
            <Plus size={14} /> {creating ? 'Đang tạo...' : 'Tạo kho thành phẩm mới'}
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

      {newAccount && (
        <NewAccountModal account={newAccount} onClose={() => setNewAccount(null)} />
      )}
    </div>
  )
}

// ── Modal thông báo tài khoản thủ kho vừa tạo ─────────────────────────────────

function NewAccountModal({ account, onClose }: {
  account: { whName: string; email: string; password: string }
  onClose: () => void
}) {
  return (
    <Overlay onClose={onClose}>
      <div style={modalCard}>
        <ModalHead title="Đã tạo kho + tài khoản thủ kho" onClose={onClose} />
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>
          Đã tạo <strong>{account.whName}</strong> và một tài khoản thủ kho riêng, hoạt động độc lập,
          chỉ quản lý đúng kho này (đầy đủ chức năng như các thủ kho thành phẩm khác).
        </div>
        <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text3)' }}>Email đăng nhập</span>
            <strong>{account.email}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text3)' }}>Mật khẩu</span>
            <strong>{account.password}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnPrimary}>Đã hiểu</button>
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

function WarehouseDetail({ wh, items, canWrite, isDeletable, openingBalanceWarehouseId, onBack, onMaterialCreated, onQtyAdjusted, onWarehouseDeleted }: {
  wh: WhRow
  items: StockItem[]
  canWrite: boolean
  isDeletable: boolean
  openingBalanceWarehouseId: string | null
  onBack: () => void
  onMaterialCreated: () => void
  onQtyAdjusted: () => void
  onWarehouseDeleted: () => void
}) {
  const [tab, setTab]       = useState<'stock' | 'history'>('stock')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Sửa nhanh tồn kho ngay trên bảng - đang sửa dòng nào (materialId) + giá trị đang gõ dở +
  // đang lưu dòng nào (disable input, tránh double-submit).
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const [savingId,  setSavingId]  = useState<number | null>(null)

  const { data: ledger } = useFetch<LedgerRow[]>(() => getStockLedger({ warehouseId: wh.id }), [wh.id])

  const filteredItems = items.filter(it =>
    !search || it.name.toLowerCase().includes(search.toLowerCase()) || it.code.toLowerCase().includes(search.toLowerCase()),
  )

  const startEdit = (it: StockItem) => {
    setEditingId(it.materialId)
    setEditValue(String(it.qty))
  }

  const cancelEdit = () => { setEditingId(null); setEditValue('') }

  const commitEdit = async (it: StockItem) => {
    const newQty = Number(editValue)
    if (editValue === '' || Number.isNaN(newQty) || newQty < 0) { cancelEdit(); return }
    const delta = newQty - it.qty
    if (delta === 0) { cancelEdit(); return }
    if (!openingBalanceWarehouseId) {
      alert('Chưa xác định được kho đối ứng để điều chỉnh tồn kho')
      cancelEdit()
      return
    }
    setSavingId(it.materialId)
    try {
      await adjustStock({
        fromWarehouseId: delta > 0 ? openingBalanceWarehouseId : wh.id,
        toWarehouseId:   delta > 0 ? wh.id : openingBalanceWarehouseId,
        materialId: String(it.materialId),
        qty: Math.abs(delta),
        note: 'Điều chỉnh tồn kho (trang Kho)',
      })
      cancelEdit()
      onQtyAdjusted()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thể sửa tồn kho')
    } finally {
      setSavingId(null)
    }
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
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => (
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
                        disabled={savingId === it.materialId}
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
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={6} style={{ ...td, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
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

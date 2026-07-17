'use client'
import { useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { createUser } from '../../../services/api'
import { Plus, Trash2, X, ArrowLeft, Warehouse, Search } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Item {
  id: number
  name: string
  unit: string
  quantity: number
  code?: string
  color?: string
  size?: string
  note?: string
}
export interface Txn {
  id: string
  itemId: number
  itemName: string
  unit: string
  type: 'IMPORT' | 'EXPORT'
  quantity: number
  note: string
  date: string
}
export interface Wh {
  id: string         // 'phoi-son-han' | 'vat-tu-tp' | 'thanh-pham' | 'thanh-pham-{n}'
  name: string
  category: string
  items: Item[]
  txns: Txn[]
}

// ── Dữ liệu khởi tạo 3 kho ───────────────────────────────────────────────────

export const INITIAL_WAREHOUSES: Wh[] = [
  {
    id: 'phoi-son-han',
    name: 'Kho phôi sơn hàn',
    category: 'Phôi kim loại, sơn, vật tư hàn và cơ khí',
    txns: [],
    items: [
      { id: 101, name: 'Thép ống D25×1.5',           unit: 'm',    quantity: 1_200 },
      { id: 102, name: 'Thép ống D32×2.0',           unit: 'm',    quantity:   850 },
      { id: 103, name: 'Thép tấm dày 1.5mm',         unit: 'm²',   quantity:   420 },
      { id: 104, name: 'Thép hộp 25×25×1.2mm',       unit: 'm',    quantity:   680 },
      { id: 105, name: 'Sơn tĩnh điện đen',          unit: 'kg',   quantity:   380 },
      { id: 106, name: 'Sơn tĩnh điện trắng',        unit: 'kg',   quantity:   210 },
      { id: 107, name: 'Sơn tĩnh điện nâu sồi',     unit: 'kg',   quantity:   145 },
      { id: 108, name: 'Que hàn điện 3.2mm',         unit: 'hộp',  quantity:    95 },
      { id: 109, name: 'Dây hàn MIG 0.8mm',          unit: 'cuộn', quantity:    42 },
      { id: 110, name: 'Nhớt cắt gọt công nghiệp',  unit: 'lít',  quantity:    28 },
      { id: 111, name: 'Đĩa cắt sắt 105mm',         unit: 'cái',  quantity:   350 },
      { id: 112, name: 'Đĩa mài sắt 125mm',         unit: 'cái',  quantity:   200 },
    ],
  },
  {
    id: 'vat-tu-tp',
    name: 'Kho vật tư thành phẩm',
    category: 'Vật tư, phụ kiện, dây đan dùng cho thành phẩm',
    txns: [],
    items: [
      { id: 201, name: 'Dây đan PE 2mm – trắng',      unit: 'm',    quantity: 8_500 },
      { id: 202, name: 'Dây đan PE 2mm – đen',        unit: 'm',    quantity: 6_200 },
      { id: 203, name: 'Dây đan PE 2mm – xanh lam',  unit: 'm',    quantity: 4_800 },
      { id: 204, name: 'Dây đan PE 2mm – ghi xám',   unit: 'm',    quantity: 3_100 },
      { id: 205, name: 'Ốc vít M6×20',                unit: 'cái',  quantity: 5_000 },
      { id: 206, name: 'Bu lông M8×30',               unit: 'cái',  quantity: 3_200 },
      { id: 207, name: 'Đai ốc M6',                   unit: 'cái',  quantity: 4_500 },
      { id: 208, name: 'Vòng đệm M6',                 unit: 'cái',  quantity: 4_500 },
      { id: 209, name: 'Nhựa bịt đầu ống D25',       unit: 'cái',  quantity: 2_100 },
      { id: 210, name: 'Nệm ghế dày 5cm',             unit: 'cái',  quantity:   320 },
      { id: 211, name: 'Gioăng cao su đặc',           unit: 'cái',  quantity: 1_500 },
      { id: 212, name: 'Tem nhãn sản phẩm',           unit: 'tờ',   quantity:   800 },
    ],
  },
  {
    id: 'thanh-pham',
    name: 'Kho thành phẩm',
    category: 'Thành phẩm và bao bì đóng gói hoàn chỉnh',
    txns: [],
    items: [
      { id: 301, name: 'Ghế sắt mặt đan PE – trắng',      unit: 'cái', quantity: 145 },
      { id: 302, name: 'Ghế sắt mặt đan PE – đen',        unit: 'cái', quantity:  98 },
      { id: 303, name: 'Ghế sắt mặt đan PE – xanh lam',  unit: 'cái', quantity:  74 },
      { id: 304, name: 'Bàn sắt mặt đan PE tròn Ø80',    unit: 'cái', quantity:  62 },
      { id: 305, name: 'Bàn sắt mặt đan PE chữ nhật',    unit: 'cái', quantity:  45 },
      { id: 306, name: 'Bộ bàn ghế ngoài trời 4 chỗ',    unit: 'bộ',  quantity:  35 },
      { id: 307, name: 'Bộ bàn ghế ngoài trời 6 chỗ',    unit: 'bộ',  quantity:  18 },
      { id: 308, name: 'Ghế xếp compact',                 unit: 'cái', quantity: 180 },
      { id: 309, name: 'Bao bì carton 5 lớp',             unit: 'cái', quantity: 320 },
      { id: 310, name: 'Thùng bìa đôi',                   unit: 'cái', quantity: 145 },
      { id: 311, name: 'Màng PE bọc sản phẩm',            unit: 'cuộn',quantity:  24 },
    ],
  },
  {
    id: 'thanh-pham-2',
    name: 'Kho thành phẩm 2',
    category: 'Thành phẩm nhựa và nội thất ngoài trời',
    txns: [],
    items: [
      { id: 401, name: 'Ghế nhựa đúc liền khối – trắng',   unit: 'cái',  quantity: 220 },
      { id: 402, name: 'Ghế nhựa đúc liền khối – xanh rêu', unit: 'cái', quantity: 156 },
      { id: 403, name: 'Bàn nhựa tròn Ø70',                unit: 'cái',  quantity:  98 },
      { id: 404, name: 'Kệ sắt 3 tầng đa năng',            unit: 'cái',  quantity:  54 },
      { id: 405, name: 'Kệ sắt 5 tầng đa năng',            unit: 'cái',  quantity:  32 },
      { id: 406, name: 'Xe đẩy hàng mini',                 unit: 'cái',  quantity:  40 },
      { id: 407, name: 'Ghế bố xếp gọn',                   unit: 'cái',  quantity: 210 },
      { id: 408, name: 'Dù che nắng lệch tâm',              unit: 'cái',  quantity:  15 },
      { id: 409, name: 'Bao bì carton 3 lớp',              unit: 'cái',  quantity: 400 },
      { id: 410, name: 'Túi PE đóng gói lớn',               unit: 'cái',  quantity: 180 },
    ],
  },
  {
    id: 'thanh-pham-3',
    name: 'Kho thành phẩm 3',
    category: 'Thành phẩm dã ngoại và đồ gia dụng',
    txns: [],
    items: [
      { id: 501, name: 'Giường lưới xếp gọn',              unit: 'cái',  quantity:  60 },
      { id: 502, name: 'Võng xếp khung thép',              unit: 'cái',  quantity:  85 },
      { id: 503, name: 'Ghế xích đu đôi',                  unit: 'cái',  quantity:  22 },
      { id: 504, name: 'Bàn xếp dã ngoại',                 unit: 'cái',  quantity:  48 },
      { id: 505, name: 'Ô dù sân vườn lớn',                unit: 'cái',  quantity:  12 },
      { id: 506, name: 'Kệ giày nhựa 4 tầng',              unit: 'cái',  quantity: 130 },
      { id: 507, name: 'Thùng nhựa đựng đồ 50L',           unit: 'cái',  quantity:  90 },
      { id: 508, name: 'Rổ nhựa công nghiệp',              unit: 'cái',  quantity: 260 },
      { id: 509, name: 'Màng co bọc hàng',                 unit: 'cuộn', quantity:  35 },
      { id: 510, name: 'Nhãn mác đóng gói',                unit: 'tờ',   quantity: 500 },
    ],
  },
]

// ── Config nhóm (dùng cho WarehouseTabsPage & filterWarehousesByGroup) ────────

export interface WhGroup { key: string; label: string; desc: string; match: (wh: { name: string }) => boolean }

export const WAREHOUSE_GROUPS: WhGroup[] = [
  { key: 'all',          label: 'Tất cả kho',             desc: 'Tổng hợp tất cả kho',                       match: () => true },
  { key: 'phoi-son-han', label: 'Kho phôi sơn hàn',      desc: 'Phôi kim loại, sơn, vật tư hàn và cơ khí', match: wh => /phôi|sắt|sơn|hàn|cơ\s*khí/i.test(wh.name) },
  { key: 'vat-tu-tp',    label: 'Kho vật tư thành phẩm', desc: 'Vật tư, phụ kiện, dây đan dùng cho thành phẩm', match: wh => /vật\s*tư|phụ\s*kiện|dây|khung/i.test(wh.name) },
  { key: 'thanh-pham',   label: 'Kho thành phẩm',         desc: 'Thành phẩm và bao bì đóng gói hoàn chỉnh', match: wh => /thành\s*phẩm|bao\s*bì/i.test(wh.name) },
]

export function filterWarehousesByGroup<T extends { name: string }>(list: T[], groupKey?: string | null): T[] {
  const g = groupKey ? WAREHOUSE_GROUPS.find(x => x.key === groupKey) : null
  return g ? list.filter(g.match) : list
}

const BASE_IDS = new Set(['phoi-son-han', 'vat-tu-tp', 'thanh-pham'])

/** true nếu scope thuộc "họ" kho thành phẩm — kho gốc 'thanh-pham' hoặc kho phụ 'thanh-pham-{n}'. */
export function isThanhPhamScope(scope?: string | null): boolean {
  return scope === 'thanh-pham' || !!scope?.startsWith('thanh-pham-')
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MfgWarehousesPage({ groupKey }: { groupKey?: string | null }) {
  const { user } = useAuth()
  const canWrite = user?.mfgRole === 'PRODUCTION_MANAGER'
  const isAdmin  = user?.role === 'ADMIN'

  const [warehouses, setWarehouses] = useState<Wh[]>(INITIAL_WAREHOUSES)
  const [openId, setOpenId]         = useState<string | null>(null)
  const [newAccount, setNewAccount] = useState<{ whName: string; email: string; password: string } | null>(null)
  const [creating, setCreating]     = useState(false)

  const group = groupKey ? WAREHOUSE_GROUPS.find(g => g.key === groupKey) : null

  // Lọc theo groupKey (khớp ID trực tiếp thay vì regex tên)
  const visibleWhs = (groupKey && groupKey !== 'all')
    ? warehouses.filter(w => w.id === groupKey || w.id.startsWith(groupKey + '-'))
    : warehouses

  const isThanhPhamContext = !group || group.key === 'all' || group.key === 'thanh-pham'

  // Tạo kho thành phẩm mới + tài khoản thủ kho riêng, hoạt động độc lập với các kho
  // thành phẩm khác (chỉ quản lý đúng kho vừa tạo) nhưng có đầy đủ chức năng như
  // khotp@demo.com (xem generalize scope 'thanh-pham-{n}' trong InboundWarehouseApp).
  const createThanhPham = async () => {
    if (creating) return
    setCreating(true)
    try {
      const template = warehouses.find(w => w.id === 'thanh-pham')!
      const count    = warehouses.filter(w => w.id === 'thanh-pham' || w.id.startsWith('thanh-pham-')).length
      const n        = count + 1
      const whId     = `thanh-pham-${Date.now()}`
      const whName   = `Kho thành phẩm ${n}`

      const newWh: Wh = {
        id:       whId,
        name:     whName,
        category: template.category,
        items:    [],
        txns:     [],
      }

      const name  = `Thủ kho Thành Phẩm ${n}`
      let   email = `khotp${n}@demo.com`
      const password = 'demo1234'
      try {
        await createUser({ name, email, password, role: 'WAREHOUSE_STAFF', warehouseScope: whId })
      } catch {
        // email trùng (vd. đã có khotp{n}@demo.com từ trước) — fallback email duy nhất theo timestamp
        email = `khotp${n}.${Date.now()}@demo.com`
        await createUser({ name, email, password, role: 'WAREHOUSE_STAFF', warehouseScope: whId })
      }

      setWarehouses(prev => [...prev, newWh])
      setNewAccount({ whName, email, password })
    } finally {
      setCreating(false)
    }
  }

  const updateWh  = (updated: Wh) => setWarehouses(prev => prev.map(w => w.id === updated.id ? updated : w))
  const deleteWh  = (id: string)  => setWarehouses(prev => prev.filter(w => w.id !== id))

  const openWh = warehouses.find(w => w.id === openId) ?? null

  if (openWh) return (
    <WarehouseDetail
      wh={openWh}
      canWrite={canWrite}
      isDeletable={!BASE_IDS.has(openWh.id)}
      onBack={() => setOpenId(null)}
      onUpdate={updateWh}
      onDelete={() => { deleteWh(openWh.id); setOpenId(null) }}
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
        {visibleWhs.map(wh => (
          <WhCard
            key={wh.id}
            wh={wh}
            onOpen={() => setOpenId(wh.id)}
          />
        ))}
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

function WhCard({ wh, onOpen }: { wh: Wh; onOpen: () => void }) {
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
      <div style={{ fontSize: 12, color: 'var(--text2)' }}>{wh.category}</div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e65100', lineHeight: 1 }}>
            {wh.items.length} mặt hàng
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            Tồn {wh.items.reduce((s, it) => s + it.quantity, 0).toLocaleString('vi-VN')}
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Chi tiết kho ──────────────────────────────────────────────────────────────

function WarehouseDetail({ wh, canWrite, isDeletable, onBack, onUpdate, onDelete }: {
  wh: Wh
  canWrite: boolean
  isDeletable: boolean
  onBack: () => void
  onUpdate: (updated: Wh) => void
  onDelete: () => void
}) {
  const [tab, setTab]       = useState<'stock' | 'history'>('stock')
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<Item | 'new' | null>(null)

  const filteredItems = wh.items.filter(it =>
    !search || it.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleSaveItem = (saved: Item) => {
    const exists = wh.items.find(it => it.id === saved.id)
    const newItems = exists
      ? wh.items.map(it => it.id === saved.id ? saved : it)
      : [...wh.items, { ...saved, id: Date.now() }]
    onUpdate({ ...wh, items: newItems })
    setEditItem(null)
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
            {canWrite && <button onClick={() => setEditItem('new')} style={btnPrimary}><Plus size={15} /> Thêm vật tư</button>}
            {isDeletable && (
              <button onClick={() => { if (confirm(`Xóa kho "${wh.name}"?`)) onDelete() }} style={{ ...btnGhost, color: '#dc2626', borderColor: '#fca5a5' }}>
                <Trash2 size={14} /> Xóa kho
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
                <th style={th}>Tên vật tư</th>
                <th style={th}>Màu / kích thước</th>
                <th style={th}>ĐVT</th>
                <th style={{ ...th, textAlign: 'right' }}>Tồn</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(it => (
                <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={td}>
                    <div style={{ fontWeight: 500 }}>{it.name}</div>
                    {it.note && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{it.note}</div>}
                  </td>
                  <td style={{ ...td, color: 'var(--text3)', fontSize: 12 }}>
                    {[it.color, it.size].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td style={td}>{it.unit}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: it.quantity <= 0 ? '#c62828' : 'var(--text)' }}>
                    {it.quantity.toLocaleString('vi-VN')}
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={canWrite ? 5 : 4} style={{ ...td, color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
                  {wh.items.length === 0 ? 'Kho chưa có vật tư.' : 'Không tìm thấy vật tư.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lịch sử */}
      {tab === 'history' && <WarehouseHistory txns={wh.txns} />}

      {editItem && (
        <ItemModal
          item={editItem === 'new' ? null : editItem}
          onClose={() => setEditItem(null)}
          onDone={handleSaveItem}
        />
      )}
    </div>
  )
}

// ── Lịch sử nhập/xuất ────────────────────────────────────────────────────────

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

// ── Modal thêm / sửa vật tư ───────────────────────────────────────────────────

function ItemModal({ item, onClose, onDone }: {
  item: Item | null; onClose: () => void; onDone: (saved: Item) => void
}) {
  const [form, setForm] = useState<Omit<Item, 'id'>>({
    name:  item?.name  ?? '',
    unit:  item?.unit  ?? '',
    quantity: item?.quantity ?? 0,
    color: item?.color ?? '',
    size:  item?.size  ?? '',
    note:  item?.note  ?? '',
  })
  const [err, setErr] = useState<string | null>(null)

  const set = (key: keyof typeof form, val: string) => setForm(p => ({ ...p, [key]: val }))

  const submit = () => {
    if (!form.name.trim()) { setErr('Tên vật tư bắt buộc'); return }
    if (!form.unit.trim()) { setErr('ĐVT bắt buộc'); return }
    onDone({ ...form, id: item?.id ?? 0, quantity: item ? form.quantity : 0 })
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalCard}>
        <ModalHead title={item ? 'Sửa vật tư' : 'Thêm vật tư'} onClose={onClose} />
        <label style={lbl}>Tên vật tư *</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} style={inp} />
        <label style={lbl}>ĐVT *</label>
        <input value={form.unit} onChange={e => set('unit', e.target.value)} style={inp} />
        <label style={lbl}>Màu / đặc tính</label>
        <input value={form.color ?? ''} onChange={e => set('color', e.target.value)} style={inp} />
        <label style={lbl}>Kích thước</label>
        <input value={form.size ?? ''} onChange={e => set('size', e.target.value)} style={inp} />
        <label style={lbl}>Ghi chú</label>
        <input value={form.note ?? ''} onChange={e => set('note', e.target.value)} style={inp} />
        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>Hủy</button>
          <button onClick={submit} style={btnPrimary}>Lưu</button>
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

import { useState } from 'react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useAuth } from '../../../context/AuthContext'
import { Plus, Trash2, Pencil, X, ArrowLeft, ArrowDownToLine, ArrowUpFromLine, History, Warehouse, Search } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────
interface Wh {
  id: number
  name: string
  keeperName?: string | null
  category?: string | null
  columns: string[]
  _count?: { items: number }
}
interface WhItem {
  id: number
  code?: string | null
  codeIea?: string | null
  classification?: string | null
  name: string
  color?: string | null
  size?: string | null
  unit: string
  norm?: string | null
  poNumber?: string | null
  quantity: number
  note?: string | null
}
interface Txn {
  id: number
  type: 'IMPORT' | 'EXPORT' | 'ADJUST'
  quantity: number
  note?: string | null
  date: string
  item?: { name: string; unit: string } | null
  createdBy?: { name: string } | null
}

// Field key → nhãn cột
const COL_LABEL: Record<string, string> = {
  code: 'Mã', codeIea: 'Mã IEA', classification: 'Phân loại', name: 'Tên vật tư',
  color: 'Đặc tính', size: 'Kích thước', unit: 'ĐVT', norm: 'Định mức', poNumber: 'Số PO',
  quantity: 'Tồn', note: 'Ghi chú',
}
// Các field text có thể nhập/sửa (không gồm quantity — do nhập/xuất quản lý)
const TEXT_FIELDS = ['code', 'codeIea', 'classification', 'name', 'color', 'size', 'unit', 'norm', 'poNumber', 'note']

const safeArr = <T,>(d: T[] | null | undefined): T[] => (Array.isArray(d) ? d : [])

// Nhóm kho theo loại — phân theo thủ kho/chức năng (menu con ở sidebar)
// match chỉ dùng wh.name → nhận object tối thiểu { name } để tái dùng ở các màn khác.
export interface WhGroup { key: string; label: string; desc: string; match: (wh: { name: string }) => boolean }
export const WAREHOUSE_GROUPS: WhGroup[] = [
  { key: 'phu-kien', label: 'Kho phụ kiện', desc: 'Phụ kiện', match: wh => /mận/i.test(wh.name) },
  { key: 'bao-bi', label: 'Kho bao bì đóng gói', desc: 'Bao bì + phụ kiện phục vụ đóng gói', match: wh => /(hân|trinh|nghĩa)/i.test(wh.name) },
  { key: 'day', label: 'Kho dây', desc: 'Dây phục vụ xuất đan', match: wh => /hồng/i.test(wh.name) },
  { key: 'sat', label: 'Kho sắt', desc: 'Cập nhật khi mua sắt về', match: wh => /sắt/i.test(wh.name) },
  { key: 'thanh-pham', label: 'Kho thành phẩm', desc: 'Sản phẩm đã đóng gói hoàn chỉnh', match: wh => /thành\s*phẩm/i.test(wh.name) },
]

// Lọc danh sách kho theo nhóm (dùng cho tài khoản kho bị giới hạn warehouseScope).
// groupKey rỗng/null → trả nguyên danh sách.
export function filterWarehousesByGroup<T extends { name: string }>(list: T[], groupKey?: string | null): T[] {
  const g = groupKey ? WAREHOUSE_GROUPS.find(x => x.key === groupKey) : null
  return g ? list.filter(g.match) : list
}

// ─────────────────────────────────────────────────────────────────────
export default function MfgWarehousesPage({ groupKey }: { groupKey?: string | null }) {
  const { user } = useAuth()
  // Giám đốc (MANAGER không mfgRole) chỉ XEM — đồng bộ với MfgRolesGuard backend.
  const canWrite = user?.mfgRole === 'PRODUCTION_MANAGER'
  const [openWh, setOpenWh] = useState<Wh | null>(null)

  const { data: whs, isLoading, error } = useFetch<Wh[]>(() => api.getMfgWarehouses())

  if (openWh) return <WarehouseDetail wh={openWh} canWrite={canWrite} onBack={() => setOpenWh(null)} />

  // Lọc theo nhóm chọn ở sidebar (không chọn → hiện tất cả)
  const group = groupKey ? WAREHOUSE_GROUPS.find(g => g.key === groupKey) : null
  const list = group ? safeArr(whs).filter(group.match) : safeArr(whs)

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{group ? group.label : 'Tổng hợp kho'}</h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 18 }}>
        {group ? group.desc : 'Chọn kho để xem tồn & nhập/xuất'}
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 12, marginBottom: 18 }}>
        {list.length} kho{list.length === 1 ? '' : 's'}{group ? ' trong nhóm này' : ''}
      </div>

      {isLoading && <div style={{ color: 'var(--text3)' }}>Đang tải…</div>}
      {error && <div style={{ color: '#c62828' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
        {list.map(wh => <WhCard key={wh.id} wh={wh} onOpen={() => setOpenWh(wh)} />)}
      </div>
      {!isLoading && list.length === 0 && (
        <div style={{ color: 'var(--text3)', marginTop: 12 }}>
          {safeArr(whs).length === 0 ? 'Chưa có kho nào. (Chạy script nạp catalog từ Excel.)' : 'Nhóm này chưa có kho.'}
        </div>
      )}
    </div>
  )
}

// ── Card 1 kho ────────────────────────────────────────────────────────
function WhCard({ wh, onOpen }: { wh: Wh; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        textAlign: 'left', cursor: 'pointer', padding: 16, borderRadius: 'var(--radius)',
        border: '1px solid var(--border)', background: 'var(--surface)', transition: 'box-shadow .1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Warehouse size={18} color="#e65100" />
        <span style={{ fontWeight: 700, fontSize: 15 }}>{wh.name}</span>
      </div>
      {wh.category && <div style={{ fontSize: 12, color: 'var(--text2)' }}>{wh.category}</div>}
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span>{wh.keeperName ? `Thủ kho: ${wh.keeperName}` : ' '}</span>
        <span>{wh._count?.items ?? 0} vật tư</span>
      </div>
    </button>
  )
}

// ── Chi tiết 1 kho ────────────────────────────────────────────────────
function WarehouseDetail({ wh, canWrite, onBack }: { wh: Wh; canWrite: boolean; onBack: () => void }) {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const { data: items, isLoading, refetch } = useFetch<WhItem[]>(() => api.getMfgWarehouseItems(wh.id, q || undefined), [q])

  const [moveItem, setMoveItem] = useState<{ item: WhItem; mode: 'import' | 'export' } | null>(null)
  const [editItem, setEditItem] = useState<WhItem | 'new' | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const cols = wh.columns?.length ? wh.columns : ['name', 'unit', 'quantity']

  const cellVal = (it: WhItem, key: string): string => {
    const v = (it as unknown as Record<string, unknown>)[key]
    if (key === 'quantity') return String(it.quantity ?? 0)
    return v == null || v === '' ? '—' : String(v)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={btnGhost}><ArrowLeft size={16} /> Kho</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{wh.name}</h2>
        {wh.keeperName && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Thủ kho: {wh.keeperName}</span>}
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: 'var(--text3)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') setQ(search) }}
            placeholder="Tìm tên / mã…"
            style={{ ...inp, paddingLeft: 28, width: 200 }}
          />
        </div>
        <button onClick={() => setQ(search)} style={btnGhost}>Tìm</button>
        <button onClick={() => setShowHistory(true)} style={btnGhost}><History size={15} /> Lịch sử</button>
        {canWrite && <button onClick={() => setEditItem('new')} style={btnPrimary}><Plus size={15} /> Thêm vật tư</button>}
      </div>

      {isLoading && <div style={{ color: 'var(--text3)' }}>Đang tải…</div>}

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              {cols.map(c => <th key={c} style={th}>{COL_LABEL[c] ?? c}</th>)}
              {canWrite && <th style={{ ...th, textAlign: 'right' }}>Thao tác</th>}
            </tr>
          </thead>
          <tbody>
            {safeArr(items).map(it => (
              <tr key={it.id} style={{ borderTop: '1px solid var(--border)' }}>
                {cols.map(c => (
                  <td key={c} style={{ ...td, ...(c === 'quantity' ? { fontWeight: 700, textAlign: 'right' as const, color: it.quantity <= 0 ? '#c62828' : 'var(--text)' } : {}) }}>
                    {cellVal(it, c)}
                  </td>
                ))}
                {canWrite && (
                  <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button title="Nhập" onClick={() => setMoveItem({ item: it, mode: 'import' })} style={iconBtn}><ArrowDownToLine size={15} color="#2e7d32" /></button>
                    <button title="Xuất" onClick={() => setMoveItem({ item: it, mode: 'export' })} style={iconBtn}><ArrowUpFromLine size={15} color="#e65100" /></button>
                    <button title="Sửa" onClick={() => setEditItem(it)} style={iconBtn}><Pencil size={14} color="var(--text2)" /></button>
                    <button title="Xóa" onClick={async () => { if (confirm(`Xóa "${it.name}"?`)) { await api.deleteMfgWarehouseItem(it.id); refetch() } }} style={iconBtn}><Trash2 size={14} color="#c62828" /></button>
                  </td>
                )}
              </tr>
            ))}
            {!isLoading && safeArr(items).length === 0 && (
              <tr><td colSpan={cols.length + 1} style={{ ...td, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Không có vật tư</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {moveItem && <MoveModal {...moveItem} onClose={() => setMoveItem(null)} onDone={() => { setMoveItem(null); refetch() }} />}
      {editItem && <ItemModal wh={wh} item={editItem === 'new' ? null : editItem} onClose={() => setEditItem(null)} onDone={() => { setEditItem(null); refetch() }} />}
      {showHistory && <HistoryModal wh={wh} onClose={() => setShowHistory(false)} />}
    </div>
  )
}

// ── Modal nhập / xuất ─────────────────────────────────────────────────
function MoveModal({ item, mode, onClose, onDone }: { item: WhItem; mode: 'import' | 'export'; onClose: () => void; onDone: () => void }) {
  const [qty, setQty] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isImport = mode === 'import'

  const submit = async () => {
    const n = Number(qty)
    if (!n || n <= 0) { setErr('Số lượng phải > 0'); return }
    setBusy(true); setErr(null)
    try {
      const payload = { itemId: item.id, quantity: n, note: note || undefined }
      if (isImport) await api.importMfgStock(payload)
      else await api.exportMfgStock(payload)
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg ?? 'Có lỗi xảy ra')
      setBusy(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalCard}>
        <ModalHead title={`${isImport ? 'Nhập kho' : 'Xuất kho'} — ${item.name}`} onClose={onClose} />
        <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>Tồn hiện tại: <b>{item.quantity}</b> {item.unit}</div>
        <label style={lbl}>Số lượng {isImport ? 'nhập' : 'xuất'} ({item.unit})</label>
        <input autoFocus type="number" value={qty} onChange={e => setQty(e.target.value)} style={inp} />
        <label style={lbl}>Ghi chú</label>
        <input value={note} onChange={e => setNote(e.target.value)} style={inp} />
        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={busy} style={isImport ? btnGreen : btnPrimary}>{busy ? '…' : (isImport ? 'Nhập' : 'Xuất')}</button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Modal thêm / sửa item ─────────────────────────────────────────────
function ItemModal({ wh, item, onClose, onDone }: { wh: Wh; item: WhItem | null; onClose: () => void; onDone: () => void }) {
  // Field hiển thị = cột text của kho; luôn đảm bảo có name + unit
  const fields = Array.from(new Set(['name', 'unit', ...wh.columns.filter(c => TEXT_FIELDS.includes(c))]))
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    fields.forEach(f => { init[f] = item ? String((item as unknown as Record<string, unknown>)[f] ?? '') : '' })
    return init
  })
  const [initQty, setInitQty] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!form.name?.trim()) { setErr('Tên vật tư bắt buộc'); return }
    if (!form.unit?.trim()) { setErr('ĐVT bắt buộc'); return }
    setBusy(true); setErr(null)
    try {
      const payload: Record<string, unknown> = {}
      fields.forEach(f => { const v = form[f]?.trim(); if (v) payload[f] = v })
      if (item) await api.updateMfgWarehouseItem(item.id, payload)
      else await api.createMfgWarehouseItem(wh.id, { ...payload, quantity: Number(initQty) || 0 })
      onDone()
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error
      setErr(msg ?? 'Có lỗi xảy ra'); setBusy(false)
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={modalCard}>
        <ModalHead title={item ? 'Sửa vật tư' : 'Thêm vật tư'} onClose={onClose} />
        {fields.map(f => (
          <div key={f}>
            <label style={lbl}>{COL_LABEL[f] ?? f}{(f === 'name' || f === 'unit') ? ' *' : ''}</label>
            <input value={form[f] ?? ''} onChange={e => setForm({ ...form, [f]: e.target.value })} style={inp} />
          </div>
        ))}
        {!item && (
          <div>
            <label style={lbl}>Tồn ban đầu (mặc định 0)</label>
            <input type="number" value={initQty} onChange={e => setInitQty(e.target.value)} style={inp} />
          </div>
        )}
        {err && <div style={{ color: '#c62828', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={btnGhost}>Hủy</button>
          <button onClick={submit} disabled={busy} style={btnPrimary}>{busy ? '…' : 'Lưu'}</button>
        </div>
      </div>
    </Overlay>
  )
}

// ── Modal lịch sử ─────────────────────────────────────────────────────
function HistoryModal({ wh, onClose }: { wh: Wh; onClose: () => void }) {
  const { data: txns, isLoading } = useFetch<Txn[]>(() => api.getMfgWarehouseTxns(wh.id))
  return (
    <Overlay onClose={onClose}>
      <div style={{ ...modalCard, width: 560, maxHeight: '80vh', overflow: 'auto' }}>
        <ModalHead title={`Lịch sử nhập/xuất — ${wh.name}`} onClose={onClose} />
        {isLoading && <div style={{ color: 'var(--text3)' }}>Đang tải…</div>}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ textAlign: 'left', color: 'var(--text3)' }}>
            <th style={th}>Ngày</th><th style={th}>Vật tư</th><th style={th}>Loại</th><th style={{ ...th, textAlign: 'right' }}>SL</th><th style={th}>Người</th>
          </tr></thead>
          <tbody>
            {safeArr(txns).map(t => (
              <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={td}>{new Date(t.date).toLocaleDateString('vi-VN')}</td>
                <td style={td}>{t.item?.name ?? '—'}</td>
                <td style={{ ...td, color: t.type === 'IMPORT' ? '#2e7d32' : '#e65100', fontWeight: 600 }}>{t.type === 'IMPORT' ? 'Nhập' : t.type === 'EXPORT' ? 'Xuất' : 'Điều chỉnh'}</td>
                <td style={{ ...td, textAlign: 'right' }}>{t.quantity}</td>
                <td style={td}>{t.createdBy?.name ?? '—'}</td>
              </tr>
            ))}
            {!isLoading && safeArr(txns).length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 16 }}>Chưa có giao dịch</td></tr>}
          </tbody>
        </table>
      </div>
    </Overlay>
  )
}

// ── UI helpers ────────────────────────────────────────────────────────
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

const th: React.CSSProperties = { padding: '9px 12px', fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
const td: React.CSSProperties = { padding: '8px 12px', color: 'var(--text)' }
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 12, color: 'var(--text2)', margin: '10px 0 4px' }
const btnGhost: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }
const btnPrimary: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', border: 'none', borderRadius: 'var(--radius)', background: '#e65100', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const btnGreen: React.CSSProperties = { ...btnPrimary, background: '#2e7d32' }
const iconBtn: React.CSSProperties = { padding: 5, background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex' }
const modalCard: React.CSSProperties = { width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 20, boxShadow: '0 8px 30px rgba(0,0,0,.2)' }

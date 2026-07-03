'use client'
import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, X, Search, ChevronLeft } from 'lucide-react'
import type { PlanForm } from '../../../types/plan-form'

const CAT_META = {
  sat:           { label: 'Sắt',           color: '#b45309', bg: '#fef3c7' },
  daySon:        { label: 'Dây/Sơn',       color: '#0369a1', bg: '#e0f2fe' },
  vatTuPhuKien:  { label: 'Phụ kiện',      color: '#7c3aed', bg: '#ede9fe' },
  baoBiDongGoi:  { label: 'Bao bì',        color: '#be185d', bg: '#fce7f3' },
  manh:          { label: 'Mảnh',          color: '#065f46', bg: '#d1fae5' },
  thanhPham:     { label: 'Thành phẩm',    color: '#1e40af', bg: '#dbeafe' },
} as const

export type Cat = keyof typeof CAT_META

interface FlatItem {
  key: string
  pfId: number
  pfStatus: string
  pfCreatedAt: string
  productName: string
  productCode: string
  poNumber: string
  cat: Cat
  name: string
  spec: string | null
  unit: string | null
  qty: string | null
  createdAt: string | null
}

type ApprovalEntry = { status: 'APPROVED' | 'REJECTED'; reason?: string } | null

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED: { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  APPROVED: { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
}

const MANH_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  APPROVED_PARTS: { label: 'Có mảnh',   color: '#065f46', bg: '#d1fae5' },
  WAITING_PARTS:  { label: 'Chờ mảnh',  color: '#92400e', bg: '#fef3c7' },
  APPROVED:       { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  PROPOSED:       { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  REJECTED:       { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
}

const MOCK_MANH_DELIVERY: Record<string, string> = {
  'PO-2501': '2026-01-15',
  'PO-2504': '2026-01-20',
  'PO-2503': '2026-02-01',
}

function mockChuaChuyenKiem(key: string, total: number): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return Math.round(total * (h % 5) / 4)
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.PROPOSED
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: s.color, background: s.bg, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, gap: 8 }}>
      <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  )
}

function pushItems(items: FlatItem[], pf: PlanForm, cat: Cat, arr: any[]) {
  const base = {
    pfId: pf.id,
    pfStatus: pf.status,
    pfCreatedAt: pf.createdAt,
    productName: pf.mfgProduct?.name ?? '—',
    productCode: pf.mfgProduct?.factoryCode ?? '—',
    poNumber: pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
  }
  arr.forEach((i: any, idx: number) => items.push({
    ...base,
    key: `${pf.id}-${cat}-${idx}`,
    cat,
    name: i.name,
    spec: [i.specifications, i.thickness != null ? `dày ${i.thickness}mm` : null].filter(Boolean).join(', ') || null,
    unit: i.unit ?? null,
    qty: i.quantity != null ? String(i.quantity) : (i.kg != null ? String(i.kg) : null),
    createdAt: i.createdAt ?? null,
  }))
}

function flattenItems(planForms: PlanForm[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const pf of planForms) {
    const base = {
      pfId: pf.id,
      pfStatus: pf.status,
      pfCreatedAt: pf.createdAt,
      productName: pf.mfgProduct?.name ?? '—',
      productCode: pf.mfgProduct?.factoryCode ?? '—',
      poNumber: pf.exportOrder?.poNumber ?? `#${pf.exportOrderId}`,
    }
    const mt = pf.quotaManagement?.materialType
    if (mt) {
      if (Array.isArray(mt.sat))           pushItems(items, pf, 'sat',          mt.sat)
      if (Array.isArray(mt.daySon))        pushItems(items, pf, 'daySon',       mt.daySon)
      if (Array.isArray(mt.vatTuPhuKien))  pushItems(items, pf, 'vatTuPhuKien', mt.vatTuPhuKien)
      if (Array.isArray(mt.baoBiDongGoi))  pushItems(items, pf, 'baoBiDongGoi', mt.baoBiDongGoi)
    }
    if (Array.isArray(pf.manhItems)) {
      for (const manh of pf.manhItems) {
        for (const child of manh.children) {
          items.push({
            ...base,
            key: `${pf.id}-manh-${manh.id}-${child.id}`,
            cat: 'manh',
            name: child.name,
            spec: [manh.name, child.specs].filter(Boolean).join(' · ') || null,
            unit: null,
            qty: child.qty ?? null,
            createdAt: null,
          })
        }
      }
    }
  }
  return items
}

const FILTER_TABS: { id: Cat | 'all'; label: string }[] = [
  { id: 'all',          label: 'Tất cả' },
  { id: 'sat',          label: 'Sắt' },
  { id: 'daySon',       label: 'Dây/Sơn' },
  { id: 'vatTuPhuKien', label: 'Phụ kiện' },
  { id: 'baoBiDongGoi', label: 'Bao bì' },
  { id: 'thanhPham',    label: 'Thành phẩm' },
  { id: 'manh',         label: 'Mảnh' },
]

const MOCK_MANH: FlatItem[] = [
  { key: 'm-1-1', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-02T00:00:00Z', productName: 'Ghế xoay văn phòng',  productCode: 'GX-001', poNumber: 'PO-2501', cat: 'manh', name: 'Sắt hộp 20×20',    spec: 'Mảnh tựa lưng · 20×20×1.2mm',   unit: null, qty: '4',  createdAt: null },
  { key: 'm-1-2', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-02T00:00:00Z', productName: 'Ghế xoay văn phòng',  productCode: 'GX-001', poNumber: 'PO-2501', cat: 'manh', name: 'Sắt tấm 1.5mm',    spec: 'Mảnh tựa lưng · 300×500×1.5mm',  unit: null, qty: '2',  createdAt: null },
  { key: 'm-1-3', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-02T00:00:00Z', productName: 'Ghế xoay văn phòng',  productCode: 'GX-001', poNumber: 'PO-2501', cat: 'manh', name: 'Sắt hộp 25×25',    spec: 'Mảnh ngồi · 25×25×1.5mm',        unit: null, qty: '4',  createdAt: null },
  { key: 'm-1-4', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-02T00:00:00Z', productName: 'Ghế xoay văn phòng',  productCode: 'GX-001', poNumber: 'PO-2501', cat: 'manh', name: 'Sắt tấm 2mm',      spec: 'Mảnh ngồi · 450×450×2mm',        unit: null, qty: '1',  createdAt: null },
  { key: 'm-1-5', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-02T00:00:00Z', productName: 'Ghế xoay văn phòng',  productCode: 'GX-001', poNumber: 'PO-2501', cat: 'manh', name: 'Sắt ống fi 32',     spec: 'Chân ghế · fi32×1.5mm dài 450mm',unit: null, qty: '5',  createdAt: null },
  { key: 'm-2-1', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-04T00:00:00Z', productName: 'Ghế ăn cao cấp',       productCode: 'GA-004', poNumber: 'PO-2504', cat: 'manh', name: 'Sắt hộp 30×30',    spec: 'Khung ghế · 30×30×1.5mm',        unit: null, qty: '4',  createdAt: null },
  { key: 'm-2-2', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-04T00:00:00Z', productName: 'Ghế ăn cao cấp',       productCode: 'GA-004', poNumber: 'PO-2504', cat: 'manh', name: 'Thanh ngang fi 20', spec: 'Khung ghế · fi20×1.2mm dài 380mm',unit: null, qty: '6',  createdAt: null },
  { key: 'm-2-3', pfId: 0, pfStatus: 'APPROVED_PARTS', pfCreatedAt: '2025-12-04T00:00:00Z', productName: 'Ghế ăn cao cấp',       productCode: 'GA-004', poNumber: 'PO-2504', cat: 'manh', name: 'Sắt tấm 1.2mm',    spec: 'Mặt ngồi · 400×400×1.2mm',       unit: null, qty: '1',  createdAt: null },
  { key: 'm-3-1', pfId: 0, pfStatus: 'WAITING_PARTS',  pfCreatedAt: '2025-12-08T00:00:00Z', productName: 'Bàn làm việc L',       productCode: 'BV-003', poNumber: 'PO-2503', cat: 'manh', name: 'Sắt hộp 40×40',    spec: 'Chân bàn · 40×40×2mm dài 730mm', unit: null, qty: '4',  createdAt: null },
  { key: 'm-3-2', pfId: 0, pfStatus: 'WAITING_PARTS',  pfCreatedAt: '2025-12-08T00:00:00Z', productName: 'Bàn làm việc L',       productCode: 'BV-003', poNumber: 'PO-2503', cat: 'manh', name: 'Sắt hộp 30×60',    spec: 'Thanh dọc · 30×60×1.5mm',        unit: null, qty: '3',  createdAt: null },
]

const MOCK_THANH_PHAM: FlatItem[] = [
  { key: 'tp-1', pfId: 0, pfStatus: 'APPROVED', pfCreatedAt: '2025-12-01T00:00:00Z', productName: 'Ghế xoay văn phòng',  productCode: 'GX-001', poNumber: 'TP-2501', cat: 'thanhPham', name: 'Ghế xoay lưới thoáng khí',          spec: 'Màu đen, có tay vịn',        unit: 'cái', qty: '50',  createdAt: '2025-12-01T08:00:00Z' },
  { key: 'tp-2', pfId: 0, pfStatus: 'APPROVED', pfCreatedAt: '2025-12-03T00:00:00Z', productName: 'Ghế sofa phòng khách', productCode: 'SF-002', poNumber: 'TP-2502', cat: 'thanhPham', name: 'Sofa 3 chỗ khung thép',              spec: 'Vải nhung xanh navy',         unit: 'bộ',  qty: '20',  createdAt: '2025-12-03T10:30:00Z' },
  { key: 'tp-3', pfId: 0, pfStatus: 'PROPOSED', pfCreatedAt: '2025-12-05T00:00:00Z', productName: 'Bàn làm việc L',       productCode: 'BV-003', poNumber: 'TP-2503', cat: 'thanhPham', name: 'Bàn L chân sắt mặt gỗ MDF',        spec: 'MDF 18mm, sơn trắng',         unit: 'cái', qty: '30',  createdAt: '2025-12-05T09:00:00Z' },
  { key: 'tp-4', pfId: 0, pfStatus: 'APPROVED', pfCreatedAt: '2025-12-07T00:00:00Z', productName: 'Ghế ăn cao cấp',       productCode: 'GA-004', poNumber: 'TP-2504', cat: 'thanhPham', name: 'Ghế ăn khung inox nệm da',         spec: 'Da PU đen, chân inox 201',    unit: 'cái', qty: '100', createdAt: '2025-12-07T14:00:00Z' },
  { key: 'tp-5', pfId: 0, pfStatus: 'PROPOSED', pfCreatedAt: '2025-12-10T00:00:00Z', productName: 'Kệ đa năng',           productCode: 'KD-005', poNumber: 'TP-2505', cat: 'thanhPham', name: 'Kệ 5 tầng khung thép sơn tĩnh điện', spec: 'Màu trắng, 60×30×180cm',   unit: 'cái', qty: '15',  createdAt: '2025-12-10T11:00:00Z' },
  { key: 'tp-6', pfId: 0, pfStatus: 'APPROVED', pfCreatedAt: '2025-12-12T00:00:00Z', productName: 'Giường ngủ đơn',       productCode: 'GN-006', poNumber: 'TP-2506', cat: 'thanhPham', name: 'Giường sắt đơn sơn tĩnh điện',    spec: 'Kích thước 90×200cm, trắng', unit: 'cái', qty: '25',  createdAt: '2025-12-12T08:30:00Z' },
]

export default function VatTuDashboardPage({ limitCats }: { limitCats?: Cat[] } = {}) {
  const { data: planForms = [], isLoading } = useFetch(() => api.getPlanForms(), [])
  const [approvals, setApprovals] = useState<Record<string, ApprovalEntry>>({})
  const [selected, setSelected] = useState<FlatItem | null>(null)
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [filterCat, setFilterCat] = useState<Cat | 'all'>(limitCats?.[0] ?? 'all')
  const [q, setQ] = useState('')
  const [selectedManhPo, setSelectedManhPo] = useState<string | null>(null)

  const allItems = [...flattenItems((planForms ?? []) as PlanForm[]), ...MOCK_MANH, ...MOCK_THANH_PHAM]
    .filter(it => !limitCats || limitCats.includes(it.cat))

  const [mockSeeded, setMockSeeded] = useState(false)
  useEffect(() => {
    if (allItems.length === 0 || mockSeeded) return
    const CYCLE = [
      { status: 'APPROVED' as const },
      { status: 'APPROVED' as const },
      { status: 'PROPOSED' as const },
      { status: 'REJECTED' as const, reason: 'Không đủ tồn kho' },
      { status: 'APPROVED' as const },
      { status: 'PROPOSED' as const },
      { status: 'REJECTED' as const, reason: 'Sai quy cách, cần xem lại' },
      { status: 'APPROVED' as const },
      { status: 'PROPOSED' as const },
      { status: 'APPROVED' as const },
    ]
    const seed: Record<string, ApprovalEntry> = {}
    allItems.forEach((item, i) => {
      const c = CYCLE[i % CYCLE.length]
      if (c.status !== 'PROPOSED') seed[item.key] = c
    })
    setApprovals(seed)
    setMockSeeded(true)
  }, [allItems.length])

  const items = allItems.filter(it => {
    const matchCat = filterCat === 'all' || it.cat === filterCat
    const kw = q.trim().toLowerCase()
    const matchQ = !kw ||
      it.name.toLowerCase().includes(kw) ||
      (it.spec ?? '').toLowerCase().includes(kw) ||
      it.productName.toLowerCase().includes(kw) ||
      it.productCode.toLowerCase().includes(kw) ||
      it.poNumber.toLowerCase().includes(kw)
    return matchCat && matchQ
  })

  const approve = (key: string) => {
    setApprovals(p => ({ ...p, [key]: { status: 'APPROVED' } }))
    setShowRejectInput(false)
  }
  const confirmReject = (key: string) => {
    setApprovals(p => ({ ...p, [key]: { status: 'REJECTED', reason: rejectReason.trim() || undefined } }))
    setShowRejectInput(false)
    setRejectReason('')
  }

  const openDetail = (item: FlatItem) => {
    setSelected(item)
    setShowRejectInput(false)
    setRejectReason('')
  }

  const selectedApproval = selected ? (approvals[selected.key] ?? null) : null

  const manhGroups = (() => {
    if (filterCat !== 'manh') return [] as { poNumber: string; productCode: string; productName: string; pfStatus: string; pfId: number }[]
    const seen = new Map<string, { poNumber: string; productCode: string; productName: string; pfStatus: string; pfId: number }>()
    items.forEach(it => {
      if (!seen.has(it.poNumber)) seen.set(it.poNumber, { poNumber: it.poNumber, productCode: it.productCode, productName: it.productName, pfStatus: it.pfStatus, pfId: it.pfId })
    })
    return Array.from(seen.values())
  })()
  const manhDetailItems = selectedManhPo ? items.filter(it => it.poNumber === selectedManhPo) : []
  const manhGroupInfo = selectedManhPo ? (manhGroups.find(g => g.poNumber === selectedManhPo) ?? null) : null

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Danh sách chi tiết/vật tư đã được đăng ký</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          Tổng số lượng {allItems.length}
        </p>
      </div>

      <>
      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTER_TABS.filter(ft => ft.id === 'all' ? !limitCats : (!limitCats || limitCats.includes(ft.id))).map(ft => {
            const active = filterCat === ft.id
            const meta = ft.id !== 'all' ? CAT_META[ft.id] : null
            return (
              <button
                key={ft.id}
                onClick={() => { setFilterCat(ft.id); setSelectedManhPo(null) }}
                style={{
                  padding: '6px 14px', fontSize: 12, fontWeight: active ? 700 : 500,
                  borderRadius: 20, border: active ? 'none' : '1px solid var(--border)',
                  cursor: 'pointer',
                  background: active ? (meta?.bg ?? '#f1f5f9') : 'var(--surface)',
                  color: active ? (meta?.color ?? '#334155') : 'var(--text2)',
                }}
              >{ft.label}</button>
            )
          })}
        </div>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tìm tên vật tư, sản phẩm, PO…"
            style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : filterCat !== 'manh' ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 160 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 72 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Loại</th>
                <th style={thStyle}>Tên vật tư</th>
                <th style={thStyle}>Quy cách</th>
                <th style={thStyle}>ĐVT</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>SL</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const meta = CAT_META[item.cat]
                return (
                  <tr key={item.key} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.spec ?? '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: 'var(--text2)' }}>{item.unit ?? '—'}</td>
                    <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }}>{item.qty ?? '—'}</td>
                  </tr>
                )
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    {q.trim() || filterCat !== 'all' ? 'Không tìm thấy vật tư phù hợp' : 'Không có vật tư nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : selectedManhPo === null ? (
        /* ── Mảnh: PO list ─────────────────────────────────────────────── */
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 110 }} />
              <col />
              <col style={{ width: 110 }} />
              <col style={{ width: 130 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>PO</th>
                <th style={thStyle}>SKU</th>
                <th style={thStyle}>Hạn giao</th>
                <th style={thStyle}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {manhGroups.map(g => {
                const deliveryDate = g.pfId === 0
                  ? (MOCK_MANH_DELIVERY[g.poNumber] ?? null)
                  : ((planForms ?? []) as PlanForm[]).find(pf => pf.id === g.pfId)?.exportOrder?.deliveryDate ?? null
                const st = MANH_STATUS_MAP[g.pfStatus] ?? MANH_STATUS_MAP.PROPOSED
                return (
                  <tr
                    key={g.poNumber}
                    onClick={() => setSelectedManhPo(g.poNumber)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{g.poNumber}</td>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.productCode}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.productName}</div>
                    </td>
                    <td style={{ ...tdStyle, color: deliveryDate ? 'var(--text)' : 'var(--text3)' }}>
                      {deliveryDate ? format(new Date(deliveryDate), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: st.color, background: st.bg }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {manhGroups.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không tìm thấy dữ liệu mảnh</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Mảnh: detail items for selected PO ────────────────────────── */
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => setSelectedManhPo(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text2)' }}
            >
              <ChevronLeft size={14} /> Quay lại
            </button>
            <div>
              <span style={{ fontWeight: 700 }}>{manhGroupInfo?.productCode}</span>
              <span style={{ color: 'var(--text3)', marginLeft: 6 }}>{manhGroupInfo?.productName}</span>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text3)' }}>· PO: {selectedManhPo}</span>
            </div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col />
                <col style={{ width: 75 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 125 }} />
              </colgroup>
              <thead>
                <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                  <th style={thStyle}>Loại</th>
                  <th style={thStyle}>Tên mảnh</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Số lượng</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Đã chuyền kiểm</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Chưa chuyền kiểm</th>
                </tr>
              </thead>
              <tbody>
                {manhDetailItems.map(item => {
                  const meta = CAT_META[item.cat]
                  const qtyNum = parseInt(item.qty ?? '0', 10) || 0
                  const chua = mockChuaChuyenKiem(item.key, qtyNum)
                  const da = qtyNum - chua
                  return (
                    <tr key={item.key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600 }}>{item.qty ?? '—'}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{da}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 600, color: chua > 0 ? '#d97706' : 'var(--text3)' }}>{chua}</td>
                    </tr>
                  )
                })}
                {manhDetailItems.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có mảnh nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      </>

      {/* Detail drawer */}
      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div style={{ background: 'var(--surface)', width: 360, overflow: 'auto', padding: 24, boxShadow: '-4px 0 32px rgba(0,0,0,.14)', display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20, color: CAT_META[selected.cat].color, background: CAT_META[selected.cat].bg }}>
                {CAT_META[selected.cat].label}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4 }}>
                <X size={18} color="var(--text3)" />
              </button>
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{selected.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{selected.spec ?? '—'}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <InfoRow label="ĐVT" value={selected.unit ?? '—'} />
              <InfoRow label="Số lượng" value={selected.qty ?? '—'} />
              {selected.createdAt && (
                <InfoRow label="Thời gian nhập" value={format(new Date(selected.createdAt), 'HH:mm · dd/MM/yyyy')} />
              )}
            </div>

            {selected.pfId > 0 && (
              <div style={{ background: 'var(--surface2)', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                  Định mức #{selected.pfId}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <InfoRow label="Sản phẩm" value={`${selected.productCode} — ${selected.productName}`} />
                  <InfoRow label="Mã lệnh SX" value={selected.poNumber} />
                  <InfoRow label="Ngày tạo" value={format(new Date(selected.pfCreatedAt), 'dd/MM/yyyy')} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                    <span style={{ color: 'var(--text3)' }}>Trạng thái</span>
                    <StatusBadge status={selected.pfStatus} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
                Duyệt vật tư
              </div>

              {selectedApproval && (
                <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 8, background: selectedApproval.status === 'APPROVED' ? '#dcfce7' : '#fee2e2' }}>
                  <StatusBadge status={selectedApproval.status} />
                  {selectedApproval.reason && (
                    <div style={{ marginTop: 5, fontSize: 12, color: '#dc2626', fontStyle: 'italic' }}>{selectedApproval.reason}</div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => approve(selected.key)}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedApproval?.status === 'APPROVED' ? '#16a34a' : 'rgba(22,163,74,0.12)',
                    color: selectedApproval?.status === 'APPROVED' ? '#fff' : '#16a34a',
                  }}
                >Duyệt</button>
                <button
                  onClick={() => { setShowRejectInput(v => !v); setRejectReason('') }}
                  style={{
                    flex: 1, padding: '9px 0', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: selectedApproval?.status === 'REJECTED' ? '#dc2626' : 'rgba(220,38,38,0.10)',
                    color: selectedApproval?.status === 'REJECTED' ? '#fff' : '#dc2626',
                  }}
                >Từ chối</button>
              </div>

              {showRejectInput && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Lý do từ chối (không bắt buộc)..."
                    rows={3}
                    autoFocus
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      onClick={() => { setShowRejectInput(false); setRejectReason('') }}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer' }}
                    >Hủy</button>
                    <button
                      onClick={() => confirmReject(selected.key)}
                      style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                    >Xác nhận</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties = { padding: '12px 16px' }

'use client'
import { useState } from 'react'
import { format } from 'date-fns'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { Loader2, X, Search } from 'lucide-react'
import type { Sku } from '../../../types/sku'
import { flattenManhSteel, combinedDaySon, dinhItems } from '../../../utils/manhMaterials'
import type { BePackagingIssuePlanItem } from '../../../services/packaging-issues-api'

const CAT_META = {
  sat:              { label: 'Sắt',              color: '#b45309', bg: '#fef3c7' },
  daySon:           { label: 'Dây/Sơn',          color: '#0369a1', bg: '#e0f2fe' },
  dinh:             { label: 'Đinh',             color: '#0e7490', bg: '#cffafe' },
  vatTuPhuKien:     { label: 'Phụ kiện',         color: '#7c3aed', bg: '#ede9fe' },
  baoBiDongGoi:     { label: 'Bao bì',           color: '#be185d', bg: '#fce7f3' },
  thanhPham:        { label: 'Thành phẩm',       color: '#1e40af', bg: '#dbeafe' },
  vatTuThanhPham:   { label: 'VTTP', color: '#0f766e', bg: '#ccfbf1' },
  // Tồn kho khung THẬT (mfgWarehouseItems, tên "Khung ...") theo trạng thái đan.
  manhChuaDan:      { label: 'Mảnh chưa đan',    color: '#92400e', bg: '#fef3c7' },
  manhDaDan:        { label: 'Mảnh đã đan',      color: '#166534', bg: '#dcfce7' },
} as const

export type Cat = keyof typeof CAT_META

interface FlatItem {
  key: string
  /** string = Sku.id thật; literal 0 = dòng không gắn với 1 Sku cụ thể (vd tổng hợp theo PO/vật
   *  tư — xem vatTuThanhPhamItems bên dưới) — phân biệt bằng typeof, không dùng so sánh số nữa. */
  pfId: string | 0
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

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PROPOSED: { label: 'Chờ duyệt', color: '#d97706', bg: '#fef3c7' },
  APPROVED: { label: 'Đã duyệt',  color: '#16a34a', bg: '#dcfce7' },
  REJECTED: { label: 'Từ chối',   color: '#dc2626', bg: '#fee2e2' },
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

/** Bảng tồn kho khung THẬT (mfgWarehouseItems) cho 2 tab "Mảnh chưa đan"/"Mảnh đã đan".
 * Thuần hiển thị — việc chuyển trạng thái đan diễn ra qua Xuất đan/Nhập đan, không thao tác ở đây. */
function ManhStockTable({ rows }: { rows: any[] }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
        <colgroup>
          <col /><col style={{ width: 100 }} /><col style={{ width: 90 }} />
        </colgroup>
        <thead>
          <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
            <th style={thStyle}>Tên khung</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Số lượng</th>
            <th style={thStyle}>ĐVT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.id} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</td>
              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{r.quantity}</td>
              <td style={{ ...tdStyle, color: 'var(--text3)' }}>{r.unit}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Không có mảnh nào</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function pushItems(items: FlatItem[], pf: Sku, cat: Cat, arr: any[]) {
  const base = {
    pfId: pf.id,
    pfStatus: pf.status,
    pfCreatedAt: pf.createdAt,
    productName: pf.mfgProduct?.name ?? '—',
    productCode: pf.mfgProduct?.factoryCode ?? '—',
    poNumber: pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng',
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

function flattenItems(skus: Sku[]): FlatItem[] {
  const items: FlatItem[] = []
  for (const pf of skus) {
    const base = {
      pfId: pf.id,
      pfStatus: pf.status,
      pfCreatedAt: pf.createdAt,
      productName: pf.mfgProduct?.name ?? '—',
      productCode: pf.mfgProduct?.factoryCode ?? '—',
      poNumber: pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng',
    }
    const mt = pf.quotaManagement?.materialType
    pushItems(items, pf, 'sat', flattenManhSteel(pf))
    pushItems(items, pf, 'daySon', combinedDaySon(pf))
    pushItems(items, pf, 'dinh', dinhItems(pf))
    if (mt) {
      if (Array.isArray(mt.vatTuPhuKien))  pushItems(items, pf, 'vatTuPhuKien', mt.vatTuPhuKien)
      if (Array.isArray(mt.baoBiDongGoi))  pushItems(items, pf, 'baoBiDongGoi', mt.baoBiDongGoi)
    }
  }
  return items
}

const FILTER_TABS: { id: Cat | 'all'; label: string }[] = [
  { id: 'all',            label: 'Tất cả' },
  { id: 'sat',            label: 'Sắt' },
  { id: 'daySon',         label: 'Dây/Sơn' },
  { id: 'dinh',           label: 'Đinh' },
  { id: 'vatTuPhuKien',   label: 'Phụ kiện' },
  { id: 'baoBiDongGoi',   label: 'Bao bì' },
  { id: 'vatTuThanhPham', label: 'Vật tư thành phẩm' },
  { id: 'thanhPham',      label: 'Thành phẩm' },
  { id: 'manhChuaDan',    label: 'Mảnh chưa đan' },
  { id: 'manhDaDan',      label: 'Mảnh đã đan' },
]

// "Vật tư thành phẩm" (tem nhãn, màng PE, mút xốp...) đã xuất thật từ kho vat-tu-tp — nguồn
// PackagingIssue + BomAccessoryItem(kind=PACKAGING) qua api.getPackagingIssuePlan() (module
// `packaging-issues` BE, cùng nguồn WarehouseXuatPage.tsx scope 'vat-tu-tp' dùng để xuất) — xem
// buildVatTuThanhPhamItems() bên dưới, không còn mock.

// "Thành phẩm" = số lượng đã đóng gói thật (PackagingRecord, cùng nguồn KhoDongGoiPage.tsx dùng
// qua api.getPackaging()) — xem buildThanhPhamItems() bên dưới, không còn mock.

export default function VatTuDashboardPage({ limitCats, combinedCats, manhWarehouseCode }: { limitCats?: Cat[]; combinedCats?: { id: string; label: string; cats: Cat[] }[]; manhWarehouseCode?: string } = {}) {
  const { data: skus = [], isLoading } = useFetch(() => api.getSkus(), [])
  // "Thành phẩm" = SKU nào đã đóng gói thật (PackagingRecord qua api.getPackaging(), cùng nguồn
  // KhoDongGoiPage.tsx dùng) — thay MOCK_THANH_PHAM cũ, chỉ hiện SKU có packedQty > 0.
  const { data: thanhPhamProgress } = useFetch<{ pf: Sku; packedQty: number }[]>(
    () => Promise.all(((skus ?? []) as Sku[]).map(async pf => ({ pf, packedQty: (await api.getPackaging(pf)).packedQty }))),
    [skus],
  )
  const thanhPhamItems: FlatItem[] = (thanhPhamProgress ?? [])
    .filter(({ packedQty }) => packedQty > 0)
    .map(({ pf, packedQty }) => ({
      key: `tp-${pf.id}`,
      pfId: pf.id,
      pfStatus: pf.status,
      pfCreatedAt: pf.createdAt,
      productName: pf.mfgProduct?.name ?? '—',
      productCode: pf.mfgProduct?.factoryCode ?? '—',
      poNumber: pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng',
      cat: 'thanhPham',
      name: pf.mfgProduct?.name ?? '—',
      spec: null,
      unit: 'cái',
      qty: String(packedQty),
      createdAt: pf.createdAt,
    }))

  // "Vật tư thành phẩm" = đã xuất thật qua kho vat-tu-tp (PackagingIssue), gộp mọi PO đang chạy —
  // cùng nguồn/cách gọi WarehouseXuatPage.tsx scope 'vat-tu-tp' dùng (listProductionOrdersForStage
  // + getPackagingIssuePlan), thay MOCK_VAT_TU_THANH_PHAM cũ. Chỉ hiện dòng đã xuất (issuedQty > 0).
  const { data: packagingPlan } = useFetch<BePackagingIssuePlanItem[]>(async () => {
    const summaries = await api.listProductionOrdersForStage()
    if (summaries.length === 0) return []
    return api.getPackagingIssuePlan(summaries.map(o => o.id))
  }, [])
  const vatTuThanhPhamItems: FlatItem[] = (packagingPlan ?? [])
    .filter(item => item.issuedQty > 0)
    .map(item => ({
      key: `vttp-${item.productionOrderId}-${item.materialId}`,
      pfId: 0,
      pfStatus: '',
      pfCreatedAt: '',
      productName: item.productName,
      productCode: item.materialCode,
      poNumber: item.poNumber,
      cat: 'vatTuThanhPham',
      name: item.materialName,
      spec: item.materialCode,
      unit: item.materialUnit,
      qty: String(item.issuedQty),
      createdAt: null,
    }))

  const [selected, setSelected] = useState<FlatItem | null>(null)
  const [filterCat, setFilterCat] = useState<string>(() => {
    if (combinedCats?.length) {
      const first = limitCats?.[0]
      const combined = first ? combinedCats.find(c => c.cats.includes(first)) : null
      if (combined) return combined.id
    }
    return limitCats?.[0] ?? 'all'
  })
  const [q, setQ] = useState('')

  // Kho phôi sơn hàn: "Mảnh chưa đan" = tồn kho khung THẬT (mfgWarehouseItems) vừa sản xuất xong,
  // chưa chuyển nội bộ sang vật tư thành phẩm — đây là chuyển kho vật lý thật (WarehouseTransfer),
  // không đi qua bảng theo dõi xuất/nhập đan nên vẫn đọc trực tiếp tồn kho như trước.
  const { data: manhWarehouses } = useFetch<any[]>(() => manhWarehouseCode === 'phoi-son-han' ? (api as any).getMfgWarehouses() : Promise.resolve([]), [manhWarehouseCode])
  const manhWarehouseId: number | null = manhWarehouseCode === 'phoi-son-han' ? ((manhWarehouses ?? []).find((w: any) => w.code === manhWarehouseCode)?.id ?? null) : null
  const { data: manhStockItems } = useFetch<any[]>(
    () => manhWarehouseId != null ? (api as any).getMfgWarehouseItems(manhWarehouseId) : Promise.resolve([]),
    [manhWarehouseId]
  )
  const manhChuaDanRowsPhoiSonHan = (manhStockItems ?? [])
    .filter((it: any) => /^khung\s/i.test(it.name ?? '') && (it.manhStatus ?? 'chua-dan') === 'chua-dan' && (it.quantity ?? 0) > 0)

  // Vật tư thành phẩm ("Mảnh chưa đan" = còn lại chưa xuất đan) và kho thành phẩm ("Mảnh đã đan" =
  // đã nhận qua nhập đan) — thống nhất đọc CHUNG nguồn với "Theo dõi xuất/nhập đan" (manhOrders) thay
  // vì tồn kho rời rạc, để 2 màn hình luôn khớp số với nhau (đúng bản chất: đây không phải tồn kho
  // vật lý riêng mà là luỹ kế xuất/nhập đan theo từng PO).
  const { data: manhOrdersData } = useFetch<any[]>(
    () => (manhWarehouseCode === 'vat-tu-tp' || manhWarehouseCode === 'thanh-pham') ? (api as any).getManhOrders() : Promise.resolve([]),
    [manhWarehouseCode]
  )
  const { data: manhWeavingPoints } = useFetch<any[]>(
    () => manhWarehouseCode === 'thanh-pham' ? (api as any).getWeavingPoints() : Promise.resolve([]),
    [manhWarehouseCode]
  )
  const manhPointLabel = (id: number) => {
    const p = (manhWeavingPoints ?? []).find((w: any) => w.id === id)
    return p?.fullName ?? p?.name ?? `#${id}`
  }
  const manhChuaDanRowsVatTuTp = manhWarehouseCode === 'vat-tu-tp'
    ? (manhOrdersData ?? []).flatMap((o: any) => o.skus.flatMap((sku: any) => sku.lines
        .filter((l: any) => l.tonThuc > 0)
        .map((l: any) => ({ id: l.id, name: `${l.name} — ${o.poCode}/${sku.piCode}`, unit: l.unit, quantity: l.tonThuc }))))
    : []
  const manhDaDanRows = manhWarehouseCode === 'thanh-pham'
    ? (manhOrdersData ?? []).flatMap((o: any) => o.skus.flatMap((sku: any) => sku.lines.flatMap((l: any) =>
        (l.allocations ?? [])
          .filter((a: any) => a.nhapQty > 0)
          .map((a: any) => ({ id: a.id, name: `${l.name} — ${o.poCode}/${sku.piCode} (${manhPointLabel(a.weavingPointId)})`, unit: l.unit, quantity: a.nhapQty }))
      )))
    : []
  const manhChuaDanRows = manhWarehouseCode === 'phoi-son-han' ? manhChuaDanRowsPhoiSonHan : manhChuaDanRowsVatTuTp

  const activeCats = (() => {
    if (filterCat === 'all') return new Set<string>(limitCats ?? Object.keys(CAT_META))
    const combined = combinedCats?.find(c => c.id === filterCat)
    if (combined) return new Set<string>(combined.cats)
    return new Set<string>([filterCat])
  })()
  const isManhChuaDan = activeCats.size === 1 && activeCats.has('manhChuaDan')
  const isManhDaDan = activeCats.size === 1 && activeCats.has('manhDaDan')

  const allItems = [...flattenItems((skus ?? []) as Sku[]), ...thanhPhamItems, ...vatTuThanhPhamItems]
    .filter(it => !limitCats || limitCats.includes(it.cat))

  const items = allItems.filter(it => {
    const matchCat = activeCats.has(it.cat)
    const kw = q.trim().toLowerCase()
    const matchQ = !kw ||
      it.name.toLowerCase().includes(kw) ||
      (it.spec ?? '').toLowerCase().includes(kw) ||
      it.productName.toLowerCase().includes(kw) ||
      it.productCode.toLowerCase().includes(kw) ||
      it.poNumber.toLowerCase().includes(kw)
    return matchCat && matchQ
  })

  const openDetail = (item: FlatItem) => {
    setSelected(item)
  }

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
          {(() => {
            // Build visible tabs: replace cats covered by combinedCats with the merged tab
            const coveredCats = new Set(combinedCats?.flatMap(c => c.cats as string[]) ?? [])
            const seenCombined = new Set<string>()
            const tabs: { id: string; label: string }[] = []
            FILTER_TABS.filter(ft => ft.id === 'all' ? !limitCats : (!limitCats || limitCats.includes(ft.id as Cat)))
              .forEach(ft => {
                if (coveredCats.has(ft.id)) {
                  const combined = combinedCats!.find(c => c.cats.includes(ft.id as Cat))!
                  if (!seenCombined.has(combined.id)) { tabs.push(combined); seenCombined.add(combined.id) }
                } else {
                  tabs.push(ft)
                }
              })
            return tabs
          })().map(ft => {
            const active = filterCat === ft.id
            const meta = CAT_META[ft.id as Cat] ?? null
            return (
              <button
                key={ft.id}
                onClick={() => setFilterCat(ft.id as string)}
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
      ) : isManhChuaDan || isManhDaDan ? (
        <ManhStockTable
          rows={isManhChuaDan ? manhChuaDanRows : manhDaDanRows}
        />
      ) : (
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
                  <tr
                    key={item.key}
                    onClick={() => openDetail(item)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
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

            {typeof selected.pfId === 'string' && (
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
          </div>
        </div>
      )}

    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties = { padding: '12px 16px' }

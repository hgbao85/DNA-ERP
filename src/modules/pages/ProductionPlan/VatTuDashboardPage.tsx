'use client'
import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Loader2, Search, X } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeMaterial } from '../../../services/materials-api'
import type { BeWarehouse } from '../../../services/warehouses-api'
import type { BeStockQuant } from '../../../services/stock-api'
import { warehouseFamilyOf } from '../../../utils/warehouseFamily'
import { useIsMobile } from '../../../hooks/useMediaQuery'

const UNGROUPED = '__ungrouped__'

// Nhóm vật tư là danh mục ĐỘNG do Admin tự tạo (Admin > Danh mục > Nhóm vật tư) — không map cứng
// theo tên như bản cũ (CAT_META cố định 1 bộ category), nên tô màu badge tuần hoàn theo key.
const GROUP_PALETTE = [
  { color: '#b45309', bg: '#fef3c7' },
  { color: '#0369a1', bg: '#e0f2fe' },
  { color: '#0e7490', bg: '#cffafe' },
  { color: '#7c3aed', bg: '#ede9fe' },
  { color: '#be185d', bg: '#fce7f3' },
  { color: '#166534', bg: '#dcfce7' },
  { color: '#1e40af', bg: '#dbeafe' },
]
function colorFor(key: string) {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  return GROUP_PALETTE[hash % GROUP_PALETTE.length]
}

function groupKeyOf(m: BeMaterial): string {
  return m.materialGroupId != null ? String(m.materialGroupId) : UNGROUPED
}

/** 1 dòng hiển thị trên bảng - thường = 1 vật tư, nhưng ở kho phôi-sơn-hàn (showLengthColumn) có
 *  thể tách thành NHIỀU dòng cho ĐÚNG 1 vật tư (1 dòng/bucket chiều dài còn tồn thật). */
interface DisplayRow {
  key: string
  material: BeMaterial
  stockLengthMm: number | null
  qty: number | null
  availableQty: number | null
}

interface Props {
  /** Mã kho CHÍNH XÁC (Warehouse.code, vd 'phoi-son-han', 'thanh-pham-1788485485362') đang xem —
   *  dùng để tra TỒN KHO (StockQuant) đúng 1 instance cụ thể, vì các kho cùng "họ" hoạt động độc
   *  lập, số liệu KHÔNG gộp vào nhau. Bỏ trống = xem toàn bộ mọi kho (Boss/Tổng kho). */
  warehouseCode?: string
}

/** "Tổng hợp vật tư" — liệt kê thẳng danh mục Vật tư (Material, tạo ở Admin > Vật tư) kèm tồn
 *  kho thật (StockQuant), KHÔNG suy ra từ hoạt động sản xuất/xuất-nhập như bản trước.
 *
 * 2 khái niệm KHÁC NHAU, đừng gộp làm 1 (đúng pattern QLSX "Chọn kho thành phẩm" lúc duyệt lệnh SX
 * + PackagingIssuesService đang dùng - warehouseFamilyOf() định tuyến phạm vi, KHÔNG gộp số):
 * - DANH MỤC vật tư nào dùng được ở đây: Material.warehouseId hầu như luôn trỏ về kho GỐC của 1
 *   họ (Admin cấu hình 1 lần, không đổi theo instance) - nên phải so khớp theo HỌ kho
 *   (warehouseFamilyOf) để "Kho thành phẩm 2" thấy ĐÚNG danh mục vật tư như "Kho thành phẩm" gốc.
 * - SỐ LƯỢNG tồn kho: StockQuant tách riêng theo ĐÚNG 1 warehouseId cụ thể (instance thật ghi
 *   nhận khi xuất/nhập) - so khớp tuyệt đối, không gộp theo họ. */
export default function VatTuDashboardPage({ warehouseCode }: Props = {}) {
  const { data: warehouses } = useFetch<BeWarehouse[]>(() => api.getWarehouses(), [])
  const warehousesLoaded = warehouses != null
  const currentWarehouse = warehouseCode ? (warehouses ?? []).find(w => w.code === warehouseCode) ?? null : null

  const { data: materials, isLoading: materialsLoading } = useFetch<BeMaterial[]>(() => api.getMaterials(), [])

  // Chỉ tra tồn kho ĐÚNG kho đang xem (không gộp theo họ) — bỏ trống = lấy hết mọi kho (view Boss).
  const quantScopeId = currentWarehouse?.id
  const { data: quants } = useFetch<BeStockQuant[]>(
    () => api.getStockQuants(quantScopeId ? { warehouseId: quantScopeId } : undefined),
    [quantScopeId],
  )
  // Khoá GHÉP (materialId:warehouseId), KHÔNG chỉ materialId - GET /stock-quant không scope trả
  // về MỌI dòng (materialId, warehouseId) từng có phát sinh, kể cả các kho ẢO đối ứng bút toán kép
  // (SUPPLIER/PRODUCTION/SCRAP - luôn âm vì hàng luôn CHẢY RA khỏi kho ảo). Khoá đơn theo
  // materialId sẽ bị 1 trong các dòng ảo đó ghi đè ngẫu nhiên lên dòng tồn kho thật (bug thật đã
  // gặp: Boss/KHSX/QLSX xem không-scope thấy "Tồn kho" âm) - cùng pattern composite key
  // MaterialsPage.tsx (Admin > Vật tư) đã dùng cho quantByMaterialId ở đó.
  //
  // PHẢI CỘNG DỒN (không phải lấy dòng cuối) - vật tư Sắt có thể có NHIỀU dòng stock_quant cho
  // ĐÚNG 1 cặp (warehouseId, materialId) khi tồn tại ở nhiều bucket stockLengthMm khác nhau (cây
  // 6m và cây 4m là 2 lô RIÊNG, xem migration 20260829072018_stock_length_bucket + trigger
  // fn_sync_stock_quant ON CONFLICT ("warehouseId","materialId","stockLengthMm")) - nhưng
  // StockQuantResponseDto KHÔNG trả field stockLengthMm ra ngoài, nên GET /stock-quant trông như
  // "2 dòng trùng key" chứ không lộ ra là 2 bucket khác nhau. Nếu chỉ lấy dòng cuối (như
  // MaterialsPage.tsx Admin đang làm - CÙNG lỗi, chưa sửa ở đó) sẽ ÂM THẦM BÁO THIẾU tồn kho thật
  // cho mọi vật tư Sắt có ≥2 chiều dài cây tồn kho cùng lúc.
  const quantByKey = useMemo(() => {
    const map = new Map<string, { qty: number; availableQty: number }>()
    for (const q of quants ?? []) {
      const key = `${q.materialId}:${q.warehouseId}`
      const acc = map.get(key)
      if (acc) { acc.qty += q.qty; acc.availableQty += q.availableQty }
      else map.set(key, { qty: q.qty, availableQty: q.availableQty })
    }
    return map
  }, [quants])
  // Kho để tra tồn cho 1 dòng vật tư: đang xem 1 instance cụ thể thì luôn tra ĐÚNG instance đó
  // (khớp cách StockQuant được fetch ở trên); xem không-scope (Boss) thì tra đúng kho NHÀ của
  // chính vật tư đó (m.warehouseId, cột "Kho" đang hiện trên dòng).
  const quantFor = (m: BeMaterial) => {
    const wId = currentWarehouse ? currentWarehouse.id : m.warehouseId
    return wId ? quantByKey.get(`${m.id}:${wId}`) : undefined
  }

  // Cột "Chiều dài" CHỈ hiện ở đúng họ kho phôi-sơn-hàn (nơi vật tư Sắt bán theo chiều dài cây
  // "sống" - họ kho khác không có vật tư Sắt nào) - cùng quyết định đã áp dụng cho
  // MfgWarehousesPage.tsx (Quản lý kho) 14/09/2026.
  const showLengthColumn = !!warehouseCode && warehouseFamilyOf(warehouseCode) === 'phoi-son-han'
  // Dòng thô theo materialId (CHƯA cộng dồn) - chỉ dùng khi showLengthColumn để tách 1 dòng/bucket.
  // `quants` đã được fetch ĐÚNG scope currentWarehouse.id ở trên nên không cần lọc lại warehouseId.
  const bucketsByMaterialId = useMemo(() => {
    const map = new Map<string, BeStockQuant[]>()
    for (const q of quants ?? []) {
      if (!q.materialId) continue
      const arr = map.get(q.materialId)
      if (arr) arr.push(q); else map.set(q.materialId, [q])
    }
    return map
  }, [quants])

  // Danh mục vật tư của 1 kho = HỢP của 2 tập (không phải chỉ lọc theo HỌ kho như bản đầu):
  // (a) catalog cùng HỌ kho (Material.warehouseCode) - để vẫn thấy vật tư "thuộc về" kho này dù
  //     chưa hề nhập hàng (tồn = 0).
  // (b) bất kỳ vật tư nào ĐANG THỰC SỰ có StockQuant tại ĐÚNG kho instance này, dù catalog gốc
  //     thuộc họ khác - đây là trường hợp THẬT của chuỗi chuyển kho nội bộ (phôi-sơn-hàn ->
  //     vật-tư-TP -> thành-phẩm): 1 vật tư (vd nhóm "Vật tư thành phẩm") có thể có Material.
  //     warehouseId trỏ về kho gốc phôi-sơn-hàn, nhưng sau khi WarehouseTransfer được xác nhận,
  //     tồn kho THẬT của nó đã nằm ở kho thành-phẩm - nếu chỉ lọc theo họ, vật tư đó "vô hình"
  //     đúng ở kho đang thực sự giữ nó. Phát hiện qua test sống 14/09 (chuyển 100kg DAY-002 sang
  //     Kho thành phẩm, không hiện trong danh sách dù StockQuant đã có dòng thật).
  //
  // (b) chỉ tính khi CÒN TỒN THẬT (qty > 0) - vật tư "khách" (catalog gốc thuộc họ khác) chỉ nên
  // hiện khi đang thực sự có mặt; hết sạch (chuyển đi tiếp/dùng hết) thì biến mất khỏi danh sách
  // của kho này, không để lại dòng "0" rác (khác hẳn vật tư CHÍNH CHỦ ở (a), luôn hiện kể cả 0 vì
  // đó là danh mục thường trực của kho). fn_sync_stock_quant() (DB trigger) không bao giờ xoá dòng
  // stock_quant, chỉ cộng/trừ qty - nên phải tự lọc qty > 0 ở đây, không thể dựa vào "còn dòng hay
  // không" để suy ra "còn hàng hay không".
  const materialsInScope = useMemo(() => {
    const all = materials ?? []
    if (!warehouseCode) return all
    const family = warehouseFamilyOf(warehouseCode)
    if (!family) return []
    const byFamily = all.filter(m => warehouseFamilyOf(m.warehouseCode) === family)
    if (!currentWarehouse) return byFamily
    const alreadyIncluded = new Set(byFamily.map(m => String(m.id)))
    const materialById = new Map(all.map(m => [String(m.id), m]))
    // Đọc materialId + tổng qty ĐÃ CỘNG DỒN qua quantByKey (không lọc trực tiếp trên `quants` thô)
    // - 1 vật tư Sắt có thể có nhiều dòng stock_quant tại đúng kho này (nhiều bucket
    // stockLengthMm), lọc thô sẽ vừa tính sai ngưỡng ">0" (mỗi dòng riêng có thể ít nhưng tổng lại
    // nhiều, hoặc ngược lại) vừa tạo TRÙNG DÒNG cho cùng 1 vật tư trong danh sách.
    const suffix = `:${currentWarehouse.id}`
    const extraFromTransfers = Array.from(quantByKey.entries())
      .filter(([key, acc]) => key.endsWith(suffix) && acc.qty > 0)
      .map(([key]) => key.slice(0, -suffix.length))
      .filter(materialId => materialId !== 'null' && !alreadyIncluded.has(materialId))
      .map(materialId => materialById.get(materialId))
      .filter((m): m is BeMaterial => m != null)
    return [...byFamily, ...extraFromTransfers]
  }, [materials, warehouseCode, currentWarehouse, quantByKey])

  // Tab lọc theo Nhóm vật tư — lấy động từ chính vật tư đang có (materialGroupName BE trả sẵn),
  // không hard-code danh sách nhóm cố định.
  const groupTabs = useMemo(() => {
    const seen = new Map<string, string>()
    for (const m of materialsInScope) {
      const key = groupKeyOf(m)
      if (!seen.has(key)) seen.set(key, m.materialGroupName ?? 'Chưa phân nhóm')
    }
    return Array.from(seen.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'vi'))
  }, [materialsInScope])

  const [filterGroup, setFilterGroup] = useState('all')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<DisplayRow | null>(null)
  const isMobile = useIsMobile()

  const filtered = materialsInScope.filter(m => {
    const matchGroup = filterGroup === 'all' || groupKeyOf(m) === filterGroup
    const kw = q.trim().toLowerCase()
    const matchQ = !kw ||
      m.name.toLowerCase().includes(kw) ||
      m.code.toLowerCase().includes(kw) ||
      (m.spec ?? '').toLowerCase().includes(kw)
    return matchGroup && matchQ
  })

  // 1 dòng/vật tư (bản thường) hoặc 1 dòng/bucket chiều dài còn tồn thật (showLengthColumn) -
  // xem giải thích ở JSDoc DisplayRow.
  const displayRows = useMemo((): DisplayRow[] => {
    if (!showLengthColumn) {
      return filtered.map(m => {
        const quant = quantFor(m)
        return { key: String(m.id), material: m, stockLengthMm: null, qty: quant?.qty ?? null, availableQty: quant?.availableQty ?? null }
      })
    }
    const rows: DisplayRow[] = []
    for (const m of filtered) {
      const buckets = (bucketsByMaterialId.get(String(m.id)) ?? []).filter(b => b.qty !== 0)
      if (buckets.length === 0) {
        // "buckets.length === 0" gộp 2 trường hợp KHÁC NHAU - phải tra lại quantFor() (tổng đã
        // cộng dồn, xem mục 9) để không mất phân biệt "—" (chưa từng phát sinh giao dịch nào) vs
        // "0" (đã từng mua/dùng, các bucket còn lại đều về đúng 0 - dòng stock_quant vẫn tồn tại
        // mãi mãi vì trigger DB không bao giờ xoá, chỉ trừ về 0). Trước đây hard-code null ở đây
        // khiến 1 vật tư Sắt đã hết sạch tồn (từng có giao dịch) hiện nhầm thành "—" giống hệt vật
        // tư chưa hề nhập hàng lần nào - phát hiện khi user hỏi "dùng hết thì mất hay hiện 0".
        const quant = quantFor(m)
        rows.push({ key: String(m.id), material: m, stockLengthMm: null, qty: quant?.qty ?? null, availableQty: quant?.availableQty ?? null })
      } else {
        for (const b of buckets) {
          rows.push({ key: `${m.id}-${b.stockLengthMm}`, material: m, stockLengthMm: b.stockLengthMm || null, qty: b.qty, availableQty: b.availableQty })
        }
      }
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps -- quantFor đóng theo currentWarehouse/quantByKey, đã nằm trong deps riêng
  }, [filtered, showLengthColumn, bucketsByMaterialId])

  const isLoading = materialsLoading || (!!warehouseCode && !warehousesLoaded)
  const colCount = (warehouseCode ? 6 : 7) + (showLengthColumn ? 1 : 0)

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Tổng hợp vật tư</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text2)' }}>
          {currentWarehouse ? `Kho: ${currentWarehouse.name} · ` : ''}Tổng số {materialsInScope.length} vật tư
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => setFilterGroup('all')} style={tabStyle(filterGroup === 'all', null)}>Tất cả</button>
          {groupTabs.map(g => (
            <button key={g.key} onClick={() => setFilterGroup(g.key)} style={tabStyle(filterGroup === g.key, colorFor(g.key))}>
              {g.label}
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tìm tên hoặc mã vật tư…"
            style={{ width: '100%', padding: '7px 12px 7px 32px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text2)' }}>
          <Loader2 size={18} /> Đang tải...
        </div>
      ) : warehouseCode && !currentWarehouse ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
          Không xác định được kho &quot;{warehouseCode}&quot;
        </div>
      ) : isMobile ? (
        // Điện thoại: thẻ thay bảng - chạm thẻ mở cùng khung chi tiết như bấm dòng bảng.
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayRows.map(row => {
            const m = row.material
            const meta = colorFor(groupKeyOf(m))
            return (
              <div key={row.key} className="card" onClick={() => setSelected(row)} style={{ padding: '11px 13px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2, wordBreak: 'break-word' }}>
                      {[m.code, m.spec, m.unit].filter(Boolean).join(' · ')}
                      {showLengthColumn && row.stockLengthMm ? ` · ${row.stockLengthMm.toLocaleString('vi-VN')} mm` : ''}
                    </div>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                    {m.materialGroupName ?? 'Chưa phân nhóm'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13, flexWrap: 'wrap' }}>
                  {!warehouseCode && <span style={{ color: 'var(--text2)', flex: '1 1 auto', minWidth: 0 }}>{m.warehouseName ?? '—'}</span>}
                  <span style={{ marginLeft: 'auto' }}><span style={{ color: 'var(--text3)', fontSize: 11 }}>Tồn </span><b>{row.qty != null ? row.qty.toLocaleString('vi-VN') : '—'}</b></span>
                  <span><span style={{ color: 'var(--text3)', fontSize: 11 }}>Khả dụng </span><b style={{ color: row.availableQty != null && row.availableQty <= 0 ? '#c62828' : '#2563eb' }}>{row.availableQty != null ? row.availableQty.toLocaleString('vi-VN') : '—'}</b></span>
                </div>
              </div>
            )
          })}
          {displayRows.length === 0 && (
            <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>
              {q.trim() || filterGroup !== 'all' ? 'Không tìm thấy vật tư phù hợp' : 'Không có vật tư nào'}
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 780, borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 100 }} />
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 140 }} />
              {!warehouseCode && <col style={{ width: 150 }} />}
              {showLengthColumn && <col style={{ width: 100 }} />}
              <col style={{ width: 80 }} />
              <col style={{ width: 80 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
                <th style={thStyle}>Mã vật tư</th>
                <th style={thStyle}>Tên vật tư</th>
                <th style={thStyle}>Quy cách</th>
                <th style={thStyle}>Nhóm vật tư</th>
                {!warehouseCode && <th style={thStyle}>Kho</th>}
                {showLengthColumn && <th style={thStyle}>Chiều dài</th>}
                <th style={{ ...thStyle, textAlign: 'right' }}>Tồn kho</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Khả dụng</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map(row => {
                const m = row.material
                const meta = colorFor(groupKeyOf(m))
                return (
                  <tr
                    key={row.key}
                    onClick={() => setSelected(row)}
                    style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--text3)' }}>{m.code}</td>
                    <td style={{ ...tdStyle, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[m.spec, m.unit].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td style={tdStyle}>
                      <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: meta.color, background: meta.bg, whiteSpace: 'nowrap' }}>
                        {m.materialGroupName ?? 'Chưa phân nhóm'}
                      </span>
                    </td>
                    {!warehouseCode && <td style={{ ...tdStyle, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.warehouseName ?? '—'}</td>}
                    {showLengthColumn && (
                      <td style={{ ...tdStyle, color: 'var(--text3)' }}>
                        {row.stockLengthMm ? `${row.stockLengthMm.toLocaleString('vi-VN')} mm` : '—'}
                      </td>
                    )}
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{row.qty != null ? row.qty.toLocaleString('vi-VN') : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: row.availableQty != null && row.availableQty <= 0 ? '#c62828' : '#2563eb' }}>
                      {row.availableQty != null ? row.availableQty.toLocaleString('vi-VN') : '—'}
                    </td>
                  </tr>
                )
              })}
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={colCount} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
                    {q.trim() || filterGroup !== 'all' ? 'Không tìm thấy vật tư phù hợp' : 'Không có vật tư nào'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.35)', zIndex: 1000, display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div style={{ background: 'var(--surface)', width: 360, maxWidth: '100%', overflow: 'auto', padding: isMobile ? 18 : 24,
 boxShadow: '-4px 0 32px rgba(0,0,0,.14)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{
                display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                color: colorFor(groupKeyOf(selected.material)).color, background: colorFor(groupKeyOf(selected.material)).bg,
              }}>
                {selected.material.materialGroupName ?? 'Chưa phân nhóm'}
              </span>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4, borderRadius: 4 }}>
                <X size={18} color="var(--text3)" />
              </button>
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{selected.material.name}</h3>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>{selected.material.code}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <InfoRow label="Quy cách" value={selected.material.spec ?? '—'} />
              <InfoRow label="ĐVT" value={selected.material.unit} />
              {selected.material.purchaseUnit && <InfoRow label="ĐVT mua" value={selected.material.purchaseUnit} />}
              <InfoRow label="Kho" value={selected.material.warehouseName ?? '—'} />
              {showLengthColumn && (
                <InfoRow label="Chiều dài" value={selected.stockLengthMm ? `${selected.stockLengthMm.toLocaleString('vi-VN')} mm` : '—'} />
              )}
              <InfoRow label="Tồn kho" value={selected.qty != null ? selected.qty.toLocaleString('vi-VN') : '—'} />
              <InfoRow label="Khả dụng" value={selected.availableQty != null ? selected.availableQty.toLocaleString('vi-VN') : '—'} />
              <InfoRow label="Ngày tạo" value={format(new Date(selected.material.createdAt), 'dd/MM/yyyy')} />
            </div>
          </div>
        </div>
      )}
    </div>
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

function tabStyle(active: boolean, meta: { color: string; bg: string } | null): React.CSSProperties {
  return {
    padding: '6px 14px', fontSize: 12, fontWeight: active ? 700 : 500,
    borderRadius: 20, border: active ? 'none' : '1px solid var(--border)',
    cursor: 'pointer',
    background: active ? (meta?.bg ?? '#f1f5f9') : 'var(--surface)',
    color: active ? (meta?.color ?? '#334155') : 'var(--text2)',
  }
}

const thStyle: React.CSSProperties = { padding: '12px 16px', fontWeight: 600, fontSize: 12, color: 'var(--text3)' }
const tdStyle: React.CSSProperties = { padding: '12px 16px' }

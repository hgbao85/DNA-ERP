'use client'

/**
 * Mảnh chờ đan (Sơn) — mục sidebar dưới "Danh sách định mức mảnh", READ-ONLY.
 *
 * Kho chứa các mảnh Tổ Sơn đã sơn xong & đã được KCS duyệt đạt — chờ chuyển sang
 * công đoạn Đan. KCS duyệt xong sẽ đẩy thông tin về đây. Tương tự "Kho phôi" (Phôi)
 * và "Khung hàn" (Hàn).
 *
 * Đã nối BE thật (M3, đợt 2): không cần endpoint tổng hợp riêng — gộp production-batches trạng
 * thái QC_DONE theo mảnh, tái dùng đúng GET /production-batches?stage= (Phase 1, KcsStagePage),
 * chỉ đổi trục nhóm (mảnh thay vì PO). reportedQty của batch QC_DONE đã là passed-qty (BE ghi đè
 * sau khi KCS duyệt), không phải qty gốc đã báo.
 *
 * 2026-09-10: đồng bộ theo "Khung hàn" (KhungHanPage.tsx, cùng ngày) - đổi từ bảng PHẲNG liệt kê
 * thẳng từng mảnh sang 2 TẦNG SKU → mảnh (theo yêu cầu người dùng cho Hàn, áp luôn cho Sơn để 2
 * trang tiếp tục "y chang nhau"). `ProductionBatch` chỉ có `productionOrderId`/`pieceId`, không có
 * thẳng tên sản phẩm - tra qua `getProductionBatchPlanBatch()` (CÙNG endpoint `fetchHanSonRows()`
 * ở core.tsx đang dùng cho "Lệnh sản xuất" của CHÍNH vai Sơn). KHÔNG dùng `getSkuOptions()`/
 * `/products` - đã thử ở bản Hàn và bị BE chặn 403 "Missing required permission(s): PRODUCT:VIEW"
 * (HAN_STAFF/SON_STAFF chỉ có PRODUCTION_BATCH:VIEW, không có quyền đọc danh mục sản phẩm chung -
 * cùng giới hạn đã ghi ở XacNhanVatTuPage.tsx).
 */

import { useMemo, useState } from 'react'
import { Layers, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeProductionBatch } from '../../../services/production-batches-api'
import { backBtn } from '../../../styles/buttons'
import LoadingState from '../../../components/LoadingState'

interface ManhRow {
  pieceId: string
  tenVatLieu: string
  soLuong: number
}

interface SkuGroup {
  productName: string
  tong: number
  manhs: ManhRow[]
}

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

export default function ManhChoDanPage() {
  const { data: batches, isLoading: batchesLoading } = useFetch<BeProductionBatch[]>(() => api.getProductionBatchesByStage('SON'), [])
  const qcDone = useMemo(() => (batches ?? []).filter(b => b.status === 'QC_DONE'), [batches])
  const orderIds = useMemo(() => Array.from(new Set(qcDone.map(b => b.productionOrderId))).sort(), [qcDone])
  const { data: plans, isLoading: plansLoading } = useFetch(
    () => api.getProductionBatchPlanBatch(orderIds, 'SON'),
    [orderIds.join(',')],
  )
  const [selectedName, setSelectedName] = useState<string | null>(null)

  const groups: SkuGroup[] = useMemo(() => {
    const byProduct = new Map<string, SkuGroup>()
    for (const b of qcDone) {
      const productName = plans?.[b.productionOrderId]?.productName ?? 'Không xác định được sản phẩm'
      let g = byProduct.get(productName)
      if (!g) { g = { productName, tong: 0, manhs: [] }; byProduct.set(productName, g) }
      g.tong += b.reportedQty
      const manh = g.manhs.find(m => m.pieceId === b.pieceId)
      if (manh) manh.soLuong += b.reportedQty
      else g.manhs.push({ pieceId: b.pieceId, tenVatLieu: `${b.pieceName} — ${b.pieceCode}`, soLuong: b.reportedQty })
    }
    return Array.from(byProduct.values()).sort((a, b) => a.productName.localeCompare(b.productName))
  }, [qcDone, plans])

  const tongTatCa = useMemo(() => groups.reduce((s, g) => s + g.tong, 0), [groups])
  const selected = groups.find(g => g.productName === selectedName) ?? null

  if (batchesLoading || plansLoading) return <LoadingState />

  // ── Chi tiết 1 SKU: các mảnh còn tồn ─────────────────────────────────────────
  if (selected) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => setSelectedName(null)} style={backBtn}>
            <ChevronLeft size={15} /> Quay lại
          </button>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selected.productName}</h2>
        </div>

        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 480 }}>
            <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 120 }} /></colgroup>
            <thead>
              <tr style={{ background: 'var(--surface2)' }}>
                <th style={th}>Tên mảnh</th>
                <th style={thR}>Số lượng</th>
                <th style={th}>ĐVT</th>
              </tr>
            </thead>
            <tbody>
              {selected.manhs.map(m => (
                <tr key={m.pieceId} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{m.tenVatLieu}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{m.soLuong.toLocaleString('vi-VN')}</td>
                  <td style={{ ...td, color: 'var(--text3)' }}>cái</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <td style={{ ...td, fontWeight: 700 }}>Tổng</td>
                <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{selected.tong.toLocaleString('vi-VN')}</td>
                <td style={{ ...td, color: 'var(--text3)' }}>cái</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }

  // ── Trang tổng: danh sách SKU ─────────────────────────────────────────────────
  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Layers size={20} /> Mảnh chờ đan
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Check size={14} style={{ color: '#16a34a' }} /> Kho chứa các mảnh Tổ Sơn đã sơn & KCS duyệt đạt — chờ chuyển sang Đan. Bấm vào 1 sản phẩm để xem các mảnh còn tồn.
      </div>

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 480 }}>
          <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 32 }} /></colgroup>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={th}>SKU / Sản phẩm</th>
              <th style={thR}>Số lượng</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.productName} onClick={() => setSelectedName(g.productName)}
                style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <td style={td}>
                  <span style={{ fontWeight: 700 }}>{g.productName}</span>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{g.manhs.length} loại mảnh</div>
                </td>
                <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{g.tong.toLocaleString('vi-VN')}</td>
                <td style={{ ...td, textAlign: 'center', color: 'var(--text3)' }}><ChevronRight size={16} /></td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>Chưa có mảnh nào được KCS duyệt</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
              <td style={{ ...td, fontWeight: 700 }}>Tổng</td>
              <td style={{ ...tdR, fontWeight: 700, color: '#e65100' }}>{tongTatCa.toLocaleString('vi-VN')}</td>
              <td style={td} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

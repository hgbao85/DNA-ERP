'use client'

/**
 * Lịch sử nhập xuất kho (sổ kho) của ĐÚNG 1 kho - đọc thẳng `stock_ledger`, sổ cái bút toán kép
 * duy nhất của hệ thống (mọi luồng nghiệp vụ đều ghi vào đây qua StockLedgerService.postEntry:
 * mua hàng, xuất sắt cho Phôi, xuất vật tư hàn/sơn, chuyển kho nội bộ, KCS phế, điều chỉnh tay...).
 *
 * KHÔNG tự gom lịch sử từ từng màn nghiệp vụ riêng lẻ (warehouse-transfers/packaging-issues/...) -
 * làm vậy vừa sót luồng vừa lệch số; sổ cái là nguồn duy nhất đúng.
 *
 * Cột: Thời gian · Lệnh sản xuất · Mã đơn hàng (PO) · Từ · Đến · Mặt hàng · Số lượng · Ghi chú.
 * Cặp Từ/Đến cũng chính là "vì việc gì" nhờ 4 kho ẢO - SUPPLIER→kho = mua về, kho→PRODUCTION =
 * xuất cho sản xuất, kho→SCRAP = phế liệu, OPENING_BALANCE↔kho = tồn đầu kỳ/sửa tay, kho↔kho vật
 * lý = chuyển kho nội bộ.
 *
 * KHÔNG có cột "Người thực hiện" (bỏ hẳn 2026-09-12, theo yêu cầu người dùng - thấy thừa vì phần
 * lớn trùng lặp với chính tên kho đang xem ở cột Từ/Đến, chỉ khác trong vài trường hợp hiếm như tổ
 * Hàn tự báo tiêu hao hoặc Admin điều chỉnh tay). `createdByName`/`rejectedByName` vẫn giữ trong
 * kiểu dữ liệu BE/FE (không hại gì khi không dùng) phòng khi cần lại.
 *
 * KHÔNG có cột "Trạng thái" và KHÔNG gộp phiếu chuyển kho bị TỪ CHỐI vào đây (bỏ hẳn 2026-09-12,
 * theo phản hồi trực tiếp của Sếp qua Trương Văn Nhân: "lịch sử chỉ ghi lại những lần xuất, nhập
 * được chấp nhận - nếu từ chối thì không cần thêm vào lịch sử"). Trước đó có 1 bản đã gộp cả phiếu
 * bị từ chối kèm cột Trạng thái riêng theo yêu cầu người dùng lúc đó - Sếp duyệt lại và chốt bỏ,
 * quay về đúng ý nghĩa sổ CÁI: chỉ ghi bút toán đã THẬT SỰ xảy ra. Phiếu bị từ chối (không sinh
 * bút toán, xem WarehouseTransfersService.confirm()/reject()) xem lại ở "Nhập nội bộ" (hộp thư
 * PENDING) - không có màn lịch sử riêng cho từ chối nữa, đúng ý Sếp.
 *
 * Cột "Lệnh sản xuất"/"Mã đơn hàng (PO)" (2026-09-12, theo yêu cầu Sếp qua Trương Văn Nhân) - 2 mã
 * KHÁC NHAU, đừng nhầm:
 *  - "Lệnh sản xuất" = `refCode` (mã phiếu chuyển kho, chỉ WAREHOUSE_TRANSFER) hoặc `piCode`
 *    (ProductionInvoice.code, vd "PI-2026-005" - "Lệnh sản xuất" TRONG TOÀN HỆ THỐNG LÀ PI, xem
 *    nhãn "Lệnh sản xuất (PI)" ở Admin). KHÔNG phải `ProductionOrder.poNumber` - mã đó chỉ dùng
 *    nội bộ tra cứu, KHÔNG hiển thị cho người dùng (quy ước toàn hệ thống, xem
 *    InspectionContext.tsx). Ban đầu cột này chỉ ĐỔI TÊN nhãn mà giữ nguyên nội dung cũ (hiện loại
 *    nghiệp vụ như "Tiêu hao đoạn sắt"/"Mua hàng"...) - Sếp phản hồi lại đúng là SAI vì nhìn giống
 *    dữ liệu rác, nên sửa lại hiện `piCode` thật.
 *  - "Mã đơn hàng (PO)" = `poCode` (SalesOrder.orderCode) của Lệnh sản xuất đó.
 * Cả 2 đều tra được cho bút toán xuất phát từ 1 Lệnh sản xuất cụ thể (xuất vật tư, tiêu hao đoạn
 * sắt, xuất bao bì, tiêu hao vật tư TP, xuất đan, xuất sắt) - xem BE
 * StockLedgerService.fetchPiCodes()/fetchPoCodes(). KHÔNG kèm nhãn loại nghiệp vụ (vd "Tiêu hao
 * đoạn sắt") dưới mã - có ở bản sửa (e) nhưng bỏ hẳn ngay sau đó (2026-09-12, theo yêu cầu người
 * dùng - thấy không cần thiết); ô "Lệnh sản xuất" giờ CHỈ hiện đúng 1 dòng mã (hoặc "—").
 * null cho bút toán không gắn đơn hàng/Lệnh sản
 * xuất nào (mua hàng, chuyển kho nội bộ, KCS phế, điều chỉnh tay) - riêng `poCode` còn null thêm
 * khi PI nguồn là PI gộp nhiều đơn (`piCode` vẫn có vì PI luôn có `code` bất kể gộp hay không).
 */

import { useState } from 'react'
import { useFetch } from '../hooks/useFetch'
import { getStockLedger, type BeStockLedgerEntry } from '../services/stock-api'
import LoadingState from './LoadingState'
import { tableWrap, tbl, compactTh as th, compactTd as td, emptyBox } from '../styles/table'

type Dir = 'ALL' | 'IN' | 'OUT'

/**
 * Tên hiển thị cho 4 kho ẢO (không có tồn vật lý, chỉ là điểm đối ứng bút toán). Tên thật trong DB
 * mang chữ "(ảo)" + cách gọi kỹ thuật ("Đối ứng tồn kho ban đầu/điều chỉnh (ảo)") - đúng cho Admin
 * nhưng vô nghĩa với thủ kho đang đọc sổ, nên đổi sang cách gọi theo NGHIỆP VỤ. Kho vật lý giữ
 * nguyên tên thật.
 */
const VIRTUAL_WAREHOUSE_LABEL: Record<string, string> = {
  SUPPLIER: 'Nhà cung cấp',
  PRODUCTION: 'Xưởng sản xuất',
  SCRAP: 'Phế liệu',
  OPENING_BALANCE: 'Cân đối tồn kho',
}

/** Kho ảo PRODUCTION gom mọi luồng "vào/ra xưởng" - nói rõ ĐÚNG TỔ nào thì đọc mới có nghĩa
 *  ("Đến: Tổ Phôi" thay vì "Đến: Xưởng sản xuất"). Ưu tiên `refStage` BE tra được từ bản ghi nguồn;
 *  refType không có cột stage thì tổ là cố định theo nghiệp vụ (bảng dưới). */
const TEAM_BY_STAGE: Record<string, string> = {
  PHOI: 'Tổ Phôi',
  HAN: 'Tổ Hàn',
  SON: 'Tổ Sơn',
  DAN: 'Điểm đan',
}

const TEAM_BY_REF_TYPE: Record<string, string> = {
  STEEL_ISSUE: 'Tổ Phôi',
  MATERIAL_YIELD_CONSUME: 'Tổ Phôi',
  WEAVING_ISSUE_MATERIAL: 'Điểm đan',
  PACKAGING_ISSUE: 'Tổ đóng gói',
  FRAME_OUTPUT: 'Tổ Phôi',
}

function whLabel(code: string, name: string, e: BeStockLedgerEntry): string {
  if (code !== 'PRODUCTION') return VIRTUAL_WAREHOUSE_LABEL[code] ?? name
  return (e.refStage ? TEAM_BY_STAGE[e.refStage] : undefined)
    ?? TEAM_BY_REF_TYPE[e.refType]
    ?? VIRTUAL_WAREHOUSE_LABEL.PRODUCTION
}

const DIR_OPTIONS: { value: Dir; label: string; color: string; bg: string }[] = [
  { value: 'ALL', label: 'Tất cả',   color: 'var(--text)', bg: 'var(--surface2)' },
  { value: 'IN',  label: 'Nhập kho', color: '#15803d',     bg: '#dcfce7' },
  { value: 'OUT', label: 'Xuất kho', color: '#c2410c',     bg: '#ffedd5' },
]

/** Mặt hàng của 1 bút toán - đúng 1 trong 4 chân hàng (XOR ở DB). Kho phôi sơn hàn còn có dòng
 *  "đoạn sắt" (sắt đã cắt); kho thành phẩm mới có dòng mảnh/thành phẩm. */
function itemOf(e: BeStockLedgerEntry): { code: string; name: string; unit: string } {
  if (e.materialId) {
    return {
      code: e.materialCode ?? '—',
      // Sắt cây cùng mã nhưng khác chiều dài là 2 lô tồn RIÊNG - phải hiện chiều dài mới đọc đúng.
      name: e.stockLengthMm > 0
        ? `${e.materialName ?? ''} · cây ${e.stockLengthMm.toLocaleString('vi-VN')}mm`
        : (e.materialName ?? ''),
      unit: e.materialUnit ?? '',
    }
  }
  if (e.segmentSpecId) return { code: e.segmentSpecLabel ?? '—', name: 'Đoạn sắt đã cắt', unit: 'đoạn' }
  if (e.pieceId) return { code: e.pieceCode ?? '—', name: 'Mảnh', unit: 'cái' }
  if (e.productVariantId) return { code: e.productVariantLabel ?? '—', name: 'Thành phẩm', unit: 'cái' }
  return { code: '—', name: '', unit: '' }
}

type Row = { key: string; date: string; isIn: boolean; e: BeStockLedgerEntry }

export default function WarehouseLedgerHistory({ warehouseId, warehouseCode }: {
  warehouseId: string
  /** Dùng để biết bút toán là NHẬP hay XUẤT của chính kho này (kho đích === mình → nhập). */
  warehouseCode: string
}) {
  const { data: entries, isLoading, error } = useFetch<BeStockLedgerEntry[]>(
    () => getStockLedger({ warehouseId }), [warehouseId],
  )
  const [dir, setDir] = useState<Dir>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const rows: Row[] = (entries ?? []).map(e => ({
    key: `l-${e.id}`, date: e.createdAt, isIn: e.toWarehouseCode === warehouseCode, e,
  }))
  const filtered = rows.filter(r => {
    if (dir === 'IN' && !r.isIn) return false
    if (dir === 'OUT' && r.isIn) return false
    if (dateFrom && r.date < dateFrom) return false
    if (dateTo && r.date > dateTo + 'T23:59:59') return false
    return true
  })
  const hasFilter = dir !== 'ALL' || !!dateFrom || !!dateTo

  if (isLoading) return <LoadingState />
  if (error) return <div style={{ ...emptyBox, color: '#dc2626' }}>Lỗi tải sổ kho: {error}</div>

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px',
        background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {DIR_OPTIONS.map(o => {
            const active = dir === o.value
            return (
              <button key={o.value} onClick={() => setDir(o.value)} style={{
                padding: '4px 12px', fontSize: 12, fontWeight: active ? 700 : 500, borderRadius: 20,
                border: active ? 'none' : '1px solid var(--border)', cursor: 'pointer',
                background: active ? o.bg : 'var(--surface)', color: active ? o.color : 'var(--text2)',
              }}>{o.label}</button>
            )
          })}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {hasFilter && (
            <button onClick={() => { setDir('ALL'); setDateFrom(''); setDateTo('') }}
              style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: '#dc2626', cursor: 'pointer' }}>
              ✕ Xóa bộ lọc
            </button>
          )}
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Từ ngày</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ padding: '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }} />
          <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>đến</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ padding: '5px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)' }} />
        </div>
      </div>

      <div style={{ ...tableWrap, overflowX: 'auto' }}>
        <table style={{ ...tbl, minWidth: 1040, tableLayout: 'auto' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', textAlign: 'left' }}>
              <th style={th}>Thời gian</th>
              <th style={th}>Lệnh sản xuất</th>
              <th style={th}>Mã đơn hàng (PO)</th>
              <th style={th}>Từ</th>
              <th style={th}>Đến</th>
              <th style={th}>Mặt hàng</th>
              <th style={{ ...th, textAlign: 'right' }}>Số lượng</th>
              <th style={th}>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const { e, isIn } = r
              const item = itemOf(e)
              return (
                <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text3)', fontSize: 12 }}>
                    {new Date(e.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </td>
                  {/* Mã THẬT khi có: mã phiếu chuyển kho (refCode) hoặc mã Lệnh sản xuất/PI
                      (piCode, KHÁC ProductionOrder.poNumber - mã đó chỉ tra cứu nội bộ, không
                      hiển thị) - "—" khi bút toán không gắn Lệnh sản xuất/phiếu nào (mua hàng,
                      điều chỉnh tay...). KHÔNG kèm nhãn loại nghiệp vụ (bỏ hẳn 2026-09-12, theo
                      yêu cầu người dùng - thấy không cần thiết). */}
                  <td style={{ ...td, fontWeight: 700, fontFamily: (e.refCode ?? e.piCode) ? 'monospace' : undefined, whiteSpace: 'nowrap', color: (e.refCode ?? e.piCode) ? undefined : 'var(--text3)' }}>
                    {e.refCode ?? e.piCode ?? '—'}
                  </td>
                  <td style={{ ...td, fontFamily: e.poCode ? 'monospace' : undefined, whiteSpace: 'nowrap', color: e.poCode ? undefined : 'var(--text3)' }}>
                    {e.poCode ?? '—'}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: isIn ? 'var(--text2)' : 'var(--text3)' }}>
                    {whLabel(e.fromWarehouseCode, e.fromWarehouseName, e)}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: isIn ? 'var(--text3)' : 'var(--text2)' }}>
                    {whLabel(e.toWarehouseCode, e.toWarehouseName, e)}
                  </td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{item.code}</div>
                    {item.name && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{item.name}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap', color: isIn ? '#15803d' : '#c2410c' }}>
                    {isIn ? '+' : '−'}{e.qty.toLocaleString('vi-VN')}
                    {item.unit && <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}> {item.unit}</span>}
                  </td>
                  <td style={{ ...td, fontSize: 12, color: 'var(--text3)' }}>{e.note || '—'}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--text3)', padding: 28 }}>
                {rows.length === 0 ? 'Kho này chưa có giao dịch nhập xuất nào.' : 'Không có giao dịch khớp bộ lọc.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

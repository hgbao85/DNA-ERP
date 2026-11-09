// Phần A – Đợt 4 (YC6): hàm THUẦN của màn "Vật tư cần về" - định dạng ngày, nhãn trạng thái, số lượng, đếm trên nút lọc.
// FE KHÔNG tự tính lại trạng thái / hạn / còn thiếu: mọi con số đó do BE (`GET /materials-due`) trả sẵn, ở đây chỉ trình bày.
import type { User } from '../../../context/AuthContext'
import { resolveDefaultModule } from '../../../utils/resolveDefaultModule'
import { focusKey } from '../../../utils/notificationLink'
import type {
  MaterialsDueCounts, MaterialsDueRow, MaterialsDueSku, MaterialsDueState, MaterialsDueView,
} from '../../../services/materials-due-api'

/** Mức nhấn của trạng thái: critical = đỏ đậm nổi bật (hạn chót hôm nay), red = đỏ, amber = vàng/cam, grey = xám nhạt. */
export type DueTone = 'critical' | 'red' | 'amber' | 'grey' | 'muted'

/** Nút "Nhập kho" trên dòng: CHỈ thủ kho (tài khoản vào phân hệ Kho đầu vào - người mua / KHSX / Sếp không có phân hệ này), dòng đã
 *  đặt NCC (PURCHASING, mới có hàng để nhận), và đúng kho người đó đang làm (thủ kho tổng warehouseScope null thì mọi kho). */
export function canReceiveRow(
  user: Pick<User, 'role' | 'warehouseScope' | 'isPurchaser' | 'isProductPlanner' | 'isSale' | 'isMaterialsManager' | 'mfgRole' | 'isFloorWorker'> | null,
  row: Pick<MaterialsDueRow, 'purchaseStatus' | 'warehouseCode'>,
): boolean {
  if (!user || user.role !== 'WAREHOUSE_STAFF') return false
  if (resolveDefaultModule(user as User) !== 'inbound_warehouse') return false
  if (row.purchaseStatus !== 'PURCHASING') return false
  const scope = user.warehouseScope ?? null
  return scope === null || row.warehouseCode === scope
}

/** Link mở thẳng dòng nhận hàng ở màn Nhập kho: ưu tiên đơn đặt hàng NCC, không có thì theo vật tư. */
export function receiveUrl(row: Pick<MaterialsDueRow, 'supplierOrderId' | 'materialId'>): string {
  const focus = row.supplierOrderId ? focusKey('SUPPLIER_ORDER', row.supplierOrderId) : focusKey('MATERIAL', row.materialId)
  return `/?m=inbound_warehouse&p=nhap-kho&focus=${encodeURIComponent(focus)}`
}

/** Ngày hôm nay theo giờ VN dạng 'yyyy-MM-dd' (dùng khi chọn "Theo ngày" mà chưa chọn ngày nào). */
export const vnToday = (now: Date = new Date()): string =>
  now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/

/** 'yyyy-MM-dd...' -> 'dd/MM'. Cắt chuỗi, không qua Date (tránh lệch múi giờ). Rỗng/sai -> ''. */
export function fmtDayMonth(iso: string | null | undefined): string {
  const m = iso ? DAY_RE.exec(iso) : null
  return m ? `${m[3]}/${m[2]}` : ''
}

/** 'yyyy-MM-dd...' -> 'dd/MM/yyyy'. */
export function fmtDayFull(iso: string | null | undefined): string {
  const m = iso ? DAY_RE.exec(iso) : null
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

/** Số lượng theo kiểu Việt Nam, tối đa 2 số lẻ (kg lẻ). */
export const fmtQty = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/** Nhãn + mức nhấn của trạng thái dòng (Sếp 05/11: hạn chót hôm nay đỏ nổi bật; quá hạn đỏ; trong khoảng vàng; chưa tới xám). */
export function stateInfo(row: Pick<MaterialsDueRow, 'state' | 'daysLeft' | 'earliestArrival'>): { text: string; tone: DueTone } {
  const days = row.daysLeft
  switch (row.state as MaterialsDueState) {
    case 'DEADLINE_TODAY':
      return { text: 'HẠN CHÓT HÔM NAY', tone: 'critical' }
    case 'OVERDUE':
      return { text: days != null ? `Quá hạn ${Math.abs(days)} ngày` : 'Quá hạn', tone: 'red' }
    case 'IN_WINDOW':
      // "tới hạn" để rõ còn N ngày tới HẠN CHÓT (đánh giá UX U6).
      return { text: days != null ? `Còn ${days} ngày tới hạn` : 'Đang trong khoảng được về', tone: 'amber' }
    case 'UPCOMING': {
      const from = fmtDayMonth(row.earliestArrival)
      return { text: from ? `Về từ ${from}` : 'Chưa tới ngày về', tone: 'grey' }
    }
    case 'NO_DEADLINE':
    default:
      return { text: 'Chưa có hạn', tone: 'muted' }
  }
}

/** Dòng đỏ (quá hạn hoặc hạn chót hôm nay) - nền/viền đỏ ở cả bảng và thẻ. */
export const isRedState = (s: MaterialsDueState): boolean => s === 'OVERDUE' || s === 'DEADLINE_TODAY'

export const groupLabel = (g: MaterialsDueRow['group']): string => (g === 'FRAME' ? 'VT khung & đan' : 'VT còn lại')

/** "Được về từ – Hạn chót": "06/11 – 10/11"; chưa có hạn -> "—". */
export function windowText(row: Pick<MaterialsDueRow, 'earliestArrival' | 'deadline'>): string {
  const from = fmtDayMonth(row.earliestArrival)
  const to = fmtDayFull(row.deadline)
  if (!from && !to) return '—'
  return `${from || '?'} – ${to || '?'}`
}

/** Số theo dõi = số CHỐT MUA. Chốt mua > cần thì ghi rõ "Cần 100 · chốt mua 120 kg". */
export function qtyNeedText(row: Pick<MaterialsDueRow, 'needQty' | 'orderQty' | 'unit'>): string {
  if (row.orderQty > row.needQty) return `Cần ${fmtQty(row.needQty)} · chốt mua ${fmtQty(row.orderQty)} ${row.unit}`
  return `${fmtQty(row.orderQty)} ${row.unit}`
}

/** 1 SKU của lệnh gộp: mã lệnh (LSX) + mã SKU (khi khác mã lệnh) + hạn riêng. */
export function skuChip(sku: MaterialsDueSku): { code: string; sku: string; deadlineText: string } {
  const d = fmtDayMonth(sku.deadline)
  return {
    code: sku.lenhCode,
    sku: sku.skuCode && sku.skuCode !== sku.lenhCode ? sku.skuCode : '',
    deadlineText: d ? `hạn ${d}` : 'chưa có hạn',
  }
}

/** NCC + số đơn. Chưa đặt NCC (trạng thái chưa PURCHASING) -> "Chưa đặt NCC"; đã PURCHASING mà không có tên -> "Chưa ghi NCC"
 *  (trước là "—", không nói gì - đánh giá UX U5). */
export function supplierText(row: Pick<MaterialsDueRow, 'supplierName' | 'supplierOrderCode' | 'purchaseStatus'>): { name: string; order: string; placed: boolean } {
  if (row.supplierName) return { name: row.supplierName, order: row.supplierOrderCode ? `Đơn ${row.supplierOrderCode}` : '', placed: true }
  if (row.purchaseStatus !== 'PURCHASING') return { name: 'Chưa đặt NCC', order: '', placed: false }
  return { name: 'Chưa ghi NCC', order: row.supplierOrderCode ? `Đơn ${row.supplierOrderCode}` : '', placed: false }
}

/** Đánh giá UX U2: lọc "Hôm nay" (mặc định khi mở màn) KHÔNG chứa dòng quá hạn - có quá hạn thì phải nhắc nổi bật để người
 *  mua không bỏ sót hàng đã trễ. Trả số dòng quá hạn (đếm theo `counts`, không theo dòng đang hiện) khi cần nhắc, ngược lại null. */
export function overdueHint(view: MaterialsDueView, counts: MaterialsDueCounts | undefined): number | null {
  if (view !== 'today' || !counts || counts.overdue <= 0) return null
  return counts.overdue
}

/** Số trên các nút lọc: Hôm nay = hạn chót hôm nay + trong khoảng được về; Tất cả = cả 5 nhóm. "Theo ngày" không có số. */
export function pillCount(counts: MaterialsDueCounts | undefined, view: MaterialsDueView): number | undefined {
  if (!counts) return undefined
  switch (view) {
    case 'overdue': return counts.overdue
    case 'today': return counts.deadlineToday + counts.inWindow
    case 'all': return counts.overdue + counts.deadlineToday + counts.inWindow + counts.upcoming + counts.noDeadline
    default: return undefined
  }
}

/** Đọc `view` từ URL (thông báo BE gửi 'today' | 'all'); sai/thiếu -> 'today' (mặc định màn). */
export function parseView(v: string | null | undefined): MaterialsDueView {
  return v === 'overdue' || v === 'today' || v === 'date' || v === 'all' ? v : 'today'
}

/** Ngày hợp lệ 'yyyy-MM-dd' hay không (dùng cho `date` trên URL). */
export const isDayKey = (v: string | null | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Câu thân thiện khi danh sách rỗng, theo bộ lọc. */
export function emptyMessage(view: MaterialsDueView, date: string | null): string {
  switch (view) {
    case 'overdue': return 'Không có vật tư quá hạn.'
    case 'today': return 'Hôm nay không có vật tư nào đang trong khoảng được về.'
    case 'date': return date ? `Không có vật tư nào trong khoảng được về của ngày ${fmtDayFull(date)}.` : 'Không có vật tư cho ngày đã chọn.'
    default: return 'Không có vật tư nào đang chờ về.'
  }
}

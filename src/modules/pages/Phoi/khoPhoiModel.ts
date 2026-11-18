/**
 * Kho phôi - hàm thuần (không React) cho KhoPhoiPage: lọc danh sách kho, chọn kho mặc định, băng cảnh báo.
 */
import { warehouseKindOf } from '../../../utils/warehouseKinds'

/**
 * Kho ảo đối ứng - không phải tồn thật: PRODUCTION (Hàn / Sơn dùng đoạn thì đoạn "ra" kho này, KCS đạt thì "vào" từ đây),
 * OPENING_BALANCE "Cân đối tồn kho" (kiểm kê đoạn, chuyển đổi dữ liệu cũ). /segment-stock/balances trả mọi kho có dòng đoạn nên
 * phải bỏ cả 4 mã ảo.
 */
export const VIRTUAL_WAREHOUSE_CODES = new Set(['PRODUCTION', 'OPENING_BALANCE', 'SUPPLIER', 'SCRAP'])

export type KhoOption = { code: string; name: string }

const theoTen = (a: KhoOption, b: KhoOption) => a.name.localeCompare(b.name, 'vi')

/** Các kho Phôi có đoạn trong số dư (bỏ kho ảo), sắp theo tên. Cách cũ khi không tải được danh sách kho. */
export function khoPhoiTuSoDu(balances: { warehouseCode: string; warehouseName: string }[] | null | undefined): KhoOption[] {
  const m = new Map<string, string>()
  for (const b of balances ?? []) if (!VIRTUAL_WAREHOUSE_CODES.has(b.warehouseCode)) m.set(b.warehouseCode, b.warehouseName)
  return [...m.entries()].map(([code, name]) => ({ code, name })).sort(theoTen)
}

/** Mọi kho Phôi thật đang hoạt động (kể cả kho chưa có dòng đoạn), sắp theo tên. */
export function khoPhoiThat(
  warehouses: { code: string; name: string; isVirtual?: boolean; isActive?: boolean; kind?: string | null }[] | null | undefined,
): KhoOption[] {
  return (warehouses ?? [])
    .filter(w => !w.isVirtual && w.isActive !== false && (w.kind ?? warehouseKindOf(w.code)) === 'PHOI')
    .map(w => ({ code: w.code, name: w.name }))
    .sort(theoTen)
}

/** Thứ tự ưu tiên: kho bị khoá > kho đã bấm chọn (còn trong danh sách) > kho người xem được gán > kho đầu tiên. */
export function chonKhoMacDinh(a: { locked?: string | null; picked: string | null; options: KhoOption[]; userScope?: string | null }): string | null {
  if (a.locked) return a.locked
  if (a.picked && a.options.some(w => w.code === a.picked)) return a.picked
  return (a.options.find(w => w.code === a.userScope) ?? a.options[0])?.code ?? null
}

export const CANH_BAO_TON_AM = 'Có tồn âm — số đoạn cũ (trước khi quản đoạn theo lệnh) chưa được chuyển đổi. Báo IT.'
export const CANH_BAO_DU_AM = 'Có mã đoạn đang giữ cho lệnh nhiều hơn tồn thật (cột Dư âm) — Hàn / Sơn của lệnh đó sẽ thiếu đoạn, phần thiếu ghi vào Sổ báo vượt đoạn.'

/** tonAm: có dòng tồn < 0 (dữ liệu cũ chưa chuyển). duAm: dòng tồn >= 0 nhưng giữ nhiều hơn tồn (Dư < 0). */
export function canhBaoKhoPhoi(rows: { onHandQty: number; surplusQty: number }[]): { tonAm: boolean; duAm: boolean } {
  return {
    tonAm: rows.some(r => r.onHandQty < 0),
    duAm: rows.some(r => r.onHandQty >= 0 && r.surplusQty < 0),
  }
}

type KetQuaTai = { data: unknown; isLoading: boolean; error: string | null }

/**
 * Trang hiện gì: đang tải (còn lệnh gọi nào chưa về), lỗi thật (có lệnh gọi báo lỗi), hay đủ dữ liệu.
 * Màn Admin gọi thêm danh sách kho; nếu số dư về trước danh sách kho thì vẫn là "đang tải", không phải lỗi.
 */
export function trangThaiTaiKhoPhoi(a: { allPhoiWarehouses: boolean; balances: KetQuaTai; warehouses: KetQuaTai }): 'loading' | 'error' | 'ok' {
  const cacLan = a.allPhoiWarehouses ? [a.balances, a.warehouses] : [a.balances]
  if (cacLan.some(l => l.error)) return 'error'
  if (cacLan.some(l => l.isLoading)) return 'loading'
  if (cacLan.some(l => !l.data)) return 'error'
  return 'ok'
}

/**
 * Định nghĩa các ô của nhóm "Máy cắt" và "Kế hoạch sản xuất" - cấu hình thật cho bộ giải Đề xuất thanh sắt (màn Tối ưu cắt sắt
 * đọc). Các tham số số nhập dạng chữ (giữ được lúc đang gõ dở "2,"), chỉ đổi thành số + kiểm tra khi bấm Lưu.
 */
import type { SolverMachine } from '../../../../types/admin'
import { fmtNum } from '../../../../utils/numberFormat'
import type { TabId } from './configFields'

export type McNumName =
  | 'solverMaxWastePercentage' | 'solverMaxSurplus' | 'solverMinLengthMm' | 'solverMaxLengthMm' | 'solverLengthStepMm'
  | 'solverTimeLimitSeconds' | 'solverBladeWidthMm' | 'solverTrimStartMm' | 'solverLaserMinTailMm' | 'solverMctdBladeWidthMm'
  | 'solverMctdTrimStartMm' | 'solverMaxManualCuts' | 'solverMaxSizesPerPattern' | 'solverMergeWindowDays' | 'solverMergeMaxSkus'
  | 'containerVolumeM3' | 'capacityContPerDay' | 'daysPerContPhuocAn' | 'materialEarliestArrivalDays'

/** Ô "số cỡ đoạn tối đa trên 1 cây" theo xưởng: khoá lỗi/chữ đang gõ = `wsSizes:<code xưởng>`. */
export const WS_SIZES_PREFIX = 'wsSizes:'
export type McKey = McNumName | 'solverBundleFactors' | 'solverBundleFactorsBySpec' | 'solverStockLengths' | `wsSizes:${string}`

/** Mỗi ô: `help` = lời giải thích ngắn (tối đa 2 dòng ở máy tính), `more` = phần dài hơn, bấm "Xem thêm" mới mở. */
export interface McField { name: McNumName; label: string; help: string; more?: string; integer: boolean; min: number; max: number }

export const MC_NUM_FIELDS: McField[] = [
  {
    name: 'solverMctdBladeWidthMm', label: 'Lưỡi cắt (mm)', integer: false, min: 0, max: 10,
    help: `Bề dày lưỡi cắt: mỗi nhát cắt mất đi chừng này trên cây sắt. Mặc định ${fmtNum(2.5)}.`,
  },
  {
    name: 'solverMctdTrimStartMm', label: 'Tề đầu (mm)', integer: true, min: 0, max: 100,
    help: `Phần đầu cây cắt bỏ trước khi cắt đoạn đầu tiên, tính bằng mm nguyên. Mặc định ${fmtNum(10)}.`,
    more: 'Tề đầu không tính vào hao hụt.',
  },
  {
    name: 'solverMaxManualCuts', label: 'Số cây cắt tay tối đa', integer: true, min: 0, max: 100,
    help: `Số cây cắt tay tối đa cho mỗi loại sắt (phần lẻ không đủ một bó). Mặc định ${fmtNum(5)}.`,
    more: 'Phần lẻ không đủ một bó thì cắt từng cây (cắt tay). Nhập 0 = không cho cắt tay.',
  },
  {
    name: 'solverMaxSizesPerPattern', label: 'Số cỡ đoạn tối đa mỗi kiểu cắt', integer: true, min: 1, max: 10,
    help: `Một kiểu cắt (cách cắt chung của một bó) có tối đa chừng này cỡ đoạn khác nhau. Mặc định ${fmtNum(5)}.`,
  },
]

/** Thông số MC Laser: cặp lưỡi cắt / tề đầu RIÊNG của MC Laser (BE: solverBladeWidthMm / solverTrimStartMm), tách khỏi cặp của
 *  MC Tự động; cùng khoảng giá trị. Thêm luật đoạn cuối của laze (0 = tắt). */
export const LASER_FIELDS: McField[] = [
  {
    name: 'solverBladeWidthMm', label: 'Lưỡi cắt (mm)', integer: false, min: 0, max: 10,
    help: `Bề dày lưỡi cắt laser: mỗi nhát cắt mất đi chừng này trên cây sắt. Mặc định ${fmtNum(1)}.`,
  },
  {
    name: 'solverTrimStartMm', label: 'Tề đầu (mm)', integer: true, min: 0, max: 100,
    help: `Phần đầu cây cắt bỏ trước khi cắt đoạn đầu tiên, tính bằng mm nguyên. Mặc định ${fmtNum(10)}.`,
  },
  {
    // Nhát cắt cuối của laze phải ra 1 đoạn dài hơn số này, tính cả cùi. 0 = tắt.
    name: 'solverLaserMinTailMm', label: 'Đoạn cuối tối thiểu (mm)', integer: true, min: 0, max: 1000,
    help: `Nhát cắt cuối của máy laze phải ra 1 đoạn dài hơn số này, tính cả cùi. Mặc định ${fmtNum(100)}; nhập 0 = tắt.`,
    more: 'Đoạn dài nhất để cuối, công nhân cắt tay. Bộ giải chỉ xếp kiểu cắt laze thoả luật này.',
  },
]

/** Thông số chung của bộ giải, áp cho CẢ HAI máy. Cây chuẩn (danh sách số) và "Cho đặt cây riêng" (bật/tắt) nằm riêng. */
export const SHARED_WASTE_FIELDS: McField[] = [
  {
    name: 'solverMaxWastePercentage', label: 'Hao hụt tối đa (%)', integer: false, min: 0.1, max: 100,
    help: `Ngưỡng hao hụt mặc định của một loại sắt khi tính phương án cắt; vượt ngưỡng thì báo. Mặc định ${fmtNum(1)}.`,
    more: 'Hao hụt chỉ tính khúc thừa cuối cây (cùi) trên tổng chiều dài cây mua; tề đầu, lưỡi cắt và đoạn dư không tính.',
  },
  {
    name: 'solverMaxSurplus', label: 'Dư tối đa mỗi cỡ đoạn (đoạn)', integer: true, min: 0, max: 1000,
    help: `Mỗi cỡ đoạn được cắt dư tối đa chừng này đoạn so với nhu cầu (phần dư vào kho). Mặc định ${fmtNum(10)}.`,
  },
  {
    // Nhãn ngắn để ô nhập không xuống 2 dòng, thấp hơn ô bên cạnh.
    name: 'solverTimeLimitSeconds', label: 'Thời gian giải tối đa (giây)', integer: true, min: 1, max: 1700,
    help: `Ngân sách thời gian bộ giải cho một loại sắt. Mặc định ${fmtNum(20)}.`,
    more: 'Tăng thì có thể ra kết quả tốt hơn nhưng KHSX chờ lâu hơn.',
  },
]

export const SHARED_LENGTH_FIELDS: McField[] = [
  {
    name: 'solverMinLengthMm', label: 'Cây đặt riêng ngắn nhất (mm)', integer: true, min: 500, max: 20000,
    help: `Chiều dài cây đặt riêng ngắn nhất bộ giải được chọn. Mặc định ${fmtNum(4000)}.`,
  },
  {
    name: 'solverMaxLengthMm', label: 'Cây đặt riêng dài nhất (mm)', integer: true, min: 500, max: 20000,
    help: `Chiều dài cây đặt riêng dài nhất bộ giải được chọn; không nhỏ hơn ô ngắn nhất. Mặc định ${fmtNum(6500)}.`,
  },
  {
    // BE: bước dò chỉ nhận bội 50, từ 50 trở lên - cây đặt riêng luôn tròn 5 cm (kiểm bội 50 ở validateConfig).
    name: 'solverLengthStepMm', label: 'Bước dò chiều dài (mm)', integer: true, min: 50, max: 1000,
    help: `Bộ giải thử các chiều dài cây đặt riêng cách nhau chừng này mm. Phải là bội 50. Mặc định ${fmtNum(50)}.`,
    more: 'Bội 50 (50, 100, 150…) vì cây đặt riêng luôn tròn 5 cm. '
      + 'Bộ giải dò từ cây chuẩn ra hai phía (vd 6.000, 5.950, 6.050, 5.900, 6.100…) '
      + 'trong khoảng ngắn nhất – dài nhất, và lấy chiều dài đầu tiên đạt ngưỡng hao hụt, tức gần cây chuẩn nhất.',
  },
]
export const SHARED_FIELDS = [...SHARED_WASTE_FIELDS, ...SHARED_LENGTH_FIELDS]

export const STOCK_LENGTHS_HELP = 'Chiều dài cây sắt nguyên NCC có sẵn hàng (mm). Nhiều cỡ thì cách nhau bằng dấu cách, '
  + `vd: 6000 5850. Mặc định ${fmtNum(6000)}.`
export const STOCK_LENGTHS_MORE = `Mỗi số từ ${fmtNum(500)} đến ${fmtNum(20000)}, tối đa 10 số.`

/** Gợi ý gộp đơn ở màn Tối ưu cắt sắt - áp cho cả hai máy nên đứng ở nhóm "Bộ giải và gộp đơn". Cùng khối với trần số SKU mỗi
 *  lệnh gộp: hai con số này cùng định ra "một lệnh gộp được to đến đâu". */
export const MERGE_WINDOW_FIELD: McField = {
  name: 'solverMergeWindowDays', label: 'Gộp lệnh có mốc cần sắt trong khung (ngày)', integer: true, min: 1, max: 365,
  // Luật cứng, mặc định 5. "Mốc cần sắt" = ngày Mua VT khung & đan của SKU (chưa có thì ngày Khung cơ khí).
  // Khung tính CẢ HAI ĐẦU (5 = ngày 10 gộp được ngày 14, không gộp ngày 15) nên chênh tối đa N-1 ngày; min 1.
  help: 'Luật cứng: các SKU gộp chung phải có “mốc cần sắt” nằm trong một khung chừng này ngày, tính cả hai đầu. '
    + `Mặc định ${fmtNum(5)}; nhập 1 = chỉ gộp SKU cùng ngày.`,
  more: '“Mốc cần sắt” là ngày Mua VT khung & đan, chưa có thì ngày Khung cơ khí. '
    + 'Ví dụ khung 5 ngày: ngày 10 gộp được với các ngày 11, 12, 13 và 14, KHÔNG gộp được với ngày 15 (chênh tối đa 4 ngày). '
    + 'Vi phạm thì KHSX không tính được phương án, không gộp được và không lưu được mốc thời gian — '
    + 'phải dời mốc hoặc tách SKU ra lệnh riêng. '
    + 'Màn Tối ưu cắt sắt cũng chỉ gợi ý gộp trong khung này. SKU chưa có mốc không bị chặn.',
}
export const MERGE_MAX_SKUS_FIELD: McField = {
  name: 'solverMergeMaxSkus', label: 'Số SKU gộp tối đa mỗi lệnh', integer: true, min: 1, max: 50,
  help: `Một lệnh gộp (và một đợt tính phương án cắt) có tối đa chừng này SKU. Mặc định ${fmtNum(2)}.`,
}
export const MERGE_FIELDS = [MERGE_WINDOW_FIELD, MERGE_MAX_SKUS_FIELD]

/** Thể tích cont 40HC: mẫu số của load cont mọi SKU. 2 số lẻ; lưu xong BE tính lại load cont của mọi SKU. */
export const CONTAINER_VOLUME_FIELD: McField = {
  name: 'containerVolumeM3', label: 'Thể tích cont 40HC (m³)', integer: false, min: 1, max: 200,
  help: 'Dùng tính load cont của SKU. Đổi số này thì hệ thống tính lại load cont của mọi SKU. Mặc định 68.',
}
/** Năng lực sản xuất - chỉ để CẢNH BÁO (tab "Năng lực" ở Tổng hợp lệnh SX, hộp QLSX), không khoá việc nào. */
export const CAPACITY_FIELDS: McField[] = [
  {
    name: 'capacityContPerDay', label: 'Cont/ngày mỗi xưởng Phú An và mỗi kho đóng gói', integer: false, min: 0.1, max: 20,
    help: 'Trần số cont làm trong 1 ngày ở mỗi công đoạn của xưởng Phú An và ở mỗi kho đóng gói. '
      + 'Vượt thì chỉ báo, không chặn. Mặc định 1,3.',
  },
  {
    name: 'daysPerContPhuocAn', label: 'Xưởng Phước An: số ngày cho 1 cont (Phôi, Hàn)', integer: true, min: 1, max: 60,
    help: 'Phước An làm theo khối: 1 cont chiếm chừng này ngày; 2 lệnh cùng chiếm 1 ngày thì báo. Mặc định 4.',
  },
  // Khoảng được về của màn "Vật tư cần về" và dòng "về từ" ở form Sửa thời hạn.
  {
    name: 'materialEarliestArrivalDays', label: 'Vật tư được về sớm nhất trước hạn chót (ngày)', integer: true, min: 0, max: 30,
    help: 'Vật tư chỉ được về trong khoảng từ (hạn chót trừ chừng này ngày) đến hạn chót; '
      + 'hạn chót hôm nay mà chưa về đủ thì báo đỏ. Mặc định 4; nhập 0 = chỉ về đúng ngày hạn chót.',
  },
]
/** Mặc định hiện ở ô năng lực khi DB chưa có giá trị. */
export const CAPACITY_DEFAULTS: Record<string, number> = { capacityContPerDay: 1.3, daysPerContPhuocAn: 4, materialEarliestArrivalDays: 4 }

export const MC_FACTORS_HELP = 'Số cây cắt cùng lúc trong một bó. Nhập các số cách nhau bằng dấu cách, vd: 14 16 18 20. '
  + 'Mặc định 14 16 18 20.'
export const MC_FACTORS_MORE = 'Mỗi số là số nguyên lớn hơn 1, tối đa 8 số. '
  + 'Chỉ dùng khi bảng “Số cây/bó theo quy cách” bên dưới trống; bảng có dữ liệu thì bảng đó được ưu tiên.'
export const MC_FACTORS_LOCKED = 'Đang dùng bảng theo quy cách bên dưới; ô này chỉ dùng khi bảng trống.'

/** Bảng "Số cây/bó theo quy cách": mỗi dòng 1 quy cách. Mã V<cạnh> (sắt vuông), H<a>-<b> (sắt hộp), FI<đường kính> (sắt phi). */
export const SPEC_CODE_RE = /^(V\d+|H\d+-\d+|FI\d+)$/
export type SpecRow = { key: number; code: string; factors: string }
export const MC_SPEC_HELP = 'Loại sắt có quy cách trong bảng dùng đúng các số cây/bó này. Xoá hết bảng = dùng “Hệ số bó” chung.'
export const MC_SPEC_MORE = 'Quy cách ngoài bảng thì không tính được với MC Tự động: hệ thống báo KHSX hỏi Sếp số cây/bó, '
  + 'thêm vào bảng rồi tính lại.'

export const fmtMcNum = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','))

const MC_TAB_KEYS: McKey[] = [...LASER_FIELDS, ...MC_NUM_FIELDS, ...SHARED_FIELDS, ...MERGE_FIELDS]
  .map((f) => f.name as McKey)
  .concat('solverBundleFactors', 'solverBundleFactorsBySpec', 'solverStockLengths')
export const tabOfKey = (k: McKey): TabId => (MC_TAB_KEYS.includes(k) || k.startsWith(WS_SIZES_PREFIX) ? 'may-cat' : 'ke-hoach')

/** Tab Máy cắt: bấm thẻ máy nào thì chỉ hiện thông số của máy đó; bấm thẻ chỉ để XEM/SỬA, không đổi máy mặc định (đổi bằng nút
 *  "Đặt làm máy mặc định" trong khung thông số). */
export const MACHINE_KEYS: Record<SolverMachine, McKey[]> = {
  laser: LASER_FIELDS.map((f) => f.name as McKey),
  tu_dong: [...MC_NUM_FIELDS.map((f) => f.name as McKey), 'solverBundleFactors', 'solverBundleFactorsBySpec'],
}
export const machineOfKey = (k: McKey): SolverMachine | null =>
  MACHINE_KEYS.laser.includes(k) ? 'laser' : MACHINE_KEYS.tu_dong.includes(k) ? 'tu_dong' : null
export const MACHINE_DESC: Record<SolverMachine, string> = {
  laser: 'Cắt từng cây',
  tu_dong: 'Cắt theo bó nhiều cây một lần, phần lẻ cắt tay',
}

'use client'
import { useState } from 'react'
import { Building2, CheckCircle2, ClipboardList, QrCode, Scissors, Settings } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import { useAuditLog } from '../../../context/AuditLogContext'
import { getNetworkInfo, getSystemConfig, updateSystemConfig } from '../../../services/api'
import type { NetworkInfo } from '../../../services/system-config-api'
import type { SolverMachine, SystemConfig } from '../../../types/admin'
import { MACHINE_LABEL } from '../../../utils/cutMachine'
import LoadingState from '../../../components/LoadingState'
import LoadErrorState from '../../../components/LoadErrorState'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
// Phần A – Đợt 2: tiền tố số LSX
import { LSX_PREFIX_PATTERN, parseLsxPrefixes } from '../../../utils/lenhCode'
import { invalidateLsxPrefixes } from '../../../hooks/useLsxPrefixes'
import { invalidatePlanningParams } from '../../../hooks/usePlanningParams'

/** Card này là form nhập chữ — chỉ nhận các field chữ của SystemConfig, không nhận field boolean
 *  (vd solverAllowCustomLength, thuộc nghiệp vụ cắt sắt chứ không phải thông tin công ty). */
type TextField = {
  [K in keyof SystemConfig]-?: SystemConfig[K] extends string | undefined ? (string extends SystemConfig[K] ? K : never) : never
}[keyof SystemConfig]

const FIELDS: { name: TextField | 'floorPublicUrl'; label: string; required?: boolean; help?: string; placeholder?: string }[] = [
  { name: 'companyName', label: 'Tên công ty', required: true },
  { name: 'companyAddress', label: 'Địa chỉ' },
  { name: 'companyPhone', label: 'Điện thoại' },
  { name: 'companyEmail', label: 'Email' },
  { name: 'taxCode', label: 'Mã số thuế' },
  { name: 'defaultCurrency', label: 'Đơn vị tiền tệ mặc định', required: true },
  {
    name: 'floorPublicUrl',
    label: 'Địa chỉ ERP dùng cho tem QR máy xưởng',
    placeholder: 'https://erpdna.vercel.app',
    help: 'Mã QR dán ở máy xưởng là link tới trang báo sản lượng của công nhân - địa chỉ này là phần đầu của link. Điền địa chỉ thật mà điện thoại ở xưởng mở được; ' +
      'để trống = dùng địa chỉ đang mở khi QLSX in tem. Mỗi hệ thống (thử/thật) tự đặt riêng - máy thử để trống. ' +
      'ĐÃ DÁN TEM rồi thì đừng đổi: tem cũ chỉ còn quét được nếu địa chỉ cũ vẫn hoạt động.',
  },
]

/** Nhóm "Máy cắt" - cấu hình thật cho bộ giải Đề xuất thanh sắt (màn Tối ưu cắt sắt đọc). Các tham số số nhập dạng
 *  chữ (giữ được lúc đang gõ dở "2,"), chỉ đổi thành số + kiểm tra khi bấm Lưu. */
type McNumName = 'solverMaxWastePercentage' | 'solverMaxSurplus' | 'solverMinLengthMm' | 'solverMaxLengthMm' | 'solverLengthStepMm' | 'solverTimeLimitSeconds' |
  'solverBladeWidthMm' | 'solverTrimStartMm' | 'solverMctdBladeWidthMm' | 'solverMctdTrimStartMm' | 'solverMaxManualCuts' | 'solverMaxSizesPerPattern' | 'solverMergeWindowDays' | 'solverMergeMaxSkus' | 'containerVolumeM3' | 'capacityContPerDay' | 'daysPerContPhuocAn' | 'materialEarliestArrivalDays'
type McKey = McNumName | 'solverBundleFactors' | 'solverStockLengths'
const MC_NUM_FIELDS: { name: McNumName; label: string; help: string; integer: boolean; min: number; max: number }[] = [
  {
    name: 'solverMctdBladeWidthMm', label: 'Lưỡi cắt (mm)', integer: false, min: 0, max: 10,
    help: 'Bề dày lưỡi cắt: mỗi nhát cắt mất đi chừng này trên cây sắt. Mặc định 2,5.',
  },
  {
    name: 'solverMctdTrimStartMm', label: 'Tề đầu (mm)', integer: true, min: 0, max: 100,
    help: 'Phần đầu cây cắt bỏ trước khi cắt đoạn đầu tiên, tính bằng mm nguyên. Mặc định 0 (không tề).',
  },
  {
    name: 'solverMaxManualCuts', label: 'Số cây cắt tay tối đa', integer: true, min: 0, max: 100,
    help: 'Phần lẻ không đủ một bó thì cắt từng cây (cắt tay). Mỗi loại sắt được cắt tay tối đa chừng này cây. Mặc định 5; nhập 0 = không cho cắt tay.',
  },
  {
    name: 'solverMaxSizesPerPattern', label: 'Số cỡ đoạn tối đa mỗi kiểu cắt', integer: true, min: 1, max: 10,
    help: 'Một kiểu cắt (cách cắt chung của một bó) có tối đa chừng này cỡ đoạn khác nhau. Mặc định 5.',
  },
]
/** Thông số MC Laser (11/11): cặp lưỡi cắt / tề đầu RIÊNG của MC Laser (BE: solverBladeWidthMm / solverTrimStartMm), tách khỏi
 *  cặp của MC Tự động. Trước đây chỉ đổi được qua API; cùng khoảng giá trị với cặp MC Tự động. */
const LASER_FIELDS: (typeof MC_NUM_FIELDS)[number][] = [
  {
    name: 'solverBladeWidthMm', label: 'Lưỡi cắt (mm)', integer: false, min: 0, max: 10,
    help: 'Bề dày lưỡi cắt laser: mỗi nhát cắt mất đi chừng này trên cây sắt. Mặc định 1.',
  },
  {
    name: 'solverTrimStartMm', label: 'Tề đầu (mm)', integer: true, min: 0, max: 100,
    help: 'Phần đầu cây cắt bỏ trước khi cắt đoạn đầu tiên, tính bằng mm nguyên. Mặc định 10.',
  },
]
/** Thông số chung của bộ giải, áp cho CẢ HAI máy (12/11): BE có từ trước, API sửa được nhưng màn này chưa có ô. Màn Tối ưu
 *  cắt sắt chỉ hiện để xem ("Xem thông số máy cắt"). Cây chuẩn (danh sách số) và "Cho đặt cây riêng" (bật/tắt) nằm riêng. */
const SHARED_WASTE_FIELDS: (typeof MC_NUM_FIELDS)[number][] = [
  {
    name: 'solverMaxWastePercentage', label: 'Hao hụt tối đa (%)', integer: false, min: 0.1, max: 100,
    help: 'Ngưỡng hao hụt mặc định của một loại sắt khi tính phương án cắt; vượt ngưỡng thì báo. Mặc định 1.',
  },
  {
    name: 'solverMaxSurplus', label: 'Dư tối đa mỗi cỡ đoạn (đoạn)', integer: true, min: 0, max: 1000,
    help: 'Mỗi cỡ đoạn được cắt dư tối đa chừng này đoạn so với nhu cầu (phần dư vào kho). Mặc định 10.',
  },
  {
    name: 'solverTimeLimitSeconds', label: 'Thời gian chạy tối đa mỗi loại sắt (giây)', integer: true, min: 1, max: 1700,
    help: 'Ngân sách thời gian bộ giải cho một loại sắt. Tăng thì có thể ra kết quả tốt hơn nhưng KHSX chờ lâu hơn. Mặc định 20.',
  },
]
const SHARED_LENGTH_FIELDS: (typeof MC_NUM_FIELDS)[number][] = [
  {
    name: 'solverMinLengthMm', label: 'Cây đặt riêng ngắn nhất (mm)', integer: true, min: 500, max: 20000,
    help: 'Chiều dài cây đặt riêng ngắn nhất bộ giải được chọn. Mặc định 5000.',
  },
  {
    name: 'solverMaxLengthMm', label: 'Cây đặt riêng dài nhất (mm)', integer: true, min: 500, max: 20000,
    help: 'Chiều dài cây đặt riêng dài nhất bộ giải được chọn; không nhỏ hơn ô bên cạnh. Mặc định 6000.',
  },
  {
    name: 'solverLengthStepMm', label: 'Bước dò chiều dài (mm)', integer: true, min: 1, max: 1000,
    help: 'Bộ giải thử các chiều dài cây đặt riêng cách nhau chừng này mm, trong khoảng ngắn nhất – dài nhất. Mặc định 10.',
  },
]
const SHARED_FIELDS = [...SHARED_WASTE_FIELDS, ...SHARED_LENGTH_FIELDS]
const STOCK_LENGTHS_HELP = 'Chiều dài cây sắt nguyên NCC có sẵn hàng (mm). Nhiều cỡ thì cách nhau bằng dấu cách, vd: 6000 5850. Mỗi số từ 500 đến 20000, tối đa 10 số. Mặc định 6000.'
/** Gợi ý gộp đơn ở màn Tối ưu cắt sắt (2026-10-24) - áp cho cả hai máy nên đứng riêng, không nằm trong "Thông số MC Tự động".
 *  Cùng khối với trần số SKU mỗi lệnh gộp: hai con số này cùng định ra "một lệnh gộp được to đến đâu". */
const MERGE_WINDOW_FIELD: (typeof MC_NUM_FIELDS)[number] = {
  name: 'solverMergeWindowDays', label: 'Gộp lệnh có mốc cần sắt trong khung (ngày)', integer: true, min: 1, max: 365,
  // 2026-10-24 (Sếp chốt): từ gợi ý mềm thành LUẬT CỨNG, mặc định 7 -> 3. "Mốc cần sắt" = ngày Mua VT khung & đan của SKU (chưa có thì ngày Khung cơ khí; tên cũ "Mua hàng", đổi 2026-10-27).
  // Làm rõ cùng ngày: khung tính CẢ HAI ĐẦU (3 = ngày 1 gộp được ngày 3, không gộp ngày 4) nên chênh tối đa N-1 ngày; min 1 (không còn 0).
  help: 'Luật cứng của lệnh gộp: các SKU gộp chung phải có “mốc cần sắt” (ngày Mua VT khung & đan, chưa có thì ngày Khung cơ khí) nằm trong một khung chừng này ngày, tính cả ngày đầu và ngày cuối. ' +
    'Ví dụ khung 3 ngày: ngày 1 gộp được với ngày 2 và ngày 3, KHÔNG gộp được với ngày 4 (chênh tối đa 2 ngày). ' +
    'Vi phạm thì KHSX không tính được phương án, không gộp được và không lưu được mốc thời gian — phải dời mốc hoặc tách SKU ra lệnh riêng. ' +
    'Màn Tối ưu cắt sắt cũng chỉ gợi ý gộp trong khung này. SKU chưa có mốc không bị chặn. Mặc định 3; nhập 1 = chỉ gộp SKU cùng ngày.',
}
const MERGE_MAX_SKUS_FIELD: (typeof MC_NUM_FIELDS)[number] = {
  name: 'solverMergeMaxSkus', label: 'Số SKU gộp tối đa mỗi lệnh', integer: true, min: 1, max: 50,
  help: 'Một lệnh gộp (và một đợt tính phương án cắt) có tối đa chừng này SKU. Mặc định 2.',
}
const MERGE_FIELDS = [MERGE_WINDOW_FIELD, MERGE_MAX_SKUS_FIELD]
/** Thể tích cont 40HC (Phần A YC9): mẫu số của load cont mọi SKU. 2 số lẻ; lưu xong BE tính lại load cont của mọi SKU. */
const CONTAINER_VOLUME_FIELD: (typeof MC_NUM_FIELDS)[number] = {
  name: 'containerVolumeM3', label: 'Thể tích cont 40HC (m³)', integer: false, min: 1, max: 200,
  help: 'Dùng tính load cont của SKU. Đổi số này thì hệ thống tính lại load cont của mọi SKU. Mặc định 68.',
}
/** Phần A – Đợt 3 (YC10): năng lực sản xuất - chỉ để CẢNH BÁO (tab "Năng lực" ở Tổng hợp lệnh SX, hộp QLSX), không khoá việc nào. */
const CAPACITY_FIELDS: (typeof MC_NUM_FIELDS)[number][] = [
  {
    name: 'capacityContPerDay', label: 'Cont/ngày mỗi xưởng Phú An và mỗi kho đóng gói', integer: false, min: 0.1, max: 20,
    help: 'Trần số cont làm trong 1 ngày ở mỗi công đoạn của xưởng Phú An và ở mỗi kho đóng gói. Vượt thì chỉ báo, không chặn. Mặc định 1,3.',
  },
  {
    name: 'daysPerContPhuocAn', label: 'Xưởng Phước An: số ngày cho 1 cont (Phôi, Hàn)', integer: true, min: 1, max: 60,
    help: 'Phước An làm theo khối: 1 cont chiếm chừng này ngày; 2 lệnh cùng chiếm 1 ngày thì báo. Mặc định 4.',
  },
  // Phần A – Đợt 4 (YC6): khoảng được về của màn "Vật tư cần về" và dòng "về từ" ở form Sửa thời hạn.
  {
    name: 'materialEarliestArrivalDays', label: 'Vật tư được về sớm nhất trước hạn chót (ngày)', integer: true, min: 0, max: 30,
    help: 'Vật tư chỉ được về trong khoảng từ (hạn chót trừ chừng này ngày) đến hạn chót; hạn chót hôm nay mà chưa về đủ thì báo đỏ. Mặc định 4; nhập 0 = chỉ về đúng ngày hạn chót.',
  },
]
const MC_FACTORS_HELP = 'Số cây cắt cùng lúc trong một bó. Nhập các số cách nhau bằng dấu cách, vd: 14 16 18 20. Mỗi số là số nguyên lớn hơn 1, tối đa 8 số. Mặc định 14 16 18 20.'
const fmtMcNum = (n: number | undefined) => (n == null ? '' : String(n).replace('.', ','))

const inputStyle = { width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)' }

/** Màn chia thành các nhóm (tab) thay vì một trang dài gom tất cả (yêu cầu 11/11). Nút "Lưu thay đổi" vẫn lưu MỌI nhóm cùng lúc:
 *  sửa ở nhiều tab rồi lưu một lần; ô sai nằm ở tab khác thì màn tự chuyển sang tab đó và tab có lỗi được đánh dấu. */
type TabId = 'cong-ty' | 'xuong' | 'may-cat' | 'ke-hoach'
const TABS: { id: TabId; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'cong-ty', label: 'Công ty', icon: <Building2 size={15} />, desc: 'Thông tin chung của công ty, chỉ để tham khảo.' },
  { id: 'xuong', label: 'Xưởng & tem QR', icon: <QrCode size={15} />, desc: 'Địa chỉ in trên tem QR máy xưởng (màn Sản lượng xưởng đọc).' },
  { id: 'may-cat', label: 'Máy cắt', icon: <Scissors size={15} />, desc: 'Cấu hình thật của màn Tối ưu cắt sắt.' },
  { id: 'ke-hoach', label: 'Kế hoạch sản xuất', icon: <ClipboardList size={15} />, desc: 'Tiền tố số LSX, thể tích cont và năng lực sản xuất.' },
]
const MC_TAB_KEYS: McKey[] = [...LASER_FIELDS, ...MC_NUM_FIELDS, ...SHARED_FIELDS, ...MERGE_FIELDS]
  .map((f) => f.name as McKey)
  .concat('solverBundleFactors', 'solverStockLengths')
const tabOfKey = (k: McKey): TabId => (MC_TAB_KEYS.includes(k) ? 'may-cat' : 'ke-hoach')
/** Tab Máy cắt (12/11): bấm thẻ máy nào thì chỉ hiện thông số của máy đó; bấm thẻ chỉ để XEM/SỬA, không đổi máy mặc định
 *  (đổi bằng nút "Đặt làm máy mặc định" trong khung thông số) - để sửa thông số MC Tự động mà không lỡ đổi máy mặc định. */
const MACHINE_KEYS: Record<SolverMachine, McKey[]> = {
  laser: LASER_FIELDS.map((f) => f.name as McKey),
  tu_dong: [...MC_NUM_FIELDS.map((f) => f.name as McKey), 'solverBundleFactors'],
}
const machineOfKey = (k: McKey): SolverMachine | null =>
  MACHINE_KEYS.laser.includes(k) ? 'laser' : MACHINE_KEYS.tu_dong.includes(k) ? 'tu_dong' : null
const MACHINE_DESC: Record<SolverMachine, string> = { laser: 'Cắt từng cây', tu_dong: 'Cắt theo bó nhiều cây một lần, phần lẻ cắt tay' }
const MACHINE_PANEL_STYLE: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface)' }
const fieldTab = (name: TextField | 'floorPublicUrl'): TabId => (name === 'floorPublicUrl' ? 'xuong' : 'cong-ty')

export default function SystemConfigPage() {
  const { data, isLoading, error: loadError, refetch } = useFetch<SystemConfig>(getSystemConfig)
  const { logAction } = useAuditLog()
  // Chỉnh sửa được giữ dưới dạng "draft" đè lên dữ liệu đã fetch, thay vì đồng bộ qua
  // useEffect+setState (dễ gây render lồng) — draft reset về rỗng sau mỗi lần lưu thành công.
  const [draft, setDraft] = useState<Partial<SystemConfig>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Giờ lưu thành công gần nhất - giữ tới khi sửa tiếp (chữ "Đã lưu" cũ tự tắt sau 2,5 giây, dễ tưởng chưa lưu).
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [tab, setTab] = useState<TabId>('cong-ty')
  // Máy đang xem thông số ở tab Máy cắt; null = theo máy mặc định đã lưu.
  const [mcView, setMcView] = useState<SolverMachine | null>(null)
  // IP mà BE thấy của người đang mở màn này (nút "Thêm IP hiện tại của tôi")
  const [netInfo, setNetInfo] = useState<NetworkInfo | null>(null)
  const [netBusy, setNetBusy] = useState(false)
  const [netError, setNetError] = useState<string | null>(null)
  const [netNote, setNetNote] = useState('')
  // Chữ đang gõ của nhóm "Máy cắt" (khoá = tên field; hệ số bó dùng khoá solverBundleFactors). Về rỗng sau mỗi lần lưu thành công.
  const [mcText, setMcText] = useState<Partial<Record<McKey, string>>>({})
  // Lỗi kiểm tra hiện NGAY dưới ô sai (kèm aria-invalid/aria-describedby), không chỉ một dòng chung ở cuối form.
  const [mcErrors, setMcErrors] = useState<Partial<Record<McKey, string>>>({})

  const values: SystemConfig | null = data ? { ...data, ...draft } : null

  // Phần A – Đợt 2: chữ đang gõ ở ô "Tiền tố số LSX" (undefined = chưa sửa); lỗi hiện dưới ô. Về rỗng sau mỗi lần lưu thành công.
  const [lsxText, setLsxText] = useState<string | undefined>(undefined)
  const lsxPrefixError = (text: string): string | null => {
    const bad = parseLsxPrefixes(text).filter((p) => !LSX_PREFIX_PATTERN.test(p))
    return bad.length > 0 ? `Tiền tố sai: ${bad.join(', ')} - mỗi tiền tố gồm 1 đến 6 chữ cái (không số, không dấu gạch)` : null
  }

  const ipLines = values?.floorAllowedIps ?? []
  const addMyIp = async () => {
    setNetBusy(true); setNetError(null)
    try {
      const info = await getNetworkInfo()
      setNetInfo(info)
      // IP nội bộ/loopback: BE chưa thấy IP thật (local, hoặc chưa khai TRUST_PROXY_HOPS) - thêm vào chỉ vô ích, nên không tự thêm.
      const have = ipLines.map((l) => l.split('#')[0].trim())
      if (info.ip && !info.isPrivate && !have.includes(info.ip)) {
        const note = netNote.trim().replace(/\s+/g, ' ')
        const line = note ? `${info.ip} # ${note}` : info.ip
        setDraft(d => ({ ...d, floorAllowedIps: [...ipLines.filter((l) => l.trim()), line] }))
        setNetNote('')
      }
    } catch (e) {
      setNetError(e instanceof Error ? e.message : 'Không lấy được IP hiện tại')
    } finally {
      setNetBusy(false)
    }
  }

  const handleSave = async () => {
    if (!values) return
    if (!values.companyName.trim()) { setTab('cong-ty'); setError('Tên công ty là bắt buộc'); return }
    if (!values.defaultCurrency.trim()) { setTab('cong-ty'); setError('Đơn vị tiền tệ là bắt buộc'); return }
    // Nhóm "Máy cắt": đổi chữ đang gõ thành số, báo lỗi ngay tại đây thay vì để BE trả 400.
    const next: SystemConfig = { ...values }
    const errs: Partial<Record<McKey, string>> = {}
    for (const f of [...LASER_FIELDS, ...MC_NUM_FIELDS, ...SHARED_FIELDS, ...MERGE_FIELDS, CONTAINER_VOLUME_FIELD, ...CAPACITY_FIELDS]) {
      const raw = mcText[f.name]
      if (raw === undefined) continue
      const n = Number(raw.trim().replace(',', '.'))
      if (raw.trim() === '' || !Number.isFinite(n) || n < f.min || n > f.max || (f.integer && !Number.isInteger(n))) {
        errs[f.name] = `Phải là ${f.integer ? 'số nguyên' : 'số'} từ ${f.min} đến ${f.max}`
        continue
      }
      // Thể tích cont giữ 2 số lẻ (BE cũng làm tròn 2 số lẻ).
      next[f.name] = f.name === 'containerVolumeM3' || f.name === 'capacityContPerDay' ? Math.round(n * 100) / 100
        // Hao hụt tối đa: cột DB Decimal(6,3).
        : f.name === 'solverMaxWastePercentage' ? Math.round(n * 1000) / 1000
        : n
    }
    if (mcText.solverStockLengths !== undefined) {
      const parts = mcText.solverStockLengths.split(/[\s,;]+/).filter(Boolean).map(Number)
      if (parts.length < 1 || parts.length > 10 || parts.some((n) => !Number.isInteger(n) || n < 500 || n > 20000)) {
        errs.solverStockLengths = 'Gồm 1 đến 10 số nguyên từ 500 đến 20000, cách nhau bằng dấu cách (vd 6000)'
      } else {
        next.solverStockLengths = [...new Set(parts)].sort((a, b) => a - b)
      }
    }
    // BE không kiểm cặp này - ngắn nhất lớn hơn dài nhất thì bộ giải không có chiều dài nào để dò.
    if (!errs.solverMinLengthMm && !errs.solverMaxLengthMm && next.solverMinLengthMm > next.solverMaxLengthMm) {
      errs.solverMaxLengthMm = 'Phải lớn hơn hoặc bằng “Cây đặt riêng ngắn nhất”'
    }
    if (mcText.solverBundleFactors !== undefined) {
      const parts = mcText.solverBundleFactors.split(/[\s,;]+/).filter(Boolean).map(Number)
      if (parts.length < 1 || parts.length > 8 || parts.some((n) => !Number.isInteger(n) || n <= 1)) {
        errs.solverBundleFactors = 'Gồm 1 đến 8 số nguyên lớn hơn 1, cách nhau bằng dấu cách (vd 14 16 18 20)'
      } else {
        next.solverBundleFactors = [...new Set(parts)].sort((a, b) => a - b)
      }
    }
    // Phần A – Đợt 2: tiền tố số LSX
    if (lsxText !== undefined) {
      if (lsxPrefixError(lsxText)) { setTab('ke-hoach'); setError('Ô “Tiền tố số LSX” chưa hợp lệ — xem thông báo màu đỏ dưới ô.'); return }
      next.lsxPrefixes = parseLsxPrefixes(lsxText)
    }
    setMcErrors(errs)
    const errKeys = Object.keys(errs) as McKey[]
    if (errKeys.length > 0) {
      // Ô sai đang ở tab đang mở thì ở lại; không thì chuyển sang tab của ô sai đầu tiên.
      if (!errKeys.some((k) => tabOfKey(k) === tab)) setTab(tabOfKey(errKeys[0]))
      // Cùng lẽ đó cho thẻ máy ở tab Máy cắt: máy đang xem không có ô sai thì chuyển sang máy có ô sai.
      const viewing = mcView ?? data?.solverMachine ?? 'laser'
      const errMachines = errKeys.map(machineOfKey).filter((m): m is SolverMachine => m !== null)
      if (errMachines.length > 0 && !errMachines.includes(viewing)) setMcView(errMachines[0])
      setError('Có ô chưa hợp lệ — xem thông báo màu đỏ dưới từng ô (tab có chấm đỏ).')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await updateSystemConfig(next)
      logAction('system-config', 'system-config', 'system_config.updated', values.companyName)
      setSavedAt(new Date())
      setDraft({})
      setMcText({})
      setMcErrors({})
      setLsxText(undefined)
      invalidateLsxPrefixes()
      invalidatePlanningParams()
      await refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể lưu cấu hình')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <LoadingState />
  if (loadError || !values) return <LoadErrorState error={loadError ?? 'Không rõ nguyên nhân'} onRetry={refetch} />

  const hasChanges = Object.keys(draft).length > 0 || Object.keys(mcText).length > 0 || lsxText !== undefined
  // Tab đang có ô sai (chấm đỏ trên nút tab) - để thấy ngay lỗi nằm ở nhóm nào khi đang đứng ở tab khác.
  const errTabs = new Set<TabId>((Object.keys(mcErrors) as McKey[]).filter((k) => mcErrors[k]).map(tabOfKey))
  if (lsxText !== undefined && lsxPrefixError(lsxText)) errTabs.add('ke-hoach')
  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0]
  const defaultMachine: SolverMachine = values.solverMachine ?? 'laser'
  const viewMachine: SolverMachine = mcView ?? data?.solverMachine ?? 'laser'
  const machineDirty = (m: SolverMachine) => MACHINE_KEYS[m].some((k) => mcText[k] !== undefined)
  const machineHasError = (m: SolverMachine) => MACHINE_KEYS[m].some((k) => mcErrors[k])
  const factors = values.solverBundleFactors ?? []
  const machineSummary: Record<SolverMachine, string> = {
    laser: `Lưỡi ${fmtMcNum(values.solverBladeWidthMm)} mm · Tề ${fmtMcNum(values.solverTrimStartMm)} mm`,
    tu_dong: `Lưỡi ${fmtMcNum(values.solverMctdBladeWidthMm)} mm · Tề ${fmtMcNum(values.solverMctdTrimStartMm)} mm` +
      (factors.length > 0 ? ` · Bó ${factors.length > 1 ? `${Math.min(...factors)}–${Math.max(...factors)}` : factors[0]} cây` : ''),
  }
  // Đầu khung thông số của máy đang xem: tên + trạng thái máy mặc định (đổi máy mặc định CHỈ bằng nút này).
  const machinePanelHeader = (m: SolverMachine) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Thông số {MACHINE_LABEL[m]}</div>
      {defaultMachine === m ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--fg-2e7d32)' }}>
          <CheckCircle2 size={14} aria-hidden /> Đang là máy mặc định
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setDraft(d => ({ ...d, solverMachine: m }))}
          title="Đợt cắt nào KHSX không chọn máy sẽ dùng máy mặc định. Bấm Lưu thay đổi để áp dụng."
          style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--fg-3949ab)', borderRadius: 8, background: 'var(--surface)', color: 'var(--fg-3949ab)', cursor: 'pointer' }}
        >
          Đặt làm máy mặc định
        </button>
      )}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings size={18} color="var(--fg-3949ab)" />
        <h2 style={{ ...pageTitle, margin: 0 }}>Cấu hình hệ thống</h2>
      </div>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-4)' }}>
        Chọn nhóm cần sửa ở các nút bên dưới. Nút “Lưu thay đổi” lưu mọi nhóm cùng lúc.
      </div>

      <div role="tablist" aria-label="Nhóm cấu hình" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, maxWidth: 720 }}>
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`cfg-tab-${t.id}`}
              aria-selected={active}
              aria-controls="cfg-tabpanel"
              onClick={() => setTab(t.id)}
              style={{
                position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                border: `1px solid ${active ? 'var(--fg-3949ab)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer',
                background: active ? 'var(--surface2)' : 'var(--surface)', color: active ? 'var(--fg-3949ab)' : 'var(--text2)',
              }}
            >
              {t.icon}{t.label}
              {errTabs.has(t.id) && (
                <span aria-label="có ô chưa hợp lệ" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-c62828)' }} />
              )}
            </button>
          )
        })}
      </div>

      <div id="cfg-tabpanel" role="tabpanel" aria-labelledby={`cfg-tab-${tab}`} className="card" style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{activeTab.desc}</div>
        {FIELDS.filter(f => fieldTab(f.name) === tab).map(f => (
          <div key={f.name}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              {f.label}{f.required && <span style={{ color: 'var(--fg-c62828)' }}> *</span>}
            </label>
            <input
              value={values[f.name] ?? ''}
              onChange={e => setDraft(d => ({ ...d, [f.name]: e.target.value }))}
              placeholder={f.placeholder}
              style={inputStyle}
            />
            {f.help && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>}
          </div>
        ))}

        {/* Phần A – Đợt 2: nhóm "Lệnh sản xuất" - tiền tố số LSX nhà máy (MY-313, GP-176) */}
        {tab === 'ke-hoach' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Lệnh sản xuất</div>
          {(() => {
            const text = lsxText ?? (values.lsxPrefixes ?? []).join(', ')
            const err = lsxPrefixError(text)
            return (
              <>
                <label htmlFor="lsx-prefixes" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Tiền tố số LSX</label>
                <input
                  id="lsx-prefixes"
                  value={text}
                  onChange={e => setLsxText(e.target.value)}
                  placeholder="MY, GP"
                  spellCheck={false}
                  aria-invalid={!!err}
                  aria-describedby="lsx-prefixes-help"
                  style={{ ...inputStyle, ...(err ? { border: '1px solid var(--fg-c62828)' } : {}) }}
                />
                {err && <div role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{err}</div>}
                <div id="lsx-prefixes-help" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                  Nhập nhiều tiền tố, cách nhau dấu phẩy (vd MY, GP). Để trống = chấp nhận mọi tiền tố. Số LSX có dạng TIỀN TỐ-SỐ, vd MY-313.
                </div>
              </>
            )
          })()}
        </div>
        )}

        {/* Giới hạn mạng công nhân (10/11/2026): công ty không dùng nên ẩn mục này. Chỉ hiện khi DB đang có IP (bật từ trước) để
            Admin còn xoá mà tắt; xoá hết + Lưu thì mục tự ẩn. BE vẫn giữ nguyên tính năng - cần dùng lại thì bỏ điều kiện này. */}
        {tab === 'xuong' && (data?.floorAllowedIps?.length ?? 0) > 0 && (
        <div>
          <label htmlFor="allowed-ips" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
            Mạng công ty được phép đăng nhập (công nhân)
          </label>
          <textarea
            id="allowed-ips"
            rows={4}
            value={ipLines.join('\n')}
            onChange={e => setDraft(d => ({ ...d, floorAllowedIps: e.target.value.split('\n') }))}
            placeholder={'203.0.113.5 # Văn phòng Quy Nhơn\n198.51.100.7 # Xưởng Tây Sơn'}
            spellCheck={false}
            style={{ ...inputStyle, fontFamily: 'monospace', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <input
              value={netNote}
              onChange={e => setNetNote(e.target.value)}
              maxLength={60}
              placeholder="Tên mạng (vd Văn phòng Quy Nhơn)"
              aria-label="Tên mạng ghi chú cho IP sắp thêm"
              style={{ ...inputStyle, width: 240 }}
            />
            <button type="button" onClick={() => void addMyIp()} disabled={netBusy}
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 600, border: '1px solid var(--border2)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', cursor: netBusy ? 'default' : 'pointer' }}>
              {netBusy ? 'Đang kiểm tra...' : 'Thêm IP hiện tại của tôi'}
            </button>
            {netInfo && (
              <span style={{ fontSize: 12, color: netInfo.isPrivate ? 'var(--amber)' : 'var(--text2)' }}
                title={`Chuỗi X-Forwarded-For BE nhận: ${netInfo.forwardedFor ?? '(không có)'} · BE đang tin ${netInfo.trustProxyHops} lớp proxy (TRUST_PROXY_HOPS)`}>
                Máy chủ thấy IP của bạn là <b>{netInfo.ip ?? 'không rõ'}</b>
                {netInfo.isPrivate ? ' - đây là IP nội bộ, chưa phải IP công cộng của công ty (đang chạy thử, hoặc máy chủ chưa khai số lớp proxy TRUST_PROXY_HOPS) nên chưa thêm.' : ''}
              </span>
            )}
          </div>
          {netInfo && !netInfo.isPrivate && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
              Kiểm tra: mở trang “what is my ip” trên cùng máy này - phải ra <b>đúng IP trên</b>. Khác (vd ra IP của Cloudflare/máy chủ) thì chỉnh biến TRUST_PROXY_HOPS
              của máy chủ (đang là {netInfo.trustProxyHops}; chuỗi nhận được: {netInfo.forwardedFor ?? 'không có'}) rồi bấm lại.
            </div>
          )}
          {netError && <div style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{netError}</div>}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
            Mỗi dòng 1 IP công cộng của công ty (vd 203.0.113.5) hoặc dải IPv4 (vd 203.0.113.0/24), có thể ghi chú sau dấu # để biết là địa điểm nào
            (văn phòng và xưởng ở 2 nơi sẽ có 2 IP khác nhau - thêm cả hai). <b>Để trống = không giới hạn.</b> Khi có IP, công nhân
            và tài khoản tổ Phôi/Hàn/Sơn chỉ đăng nhập và làm việc được khi nối mạng công ty - dùng 4G hoặc mạng ngoài sẽ bị chặn (người đang mở cũng bị
            chặn ngay). Sếp, QLSX, KCS, Admin không bị giới hạn. Công ty cần IP công cộng cố định; mở màn này từ mạng công ty rồi bấm “Thêm IP hiện tại của tôi”.
            {' '}<b style={{ color: 'var(--amber)' }}>Đang BẬT ({data?.floorAllowedIps?.length} mục).</b> Công ty hiện không dùng giới hạn này: xoá hết các dòng rồi bấm Lưu để tắt, mục sẽ tự ẩn.
          </div>
        </div>
        )}

        {/* Máy cắt: máy mặc định cho mọi đợt tính + thông số riêng của MC Tự động. KHSX vẫn chọn máy khác cho TỪNG đợt ở Tối ưu cắt sắt. */}
        {tab === 'may-cat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              <Scissors size={15} color="var(--fg-3949ab)" /> Máy cắt
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
              Áp cho màn <b>Tối ưu cắt sắt</b>. Mỗi đợt cắt KHSX vẫn chọn máy khác được ngay trên màn đó; đợt nào không chọn thì dùng máy mặc định dưới đây.
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Chọn máy để xem và sửa thông số</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['laser', 'tu_dong'] as SolverMachine[]).map((m) => {
                const selected = viewMachine === m
                return (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selected}
                    aria-controls="machine-params"
                    onClick={() => setMcView(m)}
                    style={{
                      flex: '1 1 240px', textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', font: 'inherit', color: 'var(--text)',
                      border: `${selected ? 2 : 1}px solid ${selected ? 'var(--fg-3949ab)' : 'var(--border)'}`, background: selected ? 'var(--surface2)' : 'var(--surface)',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13, fontWeight: 700 }}>
                      {MACHINE_LABEL[m]}
                      {defaultMachine === m && (
                        <span style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 10, color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)' }}>Mặc định</span>
                      )}
                      {machineHasError(m) ? (
                        <span title="Có ô chưa hợp lệ" aria-label="có ô chưa hợp lệ" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-c62828)' }} />
                      ) : machineDirty(m) && (
                        <span title="Có thay đổi chưa lưu" aria-label="có thay đổi chưa lưu" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-e65100)' }} />
                      )}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{MACHINE_DESC[m]}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{machineSummary[m]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {viewMachine === 'laser' && (
          <div id="machine-params" style={MACHINE_PANEL_STYLE}>
            {machinePanelHeader('laser')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
              {LASER_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode={f.integer ? 'numeric' : 'decimal'}
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { border: '1px solid var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
            </div>
          </div>
          )}

          {viewMachine === 'tu_dong' && (
          <div id="machine-params" style={MACHINE_PANEL_STYLE}>
            {machinePanelHeader('tu_dong')}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)' }}>
              {MC_NUM_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode={f.integer ? 'numeric' : 'decimal'}
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { border: '1px solid var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="mc-solverBundleFactors" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Hệ số bó</label>
                <input
                  id="mc-solverBundleFactors"
                  value={mcText.solverBundleFactors ?? (values.solverBundleFactors ?? []).join(' ')}
                  onChange={e => { setMcText(t => ({ ...t, solverBundleFactors: e.target.value })); setMcErrors(er => ({ ...er, solverBundleFactors: undefined })) }}
                  placeholder="14 16 18 20"
                  aria-invalid={mcErrors.solverBundleFactors ? true : undefined}
                  aria-describedby={`mc-solverBundleFactors-help${mcErrors.solverBundleFactors ? ' mc-solverBundleFactors-error' : ''}`}
                  style={{ ...inputStyle, ...(mcErrors.solverBundleFactors ? { border: '1px solid var(--fg-c62828)' } : null) }}
                />
                {mcErrors.solverBundleFactors && <div id="mc-solverBundleFactors-error" role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors.solverBundleFactors}</div>}
                <div id="mc-solverBundleFactors-help" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{MC_FACTORS_HELP}</div>
              </div>
            </div>
          </div>
          )}

          <div style={MACHINE_PANEL_STYLE}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Thông số chung (áp cho cả hai máy)</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, marginBottom: 10, lineHeight: 1.5 }}>Dùng cho mọi đợt tính phương án cắt, dù chọn máy nào.</div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Cây sắt</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="mc-solverStockLengths" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>Cây chuẩn (mm)</label>
                <input
                  id="mc-solverStockLengths"
                  value={mcText.solverStockLengths ?? (values.solverStockLengths ?? []).join(' ')}
                  onChange={e => { setMcText(t => ({ ...t, solverStockLengths: e.target.value })); setMcErrors(er => ({ ...er, solverStockLengths: undefined })) }}
                  placeholder="6000"
                  inputMode="numeric"
                  aria-invalid={mcErrors.solverStockLengths ? true : undefined}
                  aria-describedby={`mc-solverStockLengths-help${mcErrors.solverStockLengths ? ' mc-solverStockLengths-error' : ''}`}
                  style={{ ...inputStyle, ...(mcErrors.solverStockLengths ? { border: '1px solid var(--fg-c62828)' } : null) }}
                />
                {mcErrors.solverStockLengths && <div id="mc-solverStockLengths-error" role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors.solverStockLengths}</div>}
                <div id="mc-solverStockLengths-help" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{STOCK_LENGTHS_HELP}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={values.solverAllowCustomLength ?? true}
                    onChange={e => setDraft(d => ({ ...d, solverAllowCustomLength: e.target.checked }))}
                    aria-describedby="mc-solverAllowCustomLength-help"
                    style={{ width: 15, height: 15, accentColor: 'var(--fg-3949ab)' }}
                  />
                  Cho đặt cây riêng (ngoài cây chuẩn)
                </label>
                <div id="mc-solverAllowCustomLength-help" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>
                  Bật thì bộ giải được chọn cây dài khác cây chuẩn (cây “đặt riêng”, phải đặt NCC cán) trong khoảng dưới đây. Từng đợt cắt KHSX vẫn đổi được ở màn Tối ưu cắt sắt.
                </div>
              </div>
              {SHARED_LENGTH_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode="numeric"
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { border: '1px solid var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginTop: 14, marginBottom: 6 }}>Bộ giải</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
              {SHARED_WASTE_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode={f.integer ? 'numeric' : 'decimal'}
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { border: '1px solid var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Gợi ý gộp đơn (áp cho cả hai máy)</div>
            {/* Hai ô đứng cạnh nhau trên màn rộng, tự xếp chồng trên điện thoại (auto-fit, cùng kiểu lưới "Thông số MC Tự động"). */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
              {MERGE_FIELDS.map((f) => (
                <div key={f.name}>
                  <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                  <input
                    id={`mc-${f.name}`}
                    value={mcText[f.name] ?? fmtMcNum(values[f.name])}
                    onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                    inputMode="numeric"
                    aria-invalid={mcErrors[f.name] ? true : undefined}
                    aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                    style={{ ...inputStyle, ...(mcErrors[f.name] ? { border: '1px solid var(--fg-c62828)' } : null) }}
                  />
                  {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                  <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {/* Container 40HC: mẫu số của load cont (Phần A YC9) - không thuộc "Máy cắt" nên đứng khối riêng. */}
        {tab === 'ke-hoach' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
          <label htmlFor={`mc-${CONTAINER_VOLUME_FIELD.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{CONTAINER_VOLUME_FIELD.label}</label>
          <input
            id={`mc-${CONTAINER_VOLUME_FIELD.name}`}
            value={mcText.containerVolumeM3 ?? fmtMcNum(values.containerVolumeM3 ?? 68)}
            onChange={e => { setMcText(t => ({ ...t, containerVolumeM3: e.target.value })); setMcErrors(er => ({ ...er, containerVolumeM3: undefined })) }}
            inputMode="decimal"
            aria-invalid={mcErrors.containerVolumeM3 ? true : undefined}
            aria-describedby={`mc-containerVolumeM3-help${mcErrors.containerVolumeM3 ? ' mc-containerVolumeM3-error' : ''}`}
            style={{ ...inputStyle, maxWidth: 230, ...(mcErrors.containerVolumeM3 ? { border: '1px solid var(--fg-c62828)' } : null) }}
          />
          {mcErrors.containerVolumeM3 && <div id="mc-containerVolumeM3-error" role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors.containerVolumeM3}</div>}
          <div id="mc-containerVolumeM3-help" style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{CONTAINER_VOLUME_FIELD.help}</div>
        </div>
        )}

        {/* Phần A – Đợt 3 (YC10): năng lực sản xuất, chỉ cảnh báo. */}
        {tab === 'ke-hoach' && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Năng lực sản xuất (chỉ cảnh báo)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 'var(--space-3)', alignItems: 'start' }}>
            {CAPACITY_FIELDS.map((f) => (
              <div key={f.name}>
                <label htmlFor={`mc-${f.name}`} style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>{f.label}</label>
                <input
                  id={`mc-${f.name}`}
                  value={mcText[f.name] ?? fmtMcNum(values[f.name] ?? (f.name === 'capacityContPerDay' ? 1.3 : 4))}
                  onChange={e => { setMcText(t => ({ ...t, [f.name]: e.target.value })); setMcErrors(er => ({ ...er, [f.name]: undefined })) }}
                  inputMode={f.integer ? 'numeric' : 'decimal'}
                  aria-invalid={mcErrors[f.name] ? true : undefined}
                  aria-describedby={`mc-${f.name}-help${mcErrors[f.name] ? ` mc-${f.name}-error` : ''}`}
                  style={{ ...inputStyle, ...(mcErrors[f.name] ? { border: '1px solid var(--fg-c62828)' } : null) }}
                />
                {mcErrors[f.name] && <div id={`mc-${f.name}-error`} role="alert" style={{ color: 'var(--fg-c62828)', fontSize: 12, marginTop: 4 }}>{mcErrors[f.name]}</div>}
                <div id={`mc-${f.name}-help`} style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, lineHeight: 1.5 }}>{f.help}</div>
              </div>
            ))}
          </div>
        </div>
        )}

        {error && <div style={{ color: 'var(--fg-c62828)', fontSize: 12 }}>{error}</div>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#fff', background: 'var(--bg-3949ab)', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
          {hasChanges ? (
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Có thay đổi chưa lưu</span>
          ) : savedAt && (
            <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--fg-2e7d32)', background: 'var(--bg-e8f5e9)' }}>
              <CheckCircle2 size={15} aria-hidden />
              Đã lưu lúc {savedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

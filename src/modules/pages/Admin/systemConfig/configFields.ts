/** Các ô chữ của nhóm "Công ty" / "Xưởng & tem QR" và danh sách tab của màn Cấu hình hệ thống. */
import type { SystemConfig } from '../../../../types/admin'

/** Màn chia thành các nhóm (tab). Nút "Lưu thay đổi" vẫn lưu MỌI nhóm cùng lúc; ô sai nằm ở tab khác thì màn tự chuyển
 *  sang tab đó và tab có lỗi được đánh dấu. */
export type TabId = 'cong-ty' | 'xuong' | 'may-cat' | 'ke-hoach'

/** Card này là form nhập chữ - chỉ nhận các field chữ của SystemConfig, không nhận field boolean
 *  (vd solverAllowCustomLength, thuộc nghiệp vụ cắt sắt chứ không phải thông tin công ty). */
export type TextField = {
  [K in keyof SystemConfig]-?: SystemConfig[K] extends string | undefined ? (string extends SystemConfig[K] ? K : never) : never
}[keyof SystemConfig]

export type CompanyFieldName = TextField | 'floorPublicUrl'

export interface CompanyField {
  name: CompanyFieldName
  label: string
  required?: boolean
  help?: string
  placeholder?: string
}

export const FIELDS: CompanyField[] = [
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
    help: 'Mã QR dán ở máy xưởng là link tới trang báo sản lượng của công nhân - địa chỉ này là phần đầu của link. '
      + 'Điền địa chỉ thật mà điện thoại ở xưởng mở được; '
      + 'để trống = dùng địa chỉ đang mở khi QLSX in tem. Mỗi hệ thống (thử/thật) tự đặt riêng - máy thử để trống. '
      + 'ĐÃ DÁN TEM rồi thì đừng đổi: tem cũ chỉ còn quét được nếu địa chỉ cũ vẫn hoạt động.',
  },
]

export const fieldTab = (name: CompanyFieldName): TabId => (name === 'floorPublicUrl' ? 'xuong' : 'cong-ty')

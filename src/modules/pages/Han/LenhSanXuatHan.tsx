'use client'

/**
 * Lệnh sản xuất — Công đoạn HÀN (2 tầng: PO → Mảnh).
 * Đã nối BE thật (M3, đợt 2): TwoTierScreen tự fetch PO/Piece thật qua production-batches-api.ts
 * khi có `stage`.
 *
 * Từ đợt QR: màn này luôn CHỈ XEM — số mảnh do công nhân báo bằng quét mã QR tại máy, KCS tự chấm
 * (QLSX chỉ hủy lần báo sai ở "Sản lượng xưởng"). Prop `readOnly` giữ lại để không vỡ chỗ gọi.
 */

import { TwoTierScreen, HAN_CFG } from '../../../components/sanxuat/core'
import LegacyReportNotice from '../../../components/sanxuat/LegacyReportNotice'

const CFG = HAN_CFG

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function LenhSanXuatHan(_props: { readOnly?: boolean }) {
  return (
    <div>
      <LegacyReportNotice>
        Báo sản lượng Hàn / Sơn làm bằng quét mã QR tại máy. KCS tự chấm; QLSX hủy lần báo sai ở &quot;Sản lượng xưởng&quot;.
      </LegacyReportNotice>
      <TwoTierScreen cfg={CFG} readOnly stage="HAN" />
    </div>
  )
}

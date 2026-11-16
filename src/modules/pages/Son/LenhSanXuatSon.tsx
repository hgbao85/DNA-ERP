'use client'

/**
 * Lệnh sản xuất — Công đoạn SƠN (2 tầng: PO → Mảnh).
 * Đã nối BE thật (M3, đợt 2): TwoTierScreen tự fetch PO/Piece thật qua production-batches-api.ts
 * khi có `stage` — không còn seed cứng.
 *
 * Từ đợt QR: màn này luôn CHỈ XEM — số mảnh do công nhân báo bằng quét mã QR tại máy, QLSX kiểm
 * rồi gửi KCS ở "Sản lượng xưởng". Prop `readOnly` giữ lại để không vỡ chỗ gọi.
 */

import { TwoTierScreen, SON_CFG } from '../../../components/sanxuat/core'
import LegacyReportNotice from '../../../components/sanxuat/LegacyReportNotice'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function LenhSanXuatSon(_props: { readOnly?: boolean }) {
  return (
    <div>
      <LegacyReportNotice>
        Báo số mảnh làm bằng quét mã QR tại máy. QLSX kiểm rồi gửi KCS ở &quot;Sản lượng xưởng&quot;.
      </LegacyReportNotice>
      <TwoTierScreen cfg={SON_CFG} readOnly stage="SON" />
    </div>
  )
}

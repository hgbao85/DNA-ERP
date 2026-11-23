'use client'

/**
 * "Sản lượng xưởng" - màn chung của QLSX cho QR tại máy. Công nhân Phôi/Hàn/Sơn quét mã tại máy và tự báo số, KCS tự chấm.
 * 23/11/2026 bỏ hàng đợi xưởng: QLSX không xếp lệnh cho tổ nữa (Hàn / Sơn tự chọn lệnh trên màn quét), sản lượng theo lệnh
 * xem ở "Xem các tổ" (Hướng dẫn cắt, Khung hàn, Mảnh chờ đan). Màn còn: (1) chia máy cắt, (2) báo cáo số đạt / lỗi KCS đã
 * chốt theo ngày / tháng / năm, (3) máy + tem QR, (4) tài khoản công nhân.
 */

import { useState } from 'react'
import { useUrlState } from '../../../hooks/useUrlState'
import { tabBtn } from '../../../styles/buttons'
import QlsxCutAllocation from './QlsxCutAllocation'
import QlsxSetup from './QlsxSetup'
import QlsxStats from './QlsxStats'
import QlsxCutMachineStats from './QlsxCutMachineStats'

type Tab = 'cut' | 'stats' | 'machines' | 'workers'

export const FLOOR_TABS: { id: Tab; label: string }[] = [
  { id: 'cut', label: 'Chia máy cắt' },
  { id: 'stats', label: 'Báo cáo' },
  { id: 'machines', label: 'Máy & tem QR' },
  { id: 'workers', label: 'Công nhân' },
]

/** Câu mô tả đầu màn (không còn "hủy lần báo sai" / "xếp lệnh"). */
export const FLOOR_PAGE_NOTE =
  'Công nhân quét mã tại máy và tự báo số, KCS tự chấm. Bạn chia sắt cho máy cắt, xem báo cáo, quản lý máy và công nhân; sản lượng theo lệnh xem ở Xem các tổ.'
/** Phần chữ của câu mô tả trước chữ "Xem các tổ" (chữ này là liên kết mở trang xem-cac-to). */
export const FLOOR_PAGE_NOTE_HEAD = FLOOR_PAGE_NOTE.slice(0, FLOOR_PAGE_NOTE.indexOf('Xem các tổ'))

export default function QlsxFloorPage() {
  const [tab, setTab] = useState<Tab>('cut')
  const [, setUrlTab] = useUrlState('p')
  return (
    <div style={{ padding: 'clamp(12px, 3vw, 28px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sản lượng xưởng</h1>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          {FLOOR_PAGE_NOTE_HEAD}
          <button type="button" onClick={() => setUrlTab('xem-cac-to')}
            style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--blue-text)', textDecoration: 'underline', cursor: 'pointer' }}>Xem các tổ</button>.
        </div>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {FLOOR_TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)} style={tabBtn(tab === t.id, 'var(--blue)')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'cut' && <QlsxCutAllocation />}
      {tab === 'stats' && (
        <>
          <QlsxStats />
          <QlsxCutMachineStats />
        </>
      )}
      {tab === 'machines' && <QlsxSetup section="machines" />}
      {tab === 'workers' && <QlsxSetup section="workers" />}
    </div>
  )
}

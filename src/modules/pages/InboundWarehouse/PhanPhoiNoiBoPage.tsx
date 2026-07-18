'use client'

/**
 * Phân phối nội bộ (kho Phôi–Sơn–Hàn) — kho cấp vật tư cho từng tổ. 3 subtab:
 *   1. Xuất sắt trong phôi  — cấp cây sắt cho Phôi (màn cũ XuatSatPage, nhúng).
 *   2. Xuất vật tư hàn      — vật tư tiêu hao cho Hàn (khí CO2, dây hàn, đá cắt…).
 *   3. Xuất vật tư sơn      — vật tư tiêu hao cho Sơn (bột sơn, dung môi, băng keo…).
 *
 * Sắt = WIP có luồng cắt/đồng bộ riêng; vật tư hàn/sơn = tiêu hao (đơn vị bình/kg/lít…),
 * dùng chung component XuatVatTuTieuHaoPage. Data hàn/sơn hiện là MOCK để dựng khung.
 */

import { useState } from 'react'
import { Share2, Scissors, Flame, SprayCan } from 'lucide-react'
import XuatSatPage from './XuatSatPage'
import XuatVatTuTieuHaoPage from './XuatVatTuTieuHaoPage'

const ACCENT = '#4527A0'
const ACCENT_BG = '#EDE7F6'

type Sub = 'sat' | 'han' | 'son'

const SUBS: { id: Sub; label: string; icon: React.ReactNode }[] = [
  { id: 'sat', label: 'Xuất sắt trong phôi', icon: <Scissors size={15} /> },
  { id: 'han', label: 'Xuất vật tư hàn',     icon: <Flame size={15} /> },
  { id: 'son', label: 'Xuất vật tư sơn',     icon: <SprayCan size={15} /> },
]

export default function PhanPhoiNoiBoPage() {
  const [sub, setSub] = useState<Sub>('sat')

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Share2 size={20} /> Phân phối nội bộ
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Kho cấp vật tư cho các tổ sản xuất: <b>sắt</b> cho Phôi, <b>vật tư hàn</b> cho Hàn, <b>vật tư sơn</b> cho Sơn.
      </div>

      {/* Subtab */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {SUBS.map(s => {
          const active = sub === s.id
          return (
            <button key={s.id} onClick={() => setSub(s.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                border: '1px solid', borderColor: active ? ACCENT : 'var(--border)', borderRadius: 8, cursor: 'pointer',
                background: active ? ACCENT_BG : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
              }}>
              {s.icon}{s.label}
            </button>
          )
        })}
      </div>

      {sub === 'sat' && <XuatSatPage embedded />}
      {sub === 'han' && <XuatVatTuTieuHaoPage stage="HAN"
        desc="Vật tư tiêu hao cấp cho Tổ Hàn theo lệnh sản xuất (khí CO₂, dây hàn, đá cắt…). Bấm Xuất → tổ Hàn xác nhận nhận." />}
      {sub === 'son' && <XuatVatTuTieuHaoPage stage="SON"
        desc="Vật tư tiêu hao cấp cho Tổ Sơn theo lệnh sản xuất (bột sơn, dung môi, băng keo che…). Bấm Xuất → tổ Sơn xác nhận nhận." />}
    </div>
  )
}

'use client'

/**
 * Phân phối nội bộ (kho Phôi–Sơn–Hàn) — kho cấp vật tư cho từng tổ. 4 subtab:
 *   1. Xuất sắt trong phôi  — cấp cây sắt cho Phôi (màn cũ XuatSatPage, nhúng).
 *   2. Xuất vật tư TP       — Sắt La (→ Pat) / Thanh nhôm (→ chân nhôm) cho Phôi (thêm 2026-09-04).
 *   3. Xuất vật tư hàn      — vật tư tiêu hao cho Hàn (khí CO2, dây hàn, đá cắt…).
 *   4. Xuất vật tư sơn      — vật tư tiêu hao cho Sơn (bột sơn, dung môi, băng keo…).
 *   + Giao nhận giữa tổ (24/11/2026, chỉ khi BE bật STAGE_HANDOVER_ENABLED): kho Phôi "Giao đoạn cho Hàn", kho Hàn Phú An "Giao
 *     khung cho Sơn" - xem GiaoNhanToPage.tsx.
 *   + Pallet Sơn (24/11/2026, chỉ khi BE bật PALLET_SON_ENABLED): kho Sơn có tab "Pallet" (PalletSonPage.tsx) và khối "Xuất đan theo
 *     pallet" đầu tab Xuất đan (PalletWeavingPanel.tsx).
 *
 * Sắt = WIP có luồng cắt/đồng bộ riêng; vật tư TP = xuất tự do theo PieceMaterialYield (không qua
 * duyệt phương án như Sắt, xem XuatVatTuThanhPhamPage.tsx); vật tư hàn/sơn = tiêu hao (đơn vị
 * bình/kg/lít…), dùng chung component XuatVatTuTieuHaoPage — nối BE thật (module material-issues)
 * từ 2026-08-12, xem material-issues-api.ts.
 */

import { useState } from 'react'
import { Share2, Scissors, Wrench, Flame, SprayCan, FileText, Waypoints, ArrowRightLeft, Layers } from 'lucide-react'
import XuatSatPage from './XuatSatPage'
import XuatVatTuThanhPhamPage from './XuatVatTuThanhPhamPage'
import XuatVatTuTieuHaoPage from './XuatVatTuTieuHaoPage'
import PhieuXuatPage from './PhieuXuatPage'
import KhoXuatDanPage from './KhoXuatDanPage'
import GiaoNhanToPage from './GiaoNhanToPage'
import PalletSonPage from './PalletSonPage'
import PalletWeavingPanel from './PalletWeavingPanel'
import { getPalletLoadPis, getPallets } from '../../../services/pallets-api'
import { hanWarehouseHasPaint } from './handoverModel'
import { useFetch } from '../../../hooks/useFetch'
import { getHandoverPlanList, type HandoverKind } from '../../../services/stage-handover-api'
import { IssueSlipCartProvider, useIssueSlipCart } from './IssueSlipCart'
import { pageTitle, pageSubtitle } from '../../../styles/typography'
import { useAuth } from '../../../context/AuthContext'
import { warehouseKindOf, type WarehouseKind } from '../../../utils/warehouseKinds'

const ACCENT = 'var(--fg-4527a0)'
const ACCENT_BG = 'var(--bg-ede7f6)'

type Sub = 'sat' | 'giao-doan' | 'vat-tu-tp' | 'han' | 'giao-khung' | 'son' | 'pallet' | 'dan' | 'phieu'

const SUBS: { id: Sub; label: string; icon: React.ReactNode }[] = [
  { id: 'sat', label: 'Xuất sắt trong phôi', icon: <Scissors size={15} /> },
  // Giao nhận giữa tổ (24/11/2026): chỉ hiện khi BE bật công tắc (plan.enabled).
  { id: 'giao-doan', label: 'Giao đoạn cho Hàn', icon: <ArrowRightLeft size={15} /> },
  { id: 'vat-tu-tp', label: 'Xuất vật tư TP', icon: <Wrench size={15} /> },
  { id: 'han', label: 'Xuất vật tư hàn',     icon: <Flame size={15} /> },
  { id: 'giao-khung', label: 'Giao khung cho Sơn', icon: <ArrowRightLeft size={15} /> },
  { id: 'son', label: 'Xuất vật tư sơn',     icon: <SprayCan size={15} /> },
  // Pallet Sơn (24/11/2026): chỉ hiện khi BE bật công tắc (list.enabled).
  { id: 'pallet', label: 'Pallet', icon: <Layers size={15} /> },
  // Nghiệp vụ 09/11/2026: mảnh xong (Sơn; mảnh chỉ hàn ở kho Hàn) xuất đan THẲNG từ kho giữ mảnh bằng phiếu XK.
  { id: 'dan', label: 'Xuất đan',            icon: <Waypoints size={15} /> },
  // Đợt 6 (YC4): mọi lần xuất sắt / vật tư hàn, sơn đi qua phiếu xuất XK có số, ký, tải ảnh.
  { id: 'phieu', label: 'Phiếu xuất',       icon: <FileText size={15} /> },
]

/** Đợt 7 (9 kho): mỗi thủ kho chỉ thấy phần xuất của kho mình - kho Phôi: sắt + vật tư TP, kho Hàn: vật tư hàn, kho Sơn: vật tư
 *  sơn. Tổng kho / kho chưa phân loại thấy hết. */
const SUBS_BY_KIND: Partial<Record<WarehouseKind, Sub[]>> = {
  PHOI: ['sat', 'giao-doan', 'vat-tu-tp', 'phieu'],
  HAN: ['han', 'giao-khung', 'dan', 'phieu'],
  SON: ['son', 'pallet', 'dan', 'phieu'],
}

export default function PhanPhoiNoiBoPage() {
  return (
    <IssueSlipCartProvider>
      <PhanPhoiNoiBo />
    </IssueSlipCartProvider>
  )
}

function PhanPhoiNoiBo() {
  const { user } = useAuth()
  const scope = user?.warehouseScope ?? null
  const scopeKind = warehouseKindOf(scope)
  // Giao nhận giữa tổ: chỉ thủ kho gắn kho đang làm (BE lấy kho theo tài khoản) - kho Phôi giao đoạn, kho Hàn của xưởng có kho Sơn
  // giao mảnh. Hỏi BE 1 lần để biết công tắc có bật không; tắt / lỗi thì 2 tab mới không hiện, màn như cũ.
  const handoverKind: HandoverKind | null = scopeKind === 'PHOI' ? 'SEGMENT' : hanWarehouseHasPaint(scope) ? 'FRAME' : null
  const { data: handoverList, refetch: refetchHandover } = useFetch(
    () => (handoverKind ? getHandoverPlanList(handoverKind).catch(() => null) : Promise.resolve(null)),
    [handoverKind],
  )
  const handoverOn = !!handoverList?.enabled
  // Pallet Sơn: chỉ thủ kho gắn kho Sơn. Hỏi BE 1 lần (danh sách pallet có `enabled`); tắt / lỗi thì không hiện gì mới.
  const isSon = scopeKind === 'SON'
  const { data: palletList, refetch: refetchPallets } = useFetch(
    () => (isSon ? getPallets().catch(() => null) : Promise.resolve(null)),
    [isSon],
  )
  const palletOn = !!palletList?.enabled
  const { data: palletLoadPis } = useFetch(
    () => (palletOn ? getPalletLoadPis().catch(() => null) : Promise.resolve(null)),
    [palletOn],
  )
  const hidden = new Set<Sub>(['giao-doan', 'giao-khung', 'pallet'])
  if (handoverOn) hidden.delete(handoverKind === 'SEGMENT' ? 'giao-doan' : 'giao-khung')
  if (palletOn) hidden.delete('pallet')
  const allowed = (SUBS_BY_KIND[scopeKind as WarehouseKind] ?? SUBS.map(s => s.id)).filter(id => !hidden.has(id))
  const subs = SUBS.filter(s => allowed.includes(s.id))
  const [sub, setSub] = useState<Sub>(allowed[0])
  const cart = useIssueSlipCart()

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <h2 style={{ ...pageTitle, marginBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Share2 size={20} /> Phân phối nội bộ
      </h2>
      <div style={{ ...pageSubtitle, marginBottom: 'var(--space-5)' }}>
        Kho cấp vật tư cho các tổ sản xuất: <b>sắt</b> cho Phôi, <b>vật tư hàn</b> cho Hàn, <b>vật tư sơn</b> cho Sơn.
      </div>

      {/* Subtab */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {subs.map(s => {
          const active = sub === s.id
          return (
            <button key={s.id} onClick={() => setSub(s.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
                border: '1px solid', borderColor: active ? ACCENT : 'var(--border)', borderRadius: 8, cursor: 'pointer',
                background: active ? ACCENT_BG : 'var(--surface)', color: active ? ACCENT : 'var(--text2)',
              }}>
              {s.icon}{s.label}
              {s.id === 'phieu' && cart.lines.length > 0 && (
                <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 20, background: 'var(--bg-c62828)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{cart.lines.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {sub === 'sat' && <XuatSatPage embedded />}
      {sub === 'giao-doan' && handoverOn && handoverList && <GiaoNhanToPage kind="SEGMENT" list={handoverList} refetchList={refetchHandover} />}
      {sub === 'giao-khung' && handoverOn && handoverList && <GiaoNhanToPage kind="FRAME" list={handoverList} refetchList={refetchHandover} />}
      {sub === 'vat-tu-tp' && <XuatVatTuThanhPhamPage />}
      {sub === 'han' && <XuatVatTuTieuHaoPage stage="HAN"
        desc="Vật tư tiêu hao cấp cho Tổ Hàn theo lệnh sản xuất (khí CO₂, dây hàn, đá cắt…). Bấm “Thêm vào phiếu” → tạo phiếu xuất ở tab Phiếu xuất → ký, tải ảnh, xác nhận xuất là xong (tổ Hàn không phải xác nhận nhận)." />}
      {sub === 'son' && <XuatVatTuTieuHaoPage stage="SON"
        desc="Vật tư tiêu hao cấp cho Tổ Sơn theo lệnh sản xuất (bột sơn, dung môi, băng keo che…). Bấm “Thêm vào phiếu” → tạo phiếu xuất ở tab Phiếu xuất → ký, tải ảnh, xác nhận xuất là xong (tổ Sơn không phải xác nhận nhận)." />}
      {sub === 'pallet' && palletOn && palletList && <PalletSonPage list={palletList} refetchList={refetchPallets} loadPis={palletLoadPis} />}
      {sub === 'dan' && palletOn && <PalletWeavingPanel />}
      {sub === 'dan' && <KhoXuatDanPage />}
      {sub === 'phieu' && <PhieuXuatPage />}
    </div>
  )
}

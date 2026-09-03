'use client'

/**
 * Kho phôi (Phôi) — mục sidebar dưới "Lịch sử nhận sắt", READ-ONLY.
 *
 * Tồn ĐOẠN sắt thật (StockQuant.segmentSpecId, kho vật lý "phoi-son-han") - thủ kho tự đếm và tự
 * nhập qua "Sửa nhanh tồn kho" (POST /stock-ledger/adjust, MfgWarehousesPage.tsx), KHÔNG tự động
 * tính từ CuttingProposalPattern/tỷ lệ KCS đạt như bản mock cũ (quyết định nghiệp vụ 2026-08-14,
 * xem docs/quy-doi-doan-phoi.md). Hàn báo sản lượng sẽ tự động trừ tồn này
 * (ProductionBatchesService, refType SEGMENT_CONSUME).
 *
 * 2 tab dựa theo quy ước cutLengthMm=0 = "đầu mẩu" (SegmentSpec riêng KHSX khai cho mỗi material
 * sắt, không gắn 1 chiều dài BOM cụ thể) - xem docs/quy-doi-doan-phoi.md mục "Bước 1"/"Bước 4".
 * segmentSpecLabel BE trả dạng "{materialCode} @ {cutLengthMm}mm" (StockQuantService), parse lại
 * chiều dài từ đó thay vì gọi thêm segment-specs API.
 */
import { useMemo, useState } from 'react'
import { Warehouse, Check, Scissors } from 'lucide-react'
import { useAuth } from '../../../context/AuthContext'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import type { BeStockQuant } from '../../../services/stock-api'
import { isFamilyScope } from '../../../utils/warehouseFamily'

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...th, textAlign: 'right' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13 }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }

type Tab = 'duyet' | 'thua'

/// Kho vật lý MẶC ĐỊNH chứa tồn đoạn thật - cùng STEEL_WAREHOUSE_CODE ở
/// production-batches.service.ts (BE). GET /stock-quant trả về mọi kho (kể cả kho ảo "PRODUCTION"
/// dùng làm điểm đến khi Hàn tiêu hao) nên phải lọc đúng warehouseCode ở đây, không hiện nhầm số
/// đã tiêu hao (tăng dần, không phải tồn thật).
/// 2026-09-03: chỉ còn là fallback - trang giờ ưu tiên lọc theo đúng kho phoi-son-han cụ thể mà
/// người xem (PHOI/HAN/SON/KCS) đang được gán (user.warehouseScope), vì kho này giờ có thể có
/// nhiều instance song song (phoi-son-han-2...), không còn đúng 1 kho gốc duy nhất.
const STEEL_WAREHOUSE_CODE = 'phoi-son-han'

interface DoanRow {
  key: string
  materialCode: string
  cutLengthMm: number
  soDoan: number
}

/** Parse "{materialCode} @ {cutLengthMm}mm" (StockQuantService.toResponseDto ở BE). */
function parseSegmentLabel(label: string): { materialCode: string; cutLengthMm: number } | null {
  const m = /^(.+) @ (\d+)mm$/.exec(label)
  if (!m) return null
  return { materialCode: m[1], cutLengthMm: Number(m[2]) }
}

function toRows(quants: BeStockQuant[], warehouseCode: string): { duyet: DoanRow[]; thua: DoanRow[] } {
  const duyet: DoanRow[] = []
  const thua: DoanRow[] = []
  for (const q of quants) {
    if (q.warehouseCode !== warehouseCode || !q.segmentSpecId || !q.segmentSpecLabel) continue
    const parsed = parseSegmentLabel(q.segmentSpecLabel)
    if (!parsed || q.qty <= 0) continue
    const row: DoanRow = { key: q.segmentSpecId, materialCode: parsed.materialCode, cutLengthMm: parsed.cutLengthMm, soDoan: q.qty }
    if (parsed.cutLengthMm === 0) thua.push(row)
    else duyet.push(row)
  }
  const byLen = (a: DoanRow, b: DoanRow) => a.materialCode.localeCompare(b.materialCode) || b.cutLengthMm - a.cutLengthMm
  return { duyet: duyet.sort(byLen), thua: thua.sort(byLen) }
}

const tenVatLieu = (r: DoanRow) => `${r.materialCode} — đoạn ${r.cutLengthMm > 0 ? `${r.cutLengthMm}mm` : 'thừa (đầu mẩu)'}`

export default function KhoPhoiPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('duyet')

  // Kho phoi-son-han CỤ THỂ mà người xem (PHOI/HAN/SON/KCS) đang được gán - fallback về kho gốc
  // nếu không có scope hợp lệ (BOSS/ADMIN xem, hoặc dữ liệu cũ chưa gán warehouseScope).
  const myWarehouseCode = isFamilyScope(user?.warehouseScope, 'phoi-son-han') ? user!.warehouseScope! : STEEL_WAREHOUSE_CODE

  const { data: quants } = useFetch<BeStockQuant[]>(() => api.getStockQuants(), [])

  const { duyet, thua } = useMemo(() => toRows(quants ?? [], myWarehouseCode), [quants, myWarehouseCode])

  const tongDuyet = useMemo(() => duyet.reduce((s, i) => s + i.soDoan, 0), [duyet])
  const tongThua = useMemo(() => thua.reduce((s, i) => s + i.soDoan, 0), [thua])

  const rows = tab === 'duyet' ? duyet : thua

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Warehouse size={20} /> Kho phôi
      </h2>
      <div style={{ color: 'var(--text3)', fontSize: 13, margin: '4px 0 16px' }}>
        Đoạn sắt tồn thật tại kho <b>{myWarehouseCode}</b> (thủ kho tự đếm & nhập) — <b>Cần</b> là đoạn khớp định mức chờ chuyển Hàn, <b>Thừa</b> là đầu mẩu chờ xử lý.
      </div>

      {/* Tab switch */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <TabBtn active={tab === 'duyet'} onClick={() => setTab('duyet')} icon={<Check size={15} />}
          label="Đoạn chuẩn (chờ chuyển Hàn)" badge={tongDuyet} />
        <TabBtn active={tab === 'thua'} onClick={() => setTab('thua')} icon={<Scissors size={15} />}
          label="Đoạn thừa (chờ xử lý)" badge={tongThua} />
      </div>

      <KhoTable rows={rows} thua={tab === 'thua'} qtyColor={tab === 'duyet' ? '#e65100' : '#d97706'} />
    </div>
  )
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge: number }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', fontSize: 13, fontWeight: 600,
        border: '1px solid', borderColor: active ? '#e65100' : 'var(--border)', borderRadius: 8, cursor: 'pointer',
        background: active ? '#fff3e0' : 'var(--surface)', color: active ? '#e65100' : 'var(--text2)',
      }}>
      {icon}{label}
      <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: active ? '#e65100' : 'var(--surface2)', color: active ? '#fff' : 'var(--text3)' }}>{badge.toLocaleString('vi-VN')}</span>
    </button>
  )
}

// ── Bảng 3 cột: Tên vật liệu · Số lượng · ĐVT ────────────────
function KhoTable({ rows, thua, qtyColor }: { rows: DoanRow[]; thua: boolean; qtyColor: string }) {
  return (
    <div style={card}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 480 }}>
        <colgroup><col /><col style={{ width: 140 }} /><col style={{ width: 120 }} /></colgroup>
        <thead>
          <tr style={{ background: 'var(--surface2)' }}>
            <th style={th}>Tên vật liệu</th>
            <th style={thR}>Số lượng</th>
            <th style={th}>ĐVT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ ...td, fontWeight: 600 }}>{tenVatLieu(r)}</td>
              <td style={{ ...tdR, fontWeight: 700, color: qtyColor }}>{r.soDoan.toLocaleString('vi-VN')}</td>
              <td style={{ ...td, color: 'var(--text3)' }}>cái</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--text3)' }}>
              {thua ? 'Chưa có đoạn thừa' : 'Chưa có đoạn nào chờ chuyển Hàn'}
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

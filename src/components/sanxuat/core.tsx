'use client'

/**
 * CORE dùng chung cho các màn Lệnh sản xuất (Phôi / Hàn / Sơn).
 * - types + helper đồng bộ (logic thuần)
 * - 3 view dựng trên khung generic `LenhSanXuatBoard`: PO list · Mảnh list · Vật tư detail
 * - 2 orchestrator: PhoiScreen (3 tầng, có mảnh) · TwoTierScreen (2 tầng, Hàn/Sơn)
 *
 * Mỗi màn (Phoi/Han/Son) chỉ cần cấp `cfg` + `seed` rồi gọi orchestrator tương ứng.
 * ĐANG DÙNG DATA MOCK (state nội bộ) — chưa nối backend.
 */

import { useState, useMemo, useEffect } from 'react'
import { ChevronRight, ChevronLeft, ChevronDown, Check, Clock, AlertTriangle, Plus, Send, CalendarClock, Layers, CheckCircle2, Lock, Scissors, Wrench, Flame, SprayCan, type LucideIcon } from 'lucide-react'
import LenhSanXuatBoard, { type BoardColumn } from './LenhSanXuatBoard'
import { useFetch } from '../../hooks/useFetch'
import * as api from '../../services/api'
import type { SatIssueView } from '../../services/api'
import type {
  BeProductionOrderSummary, ProductionBatchStage as SanLuongStage,
  BeProductionBatch, BeProductionBatchQcReview,
} from '../../services/production-batches-api'
import { errMsg } from '../../utils/errors'

const ACCENT = '#e65100'
const REMIND_MINUTES = 60

// ── Types ──────────────────────────────────────────────────────────
// Thanh sắt cấu thành 1 chi tiết Hàn (vd khung tựa gồm những loại sắt nào) — để xổ ra xem.
// 1 đoạn = quy cách (tiết diện) + chiều dài cắt (len, mm). thucCo có thể sync từ Phôi.
export interface ProcPart { loaiSat: string; quyCach: string; len: number; perChiTiet: number; thucCo?: number }
export interface ProcLine {
  id: number
  itemName: string
  spec: string
  needQty: number
  doneQty: number
  perManh?: number      // SL vật tư cần cho 1 mảnh/sản phẩm (định mức)
  thucCoQty?: number     // SL thực tế đang có sẵn để làm ngay (tồn đầu vào) — Hàn/Sơn
  parts?: ProcPart[]     // Hàn/Sơn: các thanh sắt cấu thành 1 chi tiết (bấm xổ để xem)
  lastInputAt: string | null
  /** Hàn/Sơn nối BE thật (đợt 2): Piece.id thật (BE) dùng để báo sản lượng — xem
   *  production-batches-api.ts. Không set cho Phôi (vẫn mock). */
  realPieceId?: string
  /** Vật tư thành phẩm (stage=PHOI, vd chân nhôm) - tồn nguyên liệu thô (thanh nhôm) hiện có tại
   *  kho, từ BeProductionBatchPlanItem.rawMaterialOnHand. null/undefined ngoài stage=PHOI. */
  rawMaterialOnHand?: number | null
}
export interface ProcManh {
  id: number
  tenManh: string
  perSku?: number       // SL mảnh cần cho 1 SKU
  lines: ProcLine[]
}
export interface ProcRow {
  id: number
  poNumber: string
  sku: string
  productName: string
  soLuong: number
  deadline: string
  arrangedAt: string | null
  manhs?: ProcManh[]    // Phôi
  lines?: ProcLine[]    // Hàn/Sơn
  /** Hàn/Sơn nối BE thật (đợt 2): ProductionOrder.id thật (BE) dùng để báo sản lượng — xem
   *  production-batches-api.ts. Không set cho Phôi (vẫn mock). */
  realOrderId?: string
  /** Hàn/Sơn gom theo PI (2026-08-31, đồng nhất với LenhSanXuatPhoi.tsx) - xem PiListBoard. Không
   *  set cho Phôi (màn Phôi thật dùng cấu trúc riêng, không đi qua PoListBoard/TwoTierScreen). */
  productionInvoiceId?: string
  piCode?: string
}
export interface StageCfg {
  label: string
  done: string
  verb: string
  itemLabel: string
  unit: string
  Icon: LucideIcon
}

// Cấu hình dùng chung cho công đoạn Phôi/Hàn/Sơn — dùng lại ở màn Lệnh sản xuất riêng
// (Phoi/Han/Son@demo.com) lẫn ở màn chi tiết Khung cơ khí bên KHSX (xem ThongKePagePlan.tsx).
export const PHOI_CFG: StageCfg = { label: 'Phôi', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Loại sắt', unit: 'cây', Icon: Wrench }
export const HAN_CFG: StageCfg = { label: 'Hàn', done: 'Đã hàn', verb: 'hàn', itemLabel: 'Mảnh', unit: 'cái', Icon: Flame }
export const SON_CFG: StageCfg = { label: 'Sơn', done: 'Đã sơn', verb: 'sơn', itemLabel: 'Loại sơn', unit: 'lít', Icon: SprayCan }
// "Vật tư thành phẩm" (needsHan=false, vd chân nhôm - cắt xong là hết, không hàn) - Phôi tự báo
// theo MẢNH (khác PHOI_CFG ở trên, dùng cho theo dõi theo LOẠI SẮT/cây ở ThongKePagePlan.tsx).
// stage="PHOI" cùng ProductionBatch với Hàn/Sơn (thêm 21/08/2026), chỉ khác điều kiện needsHan.
export const VAT_TU_TP_CFG: StageCfg = { label: 'Vật tư TP', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Mảnh', unit: 'cái', Icon: Wrench }

// ── Helpers cho mock data (dùng ở các file seed) ───────────────────
export const ISO = (daysFromNow: number, h = 17, m = 0) => {
  const d = new Date(); d.setDate(d.getDate() + daysFromNow); d.setHours(h, m, 0, 0); return d.toISOString()
}
export const minsAgo = (mins: number) => new Date(Date.now() - mins * 60000).toISOString()

// ── Helpers ────────────────────────────────────────────────────────
export const fmt = (n: number) => n.toLocaleString('vi-VN')
// '—' cho ProcRow.deadline chưa có thật (Hàn/Sơn nối BE thật, đợt 2 — ProductionOrder không có
// cột deadline, xem fetchHanSonRows()) — tránh hiện "Invalid Date" ra UI.
export const dateVN = (iso: string) => {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}
export const timeVN = (iso: string) => new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
const minutesSince = (iso: string | null) => iso == null ? Infinity : Math.floor((Date.now() - new Date(iso).getTime()) / 60000)

const lineStats = (lines: ProcLine[]) => {
  const need = lines.reduce((s, x) => s + x.needQty, 0)
  const done = lines.reduce((s, x) => s + x.doneQty, 0)
  const pct = need > 0 ? Math.round((done / need) * 100) : 0
  return { need, done, pct }
}

export const perManh = (l: ProcLine) => l.perManh && l.perManh > 0 ? l.perManh : 1
export const perSku = (m: ProcManh) => m.perSku && m.perSku > 0 ? m.perSku : 1
export const manhFromLine = (l: ProcLine) => Math.floor(l.doneQty / perManh(l))
export const dongBoOf = (lines: ProcLine[]) => lines.length ? Math.min(...lines.map(manhFromLine)) : 0
export const lechOf = (lines: ProcLine[]) => {
  if (lines.length < 2) return false
  const c = lines.map(manhFromLine)
  return Math.max(...c) !== Math.min(...c)
}
const dongBoManh = (m: ProcManh) => dongBoOf(m.lines)
const gheOfManh = (m: ProcManh) => Math.floor(dongBoManh(m) / perSku(m))

const allLines = (r: ProcRow): ProcLine[] => r.manhs ? r.manhs.flatMap(m => m.lines) : (r.lines ?? [])
const skuUnits = (r: ProcRow): number[] => r.manhs ? r.manhs.map(gheOfManh) : (r.lines ?? []).map(manhFromLine)
export const skuDongBo = (r: ProcRow) => { const u = skuUnits(r); return u.length ? Math.min(...u) : 0 }
export const skuLech = (r: ProcRow) => { const u = skuUnits(r); return u.length >= 2 && Math.max(...u) !== Math.min(...u) }
const poSummary = (r: ProcRow) => {
  const daLam = skuDongBo(r)
  const pct = r.soLuong > 0 ? Math.round((daLam / r.soLuong) * 100) : 0
  // Math.max(0, ...) (2026-09-11, QA audit C7) - trước đây có thể ra số âm nếu daLam vượt soLuong
  // (báo dư/điều chỉnh), hiện "Còn lại -5" vẫn tô xanh vì điều kiện đổi màu chỉ so `> 0` - không
  // đồng nhất với cột "Còn lại" cấp mảnh (VatTuDetailBoard) đã clamp đúng Math.max(remain, 0).
  return { pct, daLam, conLai: Math.max(0, r.soLuong - daLam) }
}
// Phôi: tiến độ theo tổng CÂY (đã cắt / cần) — không dùng đồng bộ mảnh→bộ.
const poSummaryCay = (r: ProcRow) => {
  const lines = allLines(r)
  const need = lines.reduce((s, l) => s + l.needQty, 0)
  const done = lines.reduce((s, l) => s + l.doneQty, 0)
  const pct = need > 0 ? Math.round((done / need) * 100) : 0
  return { pct, daLam: done, conLai: Math.max(0, need - done) }
}
function Progress({ pct }: { pct: number }) {
  const color = pct >= 100 ? 'var(--green)' : pct >= 50 ? ACCENT : '#b45309'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 7, borderRadius: 5, background: 'var(--surface2)', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, transition: 'width .2s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color, width: 34, textAlign: 'right' }}>{pct}%</span>
    </div>
  )
}

const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)' }
const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
// Mirror `card` bên phoiStyles.ts (LenhSanXuatPhoi.tsx) - core.tsx không import file đó (khác thư
// mục/quy ước riêng), định nghĩa lại tương đương bằng CSS var đã dùng sẵn trong file này.
const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--surface)', overflow: 'hidden' }

// ── Tầng 0 (Hàn/Sơn): Danh sách PI — gom nhiều SKU cùng 1 PI ────────────────────
// Đồng nhất với LenhSanXuatPhoi.tsx (2026-08-31, theo yêu cầu user): Phôi cắt sắt chung cho cả PI
// nên tự nhiên gom theo PI; Hàn/Sơn tuy có tiến độ THẬT theo từng SKU (khác Phôi, xem PoListBoard
// bên dưới vẫn giữ nguyên cho tầng kế tiếp) nhưng cũng gom PI ở tầng ngoài cùng để 3 công đoạn
// nhìn giống nhau. Bấm 1 PI → vào đúng PoListBoard cũ (đã lọc theo PI) → bấm 1 SKU → VatTuDetailBoard
// như trước, không đổi gì ở 2 tầng trong.
interface PiGroup { productionInvoiceId: string; piCode: string; rows: ProcRow[] }

function buildPiGroups(rows: ProcRow[]): PiGroup[] {
  const byPi = new Map<string, ProcRow[]>()
  const order: string[] = []
  for (const r of rows) {
    // Fallback theo r.id (phòng thủ) - không nên xảy ra với dữ liệu thật, mọi ProcRow từ
    // fetchHanSonRows() đều có productionInvoiceId (ProductionOrder luôn thuộc đúng 1 PI).
    const key = r.productionInvoiceId ?? `_id:${r.id}`
    if (!byPi.has(key)) { byPi.set(key, []); order.push(key) }
    byPi.get(key)!.push(r)
  }
  return order.map(key => {
    const groupRows = byPi.get(key)!
    return {
      productionInvoiceId: groupRows[0].productionInvoiceId ?? key,
      piCode: groupRows[0].piCode ?? groupRows[0].poNumber,
      rows: groupRows,
    }
  })
}

// Tổng cây/mảnh CẦN - ĐÃ LÀM cộng dồn mọi dòng vật tư của mọi SKU trong PI - cùng cách Phôi cộng
// dồn "cây" qua nhiều loại sắt (poSummaryCay), mở rộng thêm 1 cấp (nhiều SKU thay vì 1 SKU nhiều
// loại sắt). KHÔNG dùng poSummary (đếm SKU ráp được) ở đây - số ráp được của SKU A và SKU B không
// cộng dồn có ý nghĩa với nhau (khác sản phẩm).
function piGroupStats(rows: ProcRow[]): { need: number; done: number; pct: number } {
  const lines = rows.flatMap(r => r.lines ?? [])
  const need = lines.reduce((s, l) => s + l.needQty, 0)
  const done = lines.reduce((s, l) => s + l.doneQty, 0)
  return { need, done, pct: need > 0 ? Math.round((done / need) * 100) : 0 }
}

interface PiView { g: PiGroup; stats: ReturnType<typeof piGroupStats> }

function PiListBoard({ groups, cfg, onEnter }: { groups: PiGroup[]; cfg: StageCfg; onEnter: (productionInvoiceId: string) => void }) {
  const views: PiView[] = groups.map(g => ({ g, stats: piGroupStats(g.rows) }))
  const cols: BoardColumn<PiView>[] = [
    {
      // CHỈ hiện mã PI (KHÔNG PO) - 2026-09-10, đồng bộ màn KCS (xem KcsStagePage.tsx): Hàn/Sơn làm
      // việc theo PI (lệnh sản xuất nội bộ), PO là khái niệm bên Sales, dễ nhầm với "PO" ở màn Mua
      // hàng/Kho (2 mã khác nhau cùng gọi là "PO").
      key: 'pi', header: 'PI', cell: v => (
        <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{v.g.piCode}</div>
      ),
    },
    { key: 'skuCount', header: 'Số SKU', align: 'right', cell: v => v.g.rows.length },
    { key: 'done', header: `${cfg.done} (${cfg.unit})`, align: 'right', cell: v => <span style={{ fontWeight: 700 }}>{fmt(v.stats.done)}</span> },
    { key: 'remain', header: `Còn lại (${cfg.unit})`, align: 'right', cell: v => <span style={{ color: v.stats.need - v.stats.done > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(Math.max(0, v.stats.need - v.stats.done))}</span> },
    { key: 'progress', header: 'Tiến độ', width: 160, cell: v => <Progress pct={v.stats.pct} /> },
  ]
  const Icon = cfg.Icon
  return (
    <LenhSanXuatBoard<PiView>
      icon={<Icon size={18} />}
      title={`Lệnh sản xuất — Công đoạn ${cfg.label}`}
      subtitle={`Theo dõi tiến độ ${cfg.verb} theo PI · bấm để xem từng SKU trong PI`}
      columns={cols}
      rows={views}
      rowKey={v => v.g.productionInvoiceId}
      clickable={() => true}
      onRowClick={v => onEnter(v.g.productionInvoiceId)}
      rowTitle={() => 'Bấm để xem danh sách SKU trong PI này'}
    />
  )
}

// ── Tầng 1: Danh sách lệnh (PO) ────────────────────────────────────
interface PoView { r: ProcRow; s: ReturnType<typeof poSummary>; unlocked: boolean; canEnter: boolean; arranged: boolean; seqUnlocked: boolean; alert: boolean }

function PoListBoard({ rows, cfg, isPhoi, sequential = true, onEnter, onBack, piCode }: {
  rows: ProcRow[]; cfg: StageCfg; isPhoi: boolean
  /** "Làm tuần tự" (PO sau chỉ mở khi PO trước đủ 100%) — quy ước riêng của demo/mock, KHÔNG có gì
   *  tương ứng ở BE. Hàn/Sơn nối BE thật (đợt 2) tắt hẳn để không chặn oan PO thật theo thứ tự
   *  bất kỳ trả về từ listProductionOrdersForStage(). */
  sequential?: boolean
  onEnter: (poId: number) => void
  /** Có giá trị khi được mở từ PiListBoard (Hàn/Sơn, 2026-08-31) - hiện nút "Quay lại danh sách
   *  PI" + mã PI đang xem. undefined = vẫn là tầng ngoài cùng (không đổi hành vi cũ). */
  onBack?: () => void
  piCode?: string
}) {
  const sumOf = (r: ProcRow) => isPhoi ? poSummaryCay(r) : poSummary(r)
  const views: PoView[] = rows.map((r, i) => {
    const s = sumOf(r)
    const arranged = !!r.arrangedAt
    const seqUnlocked = !sequential || i === 0 || sumOf(rows[i - 1]).pct >= 100
    const unlocked = arranged && seqUnlocked
    // Bấm thẳng vào PO để nhập sản lượng - không còn "Bắt đầu ca" phụ (2026-08-31, QLSX đã kiểm
    // soát toàn chuỗi qua floorStage rồi, cột Ca chỉ là state cục bộ không persist, dễ gây nhầm với
    // 2 nút "Bắt đầu"/"Kết thúc" thật của QLSX ở Bảng thống kê).
    return { r, s, arranged, seqUnlocked, unlocked, canEnter: unlocked, alert: !isPhoi && unlocked && skuLech(r) }
  })

  const cols: BoardColumn<PoView>[] = [
    // Gộp cột "PO" (riêng biệt trước đây) vào chung cột SKU (2026-09-10, theo góp ý người dùng -
    // PI đã là mã lệnh chính hiện ở tiêu đề trang trên cùng, tách hẳn 1 cột gọi là "PO" dễ hiểu
    // nhầm đây lại là mã đang theo dõi chính; mã PO (Sales) giờ chỉ còn là chú thích phụ dưới SKU).
    {
      key: 'sku', header: 'SKU', cell: v => (
        <div>
          <div style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {!v.seqUnlocked
              ? <Lock size={13} style={{ color: 'var(--text3)' }} />
              : v.alert && <AlertTriangle size={13} style={{ color: 'var(--red)' }} />}
            {v.r.sku}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>{v.r.poNumber}</div>
        </div>
      ),
    },
    { key: 'sl', header: 'Số lượng', align: 'right', cell: v => fmt(v.r.soLuong) },
    { key: 'done', header: isPhoi ? `${cfg.done} (${cfg.unit})` : cfg.done, align: 'right', cell: v => <span style={{ fontWeight: 700, color: v.alert ? 'var(--red)' : 'var(--text)' }}>{fmt(v.s.daLam)}</span> },
    { key: 'remain', header: isPhoi ? `Còn lại (${cfg.unit})` : 'Còn lại', align: 'right', cell: v => <span style={{ color: v.s.conLai > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(v.s.conLai)}</span> },
    { key: 'progress', header: 'Tiến độ', width: 160, cell: v => <Progress pct={v.s.pct} /> },
    { key: 'deadline', header: 'Deadline', cell: v => dateVN(v.r.deadline) },
  ]

  const Icon = cfg.Icon
  return (
    <LenhSanXuatBoard<PoView>
      icon={<Icon size={18} />}
      title={onBack ? `PI ${piCode ?? ''}` : `Lệnh sản xuất — Công đoạn ${cfg.label}`}
      subtitle={isPhoi
        ? `Theo dõi tiến độ ${cfg.verb} theo SKU · bấm SKU để xem mảnh & xác nhận cắt theo đợt`
        : `Theo dõi tiến độ ${cfg.verb} theo SKU · nhập sản lượng theo ${cfg.itemLabel.toLowerCase()}`}
      onBack={onBack}
      backLabel="Quay lại danh sách PI"
      columns={cols}
      rows={views}
      rowKey={v => v.r.id}
      rowTone={v => !v.unlocked ? 'muted' : v.alert ? 'alert' : 'default'}
      clickable={v => v.canEnter}
      onRowClick={v => onEnter(v.r.id)}
      rowTitle={v => !v.arranged ? 'Chủ chuyền chưa sắp xếp lệnh này' : !v.seqUnlocked ? 'Phải hoàn tất SKU trước (đủ 100%) mới mở lệnh này' : v.alert ? 'Chưa khớp đồng bộ — nhấn để xem' : isPhoi ? 'Nhấn để xem các mảnh của SKU' : 'Nhấn để nhập sản lượng theo vật tư'}
      footer={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <CalendarClock size={14} /> Làm <b style={{ color: 'var(--text2)' }}>tuần tự</b>: SKU sau chỉ mở khi SKU trước đủ 100%. {isPhoi
          ? <>Tiến độ theo <b style={{ color: 'var(--text2)' }}>tổng cây đã cắt / cần</b>; <b style={{ color: 'var(--text2)' }}>đồng bộ sắt</b> (điểm nghẽn loại sắt) xem trong từng mảnh.</>
          : <><b style={{ color: 'var(--text2)' }}>{cfg.done}</b> = số sản phẩm ráp được đủ mọi {cfg.itemLabel.toLowerCase()} (đồng bộ); dòng đỏ = chưa khớp.</>}
      </span>}
    />
  )
}

// ── Tầng 2 (Phôi): Danh sách mảnh — số lượng cây theo từng mảnh ─────────────
// Không đồng bộ ở đây; điểm nghẽn loại sắt xem trong màn vật tư (bấm vào mảnh).
interface ManhView { m: ProcManh; tong: number; done: number; remain: number }

function ManhListBoard({ po, onBack, onOpenManh }: { po: ProcRow; cfg: StageCfg; onBack: () => void; onOpenManh: (id: number) => void }) {
  const manhs = po.manhs ?? []
  const views: ManhView[] = manhs.map(m => {
    const tong = m.lines.reduce((s, l) => s + l.needQty, 0)
    const done = m.lines.reduce((s, l) => s + l.doneQty, 0)
    return { m, tong, done, remain: Math.max(0, tong - done) }
  })

  const cols: BoardColumn<ManhView>[] = [
    { key: 'manh', header: 'Mảnh', cell: v => <span style={{ fontWeight: 700 }}>{v.m.tenManh}</span> },
    { key: 'perSku', header: 'SL/SKU', align: 'right', cell: v => `×${perSku(v.m)}` },
    { key: 'tong', header: 'Số lượng (cây)', align: 'right', cell: v => fmt(v.tong) },
    { key: 'done', header: 'Đã cắt (cây)', align: 'right', cell: v => <span style={{ fontWeight: 700 }}>{fmt(v.done)}</span> },
    { key: 'remain', header: 'Còn lại (cây)', align: 'right', cell: v => <span style={{ color: v.remain > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(v.remain)}</span> },
    { key: 'chevron', header: '', width: 40, cell: () => <span style={{ color: 'var(--text3)' }}><ChevronRight size={16} /></span> },
  ]

  return (
    <LenhSanXuatBoard<ManhView>
      onBack={onBack} backLabel="Quay lại danh sách lệnh"
      icon={<Layers size={18} />}
      title={`Danh sách Mảnh của SKU — ${po.sku}`}
      subtitle={`${po.poNumber} · ${po.productName} · SL ${fmt(po.soLuong)} · hạn ${dateVN(po.deadline)}`}
      columns={cols}
      rows={views}
      rowKey={v => v.m.id}
      clickable={() => true}
      onRowClick={v => onOpenManh(v.m.id)}
      rowTitle={v => `Xem vật tư chi tiết của ${v.m.tenManh}`}
    />
  )
}

// ── Tầng chi tiết vật tư (dùng chung Phôi/Hàn/Sơn) ─────────────────
export function VatTuDetailBoard({ lines, cfg, readOnly, title, subtitle, bannerLabel, dbUnit = 'bộ', backLabel, onBack, onUpdateLine, pendingFor, onConfirmCut, manualInput, showThucCo, onRecord, onFinishBatch, choKcsFor, partStock, batchesByLine, reviews }: {
  lines: ProcLine[]; cfg: StageCfg; readOnly: boolean
  title: string; subtitle: string; bannerLabel: string
  /** Bỏ trống khi board được nhúng làm 1 tab con (vd chi tiết Khung cơ khí bên KHSX) — không cần điều hướng "quay lại". */
  backLabel?: string; onBack?: () => void
  /** Đơn vị của số đồng bộ: Phôi = "mảnh", Hàn/Sơn = "bộ". */
  dbUnit?: string
  onUpdateLine?: (l: ProcLine) => void
  /** (không dùng cho Phôi nữa) đợt đã nhận đang chờ cắt của 1 dòng vật tư. */
  pendingFor?: (lineId: number) => SatIssueView[]
  /** (không dùng cho Phôi nữa) xác nhận cắt xong 1 đợt → cộng vào doneQty. */
  onConfirmCut?: (line: ProcLine, issue: SatIssueView, soCayThuc?: number) => void
  /** Hàn/Sơn: cho nhập tay sản lượng. Phôi = false (số lượng tự cập nhật từ màn Xác nhận sản lượng). */
  manualInput?: boolean
  /** Ép hiện/ẩn cột "Thực có" bất kể phoiMode — dùng khi nhúng chế độ chỉ xem không có cột Xác nhận cắt. */
  showThucCo?: boolean
  /** "Lưu đợt" (2026-09-09, đồng bộ Hàn/Sơn theo mẫu Sắt/VTTP - trước đó 1 nút "Ghi nhận" gộp lưu+
   *  gửi KCS) - tích luỹ vào 1 ProductionBatch đang OPEN, KHÔNG tự gửi KCS. */
  onRecord?: (line: ProcLine, qty: number) => void
  /** "Gửi KCS" - đóng batch đang OPEN (tìm qua batchesByLine) đưa sang AWAITING_QC. */
  onFinishBatch?: (batchId: string) => void
  /** KCS-gated: SL đang chờ KCS duyệt của 1 dòng (để hiện gợi ý + trừ khi nhập). */
  choKcsFor?: (lineId: number) => number
  /** Sync đoạn từ Phôi: trả số ĐOẠN tồn (KCS đạt) cho 1 thanh sắt cấu thành. Có → dùng thay thucCo tĩnh. */
  partStock?: (part: ProcPart) => number
  /** 2026-09-09: MỌI ProductionBatch (mọi status) của order+stage này, keyed theo pieceId (=lineId)
   *  - dùng để tìm đợt đang OPEN (nút "Gửi KCS") + hiện "Các đợt đã gửi" (lịch sử, mirror Sắt/VTTP). */
  batchesByLine?: Map<number, BeProductionBatch[]>
  /** QcReview nhánh ProductionBatch (mọi order/stage đang xem, KHÔNG lọc theo piece trước - lọc ở
   *  đây theo batchesByLine) - dùng tính "Lỗi" cho từng dòng + từng đợt lịch sử. */
  reviews?: BeProductionBatchQcReview[]
}) {
  const phoiMode = !!onConfirmCut
  const [draft, setDraft] = useState<Record<number, string>>({})
  const [openParts, setOpenParts] = useState<Set<number>>(new Set())
  const toggleParts = (id: number) => setOpenParts(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const db = dongBoOf(lines)
  const lech = lechOf(lines)
  const maxBo = lines.length ? Math.max(...lines.map(manhFromLine)) : 0
  const shortOf = (l: ProcLine) => (maxBo - manhFromLine(l)) * perManh(l)
  const needCut = lines.filter(l => shortOf(l) > 0).map(l => `${l.itemName} +${fmt(shortOf(l))}`)
  const itemLabelLC = cfg.itemLabel.toLowerCase()

  const failedOf = (lineId: number): number => {
    const ids = new Set((batchesByLine?.get(lineId) ?? []).map(b => b.id))
    return (reviews ?? []).filter(r => r.productionBatchId && ids.has(r.productionBatchId)).reduce((s, r) => s + r.failedQty, 0)
  }

  const submit = (line: ProcLine) => {
    const add = Number(draft[line.id])
    if (!add || add <= 0) return
    if (onRecord) onRecord(line, add) // KCS-gated: "Lưu đợt", chưa gửi KCS
    else onUpdateLine?.({ ...line, doneQty: Math.min(line.needQty, line.doneQty + add), lastInputAt: new Date().toISOString() })
    setDraft(d => ({ ...d, [line.id]: '' }))
  }

  // 2026-09-09 (theo yêu cầu người dùng: "bên Phôi đang sao thì bên Hàn Sơn y chang vậy thậm chí
  // đơn giản hơn") - mảnh Hàn/Sơn không có cỡ đoạn/công đoạn phụ để tab, mirror THẲNG list + card 1
  // mảnh như VTTP ChotPanel (đơn giản hơn cả Phôi/VTTP-có-processSteps vì không cần dải tab công
  // đoạn nào). CHỈ áp dụng khi có onRecord (Hàn/Sơn thật, đang tương tác) - phoiMode (mock 3 tầng)
  // và readOnly (nhúng xem ở ThongKePagePlan) vẫn giữ bảng nhiều dòng cũ bên dưới, KHÔNG đụng.
  const [selLineId, setSelLineId] = useState<number | null>(null)
  if (onRecord && !phoiMode) {
    const selLine = lines.find(l => l.id === selLineId) ?? null
    if (selLine) {
      return <LineDetailCard
        line={selLine} cfg={cfg} readOnly={readOnly} onBack={() => setSelLineId(null)}
        onRecord={onRecord} onFinishBatch={onFinishBatch} choKcsFor={choKcsFor}
        batchesByLine={batchesByLine} reviews={reviews}
      />
    }
    return <LineListBoard
      lines={lines} cfg={cfg} title={title} subtitle={subtitle} backLabel={backLabel} onBack={onBack}
      onEnter={id => setSelLineId(id)} choKcsFor={choKcsFor}
    />
  }

  const cols: BoardColumn<ProcLine>[] = [
    {
      key: 'item', header: cfg.itemLabel, cell: l => {
        const hasHistory = (batchesByLine?.get(l.id)?.length ?? 0) > 0
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {(l.parts?.length || hasHistory)
              ? <button onClick={e => { e.stopPropagation(); toggleParts(l.id) }} title={hasHistory ? 'Xem các đợt đã gửi' : 'Xem thanh sắt cấu thành'}
                style={{ display: 'inline-flex', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                {openParts.has(l.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
              : null}
            <span style={{ fontWeight: 600 }}>{l.itemName}</span>
          </span>
        )
      }
    },
    { key: 'spec', header: 'Quy cách', cell: l => <span style={{ color: 'var(--text3)' }}>{l.spec}</span> },
    { key: 'perManh', header: 'SL/bộ', align: 'right', cell: l => `×${perManh(l)}` },
    // 2026-09-09 (đồng bộ từ vựng với Sắt/VTTP theo yêu cầu người dùng): "Định mức"→"Cần",
    // "${cfg.done}" (Đã cắt/Đã hàn/Đã sơn)→"Đã báo" - CHỈ đổi CHỮ hiện trong bảng này, không đụng
    // `cfg.done` (còn dùng ở banner/nơi khác, giữ nguyên ý nghĩa theo verb riêng từng công đoạn).
    { key: 'need', header: `Cần (${cfg.unit})`, align: 'right', cell: l => fmt(l.needQty) },
    {
      key: 'done', header: `Đã báo (${cfg.unit})`, align: 'right', cell: l => {
        const short = shortOf(l)
        const pend = choKcsFor?.(l.id) ?? 0
        return <>
          {fmt(l.doneQty)}
          {pend > 0 && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--amber)' }}>chờ KCS: {fmt(pend)} {cfg.unit}</span>}
          {short > 0 && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--red)' }}>cần {cfg.verb} thêm {fmt(short)} {cfg.unit}</span>}
          {/* Vật tư thành phẩm (vd chân nhôm) - còn nguyên liệu thô (thanh nhôm) chưa cắt hết ở
              kho. Chỉ hiển thị, không chặn thao tác (quyết định nghiệp vụ 2026-08-22) - xem
              ProductionBatchesService.getBatchPlan() rawMaterialOnHand. */}
          {l.rawMaterialOnHand != null && l.rawMaterialOnHand > 0 && (
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--amber)' }}>
              còn {fmt(l.rawMaterialOnHand)} cây nguyên liệu chưa cắt
            </span>
          )}
        </>
      }
    },
    ...((showThucCo ?? !phoiMode) ? [{
      key: 'thucCo', header: 'Thực có', align: 'right', cell: (l: ProcLine) => (
        <span style={{ fontWeight: 600 }}>{fmt(l.thucCoQty ?? 0)}</span>
      )
    } as BoardColumn<ProcLine>] : []),
    // "Lỗi" (2026-09-09, đồng bộ Sắt/VTTP - trước phải bấm mở rộng "Các đợt đã gửi" mới thấy) -
    // CHỈ hiện khi có batchesByLine (real BE data, mock/read-only embed không có cột này).
    ...(batchesByLine ? [{
      key: 'failed', header: 'Lỗi', align: 'right', cell: (l: ProcLine) => {
        const failed = failedOf(l.id)
        return <span style={{ fontWeight: 700, color: failed > 0 ? 'var(--red)' : 'var(--text3)' }}>{failed > 0 ? fmt(failed) : '—'}</span>
      }
    } as BoardColumn<ProcLine>] : []),
    {
      key: 'remain', header: 'Còn lại', align: 'right', cell: l => {
        const remain = l.needQty - l.doneQty
        return <span style={{ fontWeight: 600, color: remain <= 0 ? 'var(--green)' : ACCENT }}>{fmt(Math.max(remain, 0))}</span>
      }
    },
    {
      // "Cập nhật lúc" (2026-09-09): khi có batchesByLine (real BE), lấy thời điểm ĐỢT GẦN NHẤT
      // (reportedAt) thay vì l.lastInputAt - hàm fetchHanSonRows() luôn set lastInputAt=null nên
      // cột này trước đây LUÔN rỗng cho Hàn/Sơn thật, không phải do chưa ai nhập gì.
      key: 'updated', header: 'Cập nhật lúc', cell: l => {
        const latestBatchAt = (batchesByLine?.get(l.id) ?? [])
          .reduce<string | null>((acc, b) => (!acc || b.reportedAt > acc) ? b.reportedAt : acc, null)
        const at = latestBatchAt ?? l.lastInputAt
        const stale = minutesSince(at) >= REMIND_MINUTES
        return at
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: stale ? 'var(--amber)' : 'var(--text3)' }}><Clock size={12} /> {timeVN(at)}</span>
          : <span style={{ color: 'var(--text3)' }}>— chưa nhập —</span>
      }
    },
    ...(phoiMode
      ? [{
        key: 'confirm', header: 'Xác nhận cắt', width: 340, cell: (l: ProcLine) => (
          <ConfirmCell line={l} issues={pendingFor!(l.id)} unit={cfg.unit}
            onConfirm={(issue, soCay) => onConfirmCut!(l, issue, soCay)} />
        )
      } as BoardColumn<ProcLine>]
      : (manualInput && !readOnly) ? [{
        // 2026-09-09 (đồng bộ Sắt/VTTP): tách "Ghi nhận" 1 nút (lưu+gửi KCS cùng lúc) thành "Lưu
        // đợt" (onRecord, tích luỹ vào ProductionBatch đang OPEN) + "Gửi KCS" riêng (onFinishBatch,
        // đóng đợt đang OPEN) - xem VatTuDetailBoard doc props. "Bù đủ" pre-fill input khi có Lỗi,
        // cùng cơ chế client-side thuần (không gọi API riêng) như StepPanel/ChotPanel bên VTTP.
        //
        // KHÔNG chặn nhập vượt "Còn lại" (2026-09-11 lần 3, theo góp ý người dùng: "đừng có chặn vẫn
        // cho phép nhập dư" - đã thử chặn ở lần sửa trước (2026-09-11 lần 1) nhưng thực tế 1 đợt có
        // thể dư ra so với định mức, không nên chặn cứng) - "Còn lại" chỉ còn mang tính THAM KHẢO,
        // đồng bộ đúng cách Cắt (LenhSanXuatPhoi.tsx's ProgressBuDuTable) và VTTP (VatTuTpDetail.tsx)
        // đã làm từ trước - input/nút "Lưu đợt" LUÔN hiện, không ẩn khi remain=0.
        key: 'input', header: `Nhập số ${cfg.unit} vừa ${cfg.verb}`, width: 260, cell: (l: ProcLine) => {
          const pend = choKcsFor?.(l.id) ?? 0
          const remain = Math.max(l.needQty - l.doneQty - pend, 0)
          const failed = failedOf(l.id)
          const openBatch = (batchesByLine?.get(l.id) ?? []).find(b => b.status === 'OPEN')
          const openQty = openBatch?.reportedQty ?? 0
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} onClick={e => e.stopPropagation()}>
              {remain <= 0 && openQty === 0 && (
                <span className="badge green" style={{ alignSelf: 'flex-start' }}>{pend > 0 ? 'chờ KCS duyệt' : 'đủ định mức'}</span>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="number" min={0} placeholder="0" value={draft[l.id] ?? ''}
                  onChange={e => {
                    const val = e.target.value
                    if (val === '') return setDraft(d => ({ ...d, [l.id]: '' }))
                    let n = Math.floor(Number(val))
                    if (isNaN(n)) return
                    if (n < 0) n = 0
                    setDraft(d => ({ ...d, [l.id]: String(n) }))
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') submit(l) }}
                  style={{ width: 90 }}
                />
                {failed > 0 && remain > 0 && (
                  <button onClick={() => setDraft(d => ({ ...d, [l.id]: String(Math.min(failed, remain)) }))}
                    style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                    Bù đủ
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="primary" onClick={() => submit(l)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }}>
                  <Plus size={13} /> Lưu đợt
                </button>
                {openQty > 0 && (
                  <button onClick={() => onFinishBatch?.(openBatch!.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12, border: 'none', borderRadius: 6, background: 'var(--green)', color: '#fff', cursor: 'pointer' }}>
                    <Send size={13} /> Gửi KCS
                  </button>
                )}
              </div>
            </div>
          )
        }
      } as BoardColumn<ProcLine>] : []),
  ]

  const banner = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', margin: '14px 0 0', borderRadius: 'var(--radius)', background: lech ? 'var(--red-bg)' : 'var(--green-bg, #e8f5e9)', color: lech ? 'var(--red)' : 'var(--green)', fontSize: 13 }}>
      {lech ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      <span>
        {bannerLabel}: <b>{fmt(db)} {dbUnit}</b>
        {lech
          ? <> — chưa cân đối. Cần {cfg.verb} thêm để đồng bộ: <b>{needCut.join(', ')}</b> ({cfg.unit}).</>
          : <> — các {itemLabelLC} đang {cfg.verb} cân đối.</>}
      </span>
    </div>
  )

  return (
    <LenhSanXuatBoard<ProcLine>
      onBack={onBack} backLabel={backLabel}
      title={title}
      subtitle={<>{subtitle}<div style={{ marginTop: 2 }}>{phoiMode
        ? <>Xác nhận các <b>đợt sắt đã nhận từ kho</b> theo từng {itemLabelLC} — hệ thống tự cộng vào tiến độ.</>
        : manualInput
          ? (onRecord
            ? <>Nhập số <b>{cfg.unit} đã {cfg.verb}</b> theo từng {itemLabelLC} → <b>Lưu đợt</b> rồi <b>Gửi KCS</b>; chỉ SL KCS đạt mới tính tiến độ.</>
            : <>Nhập số <b>{cfg.unit} đã {cfg.verb}</b> theo từng {itemLabelLC} — hệ thống tự lưu mốc thời gian.</>)
          : <>Số lượng <b>đã {cfg.verb}</b> tự cập nhật từ màn <b>Xác nhận sản lượng</b> — màn này chỉ theo dõi đồng bộ.</>}</div></>}
      beforeTable={banner}
      columns={cols}
      rows={lines}
      rowKey={l => l.id}
      rowTone={l => shortOf(l) > 0 ? 'alert' : 'default'}
      expandedRow={l => {
        if (!openParts.has(l.id)) return null
        const lineBatches = batchesByLine?.get(l.id) ?? []
        if (!l.parts && lineBatches.length === 0) return null
        const thucCoOf = (pt: ProcPart) => partStock ? partStock(pt) : (pt.thucCo ?? 0) // sync từ Phôi nếu có
        const rapDuocOf = (pt: ProcPart) => pt.perChiTiet > 0 ? Math.floor(thucCoOf(pt) / pt.perChiTiet) : 0
        const rapMin = l.parts?.length ? Math.min(...l.parts.map(rapDuocOf)) : 0
        const thR2: React.CSSProperties = { ...td, fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
        return (
          <div style={{ padding: '10px 16px 14px', background: 'var(--surface2)', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {l.parts && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                  Đoạn sắt cấu thành 1 {itemLabelLC} <span style={{ fontWeight: 400, color: 'var(--text3)' }}>{partStock ? '(thực có = đoạn Phôi KCS đạt − đã hàn)' : '(theo mảnh bên Phôi)'}</span>:
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)' }}>
                        <th style={thR2}>Loại sắt</th>
                        <th style={thR2}>Quy cách · Dài</th>
                        <th style={{ ...thR2, textAlign: 'right' }}>SL / {itemLabelLC}</th>
                        <th style={{ ...thR2, textAlign: 'right' }}>Thực có (đoạn)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.parts.map((pt, i) => {
                        const nghen = rapDuocOf(pt) === rapMin
                        return (
                          <tr key={i} style={{ borderTop: '1px solid var(--border)', background: nghen ? 'var(--red-bg)' : undefined }}>
                            <td style={{ ...td, fontWeight: 600, borderLeft: `3px solid ${nghen ? 'var(--red)' : 'transparent'}` }}>
                              {pt.loaiSat}
                              {nghen && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginLeft: 6 }}>· thiếu nhất</span>}
                            </td>
                            <td style={{ ...td, color: 'var(--text3)' }}>{pt.quyCach} · <b style={{ color: 'var(--text2)' }}>{fmt(pt.len)}mm</b></td>
                            <td style={{ ...tdR, fontWeight: 600 }}>×{pt.perChiTiet}</td>
                            <td style={{ ...tdR, fontWeight: nghen ? 700 : 400, color: nghen ? 'var(--red)' : 'var(--text)' }}>{fmt(thucCoOf(pt))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface)' }}>
                        <td style={{ ...td, fontWeight: 700 }} colSpan={3}>Đủ ráp (theo đoạn thiếu nhất)</td>
                        <td style={{ ...tdR, fontWeight: 800, color: 'var(--green)' }}>{fmt(rapMin)} {itemLabelLC}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
            {lineBatches.length > 0 && <BatchHistoryList batches={lineBatches} reviews={reviews ?? []} unit={cfg.unit} />}
          </div>
        )
      }}
    />
  )
}

// ── "Các đợt đã gửi" (lịch sử thuần xem, mirror ProductionBatchHistoryCard bên VatTuTpDetail.tsx,
// đổi màu sang biến CSS var chung của core.tsx thay vì hằng số riêng ACCENT/GREEN/RED) - đánh số
// "Đợt N" theo thứ tự TẠO RA (cũ nhất = Đợt 1). ──────────────────────────────────────────────────
function BatchHistoryList({ batches, reviews, unit }: {
  batches: BeProductionBatch[]; reviews: BeProductionBatchQcReview[]; unit: string
}) {
  const sorted = [...batches].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
  const orderIndexById = new Map(
    [...batches].sort((a, b) => a.reportedAt.localeCompare(b.reportedAt)).map((b, i) => [b.id, i + 1]),
  )
  const reviewByBatchId = new Map(reviews.map(r => [r.productionBatchId, r]))
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>Các đợt đã gửi ({sorted.length}):</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(b => {
          const failed = reviewByBatchId.get(b.id)?.failedQty ?? 0
          return (
            <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1px solid ${failed > 0 ? 'var(--red)' : 'var(--border)'}`, borderRadius: 8, background: 'var(--surface)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Đợt {orderIndexById.get(b.id) ?? 0}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(b.reportedQty)} {unit} · {timeVN(b.reportedAt)}</div>
              </div>
              {b.status === 'OPEN' ? (
                <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>đang mở</span>
              ) : b.status === 'AWAITING_QC' ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}><Clock size={12} /> chờ KCS</span>
              ) : failed === 0 ? (
                // "đã duyệt" cho đợt QC_DONE sạch (2026-09-10, theo góp ý người dùng: mirror
                // ProductionBatchHistoryCard bên VatTuTpDetail.tsx/CutBundleCard bên
                // LenhSanXuatPhoi.tsx - trước đây đợt đã qua KCS không hiện badge nào ở đây).
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--green)' }}><Check size={12} /> đã duyệt</span>
              ) : null}
              {failed > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>Lỗi {failed}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Danh sách mảnh (Hàn/Sơn, 2026-09-09) - mirror ĐÚNG list "Vật tư TP" bên Phôi
// (LenhSanXuatPhoi.tsx) - mỗi mảnh 1 dòng, bấm vào mở LineDetailCard. ──────────────────────────
function LineListBoard({ lines, cfg, title, subtitle, backLabel, onBack, onEnter, choKcsFor }: {
  lines: ProcLine[]; cfg: StageCfg; title: string; subtitle: string
  backLabel?: string; onBack?: () => void
  onEnter: (lineId: number) => void
  choKcsFor?: (lineId: number) => number
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        {onBack && (
          <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
            <ChevronLeft size={15} /> {backLabel ?? 'Quay lại'}
          </button>
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{subtitle}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lines.map(l => {
          const pend = choKcsFor?.(l.id) ?? 0
          const remain = l.needQty - l.doneQty - pend
          const done = remain <= 0
          return (
            <div key={l.id} onClick={() => onEnter(l.id)} style={{ ...card, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
                <ChevronRight size={15} color="var(--text3)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{l.itemName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cần {fmt(l.needQty)} {cfg.unit}</div>
                </div>
                {done ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--green)' }}><Check size={12} /> đã {cfg.verb} xong</span>
                ) : pend > 0 ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}><Clock size={12} /> chờ KCS duyệt</span>
                ) : (
                  <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>còn {fmt(remain)} {cfg.unit}</span>
                )}
              </div>
            </div>
          )
        })}
        {lines.length === 0 && (
          <div style={{ ...card, padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Không có dữ liệu</div>
        )}
      </div>
    </div>
  )
}

const thH: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }
const thHR: React.CSSProperties = { ...thH, textAlign: 'right' }

// ── Chi tiết 1 mảnh (Hàn/Sơn, 2026-09-09) - mirror ĐÚNG ChotPanel bên VTTP (VatTuTpDetail.tsx):
// bảng Cần/Đã báo/Lỗi/Còn lại/Nhập đợt này + Lưu đợt/Gửi KCS cạnh nhau + Bù đủ + "Các đợt đã gửi".
// Đơn giản hơn VTTP (không có dải tab công đoạn - Hàn/Sơn không có processSteps). ─────────────────
function LineDetailCard({ line, cfg, readOnly, onBack, onRecord, onFinishBatch, choKcsFor, batchesByLine, reviews }: {
  line: ProcLine; cfg: StageCfg; readOnly: boolean; onBack: () => void
  onRecord: (line: ProcLine, qty: number) => void | Promise<void>
  onFinishBatch?: (batchId: string) => void | Promise<void>
  choKcsFor?: (lineId: number) => number
  batchesByLine?: Map<number, BeProductionBatch[]>
  reviews?: BeProductionBatchQcReview[]
}) {
  const [qty, setQty] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendBusy, setSendBusy] = useState(false)

  const lineBatches = batchesByLine?.get(line.id) ?? []
  const openBatch = lineBatches.find(b => b.status === 'OPEN')
  const openQty = openBatch?.reportedQty ?? 0
  const pend = choKcsFor?.(line.id) ?? 0
  const batchIds = new Set(lineBatches.map(b => b.id))
  const failed = (reviews ?? []).filter(r => r.productionBatchId && batchIds.has(r.productionBatchId)).reduce((s, r) => s + r.failedQty, 0)
  const remain = Math.max(line.needQty - line.doneQty - pend, 0)

  const submit = async () => {
    // KHÔNG clamp theo "Còn lại" (2026-09-11 lần 3, theo góp ý người dùng: "đừng có chặn vẫn cho
    // phép nhập dư" - đã thử clamp ở lần sửa trước (lần 1, QA audit) nhưng thực tế 1 đợt có thể dư
    // ra so với định mức, không nên chặn cứng; "Còn lại" chỉ còn mang tính THAM KHẢO, đồng bộ đúng
    // cách Cắt/VTTP đã làm từ trước).
    const q = Math.floor(Number(qty) || 0)
    if (q <= 0) return
    setBusy(true)
    try { await onRecord(line, q); setQty('') }
    catch { /* onRecord đã tự báo lỗi (alert) - giữ nguyên ô nhập để không phải gõ lại */ }
    finally { setBusy(false) }
  }
  const sendToKcs = async () => {
    if (!openBatch) return
    setSendBusy(true)
    try { await onFinishBatch?.(openBatch.id) }
    catch { /* onFinishBatch đã tự báo lỗi (alert) */ }
    finally { setSendBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer' }}>
          <ChevronLeft size={15} /> Quay lại
        </button>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{line.itemName}</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{line.spec} · Cần {fmt(line.needQty)} {cfg.unit}</div>
        </div>
      </div>

      <div style={{ ...card, marginBottom: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              <th style={thH}>Mảnh</th>
              <th style={thHR}>Cần</th>
              <th style={thHR}>Đã báo</th>
              <th style={thHR}>Lỗi</th>
              <th style={thHR}>Còn lại</th>
              {!readOnly && <th style={{ ...thHR, width: 140 }}>Nhập đợt này</th>}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderTop: '1px solid var(--border)' }}>
              <td style={td}>{line.itemName}</td>
              <td style={tdR}>{fmt(line.needQty)}</td>
              <td style={tdR}>{fmt(line.doneQty)}</td>
              <td style={{ ...tdR, color: failed > 0 ? 'var(--red)' : 'var(--text3)' }}>{failed > 0 ? fmt(failed) : '—'}</td>
              <td style={{ ...tdR, color: remain > 0 ? ACCENT : 'var(--green)', fontWeight: 700 }}>{fmt(remain)}</td>
              {!readOnly && (
                <td style={{ ...td, textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input type="number" min={0} placeholder="0" value={qty} onChange={e => setQty(e.target.value)} style={{ width: 70 }} />
                    {failed > 0 && remain > 0 && (
                      <button onClick={() => setQty(String(Math.min(failed, remain)))}
                        style={{ padding: '4px 8px', fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                        Bù đủ
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button className="primary" onClick={submit} disabled={busy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Plus size={13} /> {busy ? '...' : 'Lưu đợt'}
          </button>
          {openQty > 0 && (
            <button onClick={sendToKcs} disabled={sendBusy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, border: 'none', borderRadius: 6, background: 'var(--green)', color: '#fff', cursor: sendBusy ? 'not-allowed' : 'pointer' }}>
              <Send size={13} /> {sendBusy ? '...' : 'Gửi KCS'}
            </button>
          )}
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
          <div><span style={{ color: 'var(--text3)' }}>Chưa gửi KCS</span> <b style={{ color: openQty > 0 ? ACCENT : 'var(--text3)' }}>{fmt(openQty)}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Chờ KCS duyệt</span> <b style={{ color: 'var(--amber)' }}>{fmt(pend)}</b></div>
          <div><span style={{ color: 'var(--text3)' }}>Đã duyệt</span> <b style={{ color: 'var(--green)' }}>{fmt(line.doneQty)}</b></div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <BatchHistoryList batches={lineBatches} reviews={reviews ?? []} unit={cfg.unit} />
      </div>
    </div>
  )
}

// ── Ô "Xác nhận cắt" (Phôi) — các đợt đã nhận chờ cắt của 1 dòng vật tư ──────
function ConfirmCell({ line, issues, unit, onConfirm }: {
  line: ProcLine; issues: SatIssueView[]; unit: string
  onConfirm: (issue: SatIssueView, soCayThuc?: number) => void
}) {
  if (issues.length === 0) {
    const remain = line.needQty - line.doneQty
    return remain <= 0
      ? <span className="badge green">đủ định mức</span>
      : <span style={{ fontSize: 12, color: 'var(--text3)' }}>— chưa có đợt chờ cắt —</span>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }} onClick={e => e.stopPropagation()}>
      {issues.map(i => <ConfirmMini key={i.id} issue={i} unit={unit} onConfirm={s => onConfirm(i, s)} />)}
    </div>
  )
}

function ConfirmMini({ issue, unit, onConfirm }: {
  issue: SatIssueView; unit: string; onConfirm: (soCayThuc?: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(issue.soCay))
  const gio = issue.dotThoiGian.slice(11)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px', background: 'var(--surface2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>Đợt {gio} · <b style={{ color: 'var(--text)' }}>{fmt(issue.soCay)} {unit}</b></span>
        <button className="primary" onClick={() => onConfirm()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', fontSize: 12 }}>
          <Scissors size={12} /> Xác nhận cắt xong
        </button>
        <button onClick={() => setEditing(v => !v)}
          style={{ padding: '4px 8px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
          Báo sai lệch
        </button>
      </div>
      {editing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>Thực cắt:</span>
          <input type="number" min={0} value={val} onChange={e => setVal(e.target.value)} style={{ width: 64 }} />
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>/ {fmt(issue.soCay)} {unit}</span>
          <button className="primary" onClick={() => onConfirm(Math.max(0, Number(val) || 0))}
            style={{ padding: '4px 9px', fontSize: 12 }}>Lưu</button>
        </div>
      )}
    </div>
  )
}

// ── Orchestrator: Phôi (3 tầng) ────────────────────────────────────
// "Đã cắt" của mỗi dòng = base(seed) + Σ cây các đợt ĐÃ XÁC NHẬN (DA_CAT) theo lineId.
// Xác nhận sản lượng làm ở màn riêng "Xác nhận sản lượng"; màn này chỉ theo dõi đồng bộ.
export function PhoiScreen({ cfg, rows, readOnly = false }: {
  cfg: StageCfg
  rows: ProcRow[]
  readOnly?: boolean
}) {
  const [selPoId, setSelPoId] = useState<number | null>(null)
  const [selManhId, setSelManhId] = useState<number | null>(null)
  const { data: issues } = useFetch<SatIssueView[]>(() => api.getDotXuatSat(), [])

  // Số cây đã xác nhận cắt xong theo từng dòng vật tư (lineId).
  const confirmedByLine = useMemo(() => {
    const m = new Map<number, number>()
    for (const i of issues ?? []) if (i.status === 'DA_CAT') m.set(i.lineId, (m.get(i.lineId) ?? 0) + (i.soCayThuc ?? i.soCay))
    return m
  }, [issues])

  // Rows hiển thị = base + đã xác nhận (cộng vào doneQty đúng dòng).
  const view = useMemo(() => rows.map(r => ({
    ...r,
    manhs: r.manhs?.map(mn => ({ ...mn, lines: mn.lines.map(l => ({ ...l, doneQty: Math.min(l.needQty, l.doneQty + (confirmedByLine.get(l.id) ?? 0)) })) })),
  })), [rows, confirmedByLine])

  const selPo = view.find(r => r.id === selPoId) ?? null
  const selManh = selPo?.manhs?.find(m => m.id === selManhId) ?? null

  if (selPo && selManh) {
    return <VatTuDetailBoard
      lines={selManh.lines} cfg={cfg} readOnly={readOnly}
      title={selManh.tenManh}
      subtitle={`${selPo.poNumber} · ${selPo.sku} · SL ${fmt(selPo.soLuong)} · hạn ${dateVN(selPo.deadline)}`}
      bannerLabel="Đồng bộ sắt" dbUnit="mảnh" backLabel="Quay lại danh sách mảnh"
      onBack={() => setSelManhId(null)}
    />
  }
  if (selPo) {
    return <ManhListBoard po={selPo} cfg={cfg} onBack={() => setSelPoId(null)} onOpenManh={id => setSelManhId(id)} />
  }
  return <PoListBoard rows={view} cfg={cfg} isPhoi onEnter={id => { setSelPoId(id); setSelManhId(null) }} />
}

// ── Nguồn dữ liệu thật cho Hàn/Sơn (đợt 2, thay hanSeed()/sonSeed()) ────────────────
// listProductionOrdersForStage() rồi getProductionBatchPlan() từng PO — cả 2 đã aggregate sẵn
// plannedQty/awaitingQcQty/passedQty theo MẢNH (Piece, không còn Part - xem
// ProductionBatchesService.getBatchPlan() ở BE), không cần tự cộng dồn từ batches như bản mock cũ.
// Bỏ hẳn tính năng "xem thanh sắt cấu thành" (ProcPart/partStock, đồng bộ tồn đoạn từ Phôi) — dữ
// liệu này chỉ tồn tại ở mock/seed; BE nay đã có segment-level BOM theo mảnh thật (PieceBom, cùng
// bảng Phôi dùng), nhưng nối lại tính năng này vẫn ngoài phạm vi lần đổi Part->Piece này.
interface HanSonFetch {
  rows: ProcRow[]
  awaitingByLine: Map<number, number>
  /** 2026-09-09 (đồng bộ "Lưu đợt"/"Gửi KCS"/"Các đợt đã gửi" - trước chỉ VTTP có): MỌI
   *  ProductionBatch (mọi status) của đúng order+stage đó, keyed theo pieceId (=lineId). */
  batchesByLine: Map<number, BeProductionBatch[]>
}

async function fetchHanSonRows(stage: SanLuongStage): Promise<HanSonFetch> {
  const orders: BeProductionOrderSummary[] = await api.listProductionOrdersForStage()
  const settled = await Promise.all(orders.map(async o => {
    try {
      const [plan, batches] = await Promise.all([
        api.getProductionBatchPlan(o.id, stage),
        api.getProductionBatchesForOrder(o.id, stage),
      ])
      return { o, plan, batches }
    }
    catch { return null }
  }))

  const rows: ProcRow[] = []
  const awaitingByLine = new Map<number, number>()
  const batchesByLine = new Map<number, BeProductionBatch[]>()
  for (const s of settled) {
    if (!s) continue
    const { o, plan, batches } = s
    const lines: ProcLine[] = plan.items.map(item => {
      const lineId = Number(item.pieceId)
      awaitingByLine.set(lineId, item.awaitingQcQty)
      batchesByLine.set(lineId, batches.filter(b => b.pieceId === item.pieceId))
      return {
        id: lineId, itemName: item.pieceName, spec: item.pieceCode,
        needQty: item.plannedQty, doneQty: item.passedQty,
        lastInputAt: null, realPieceId: item.pieceId,
        rawMaterialOnHand: item.rawMaterialOnHand,
      }
    })
    rows.push({
      // arrangedAt: không null - "chủ chuyền sắp xếp" là bước riêng của mock, không có gì tương
      // ứng ở BE; PO thật xuất hiện trong danh sách nghĩa là đã sẵn sàng để báo sản lượng.
      id: Number(o.id), poNumber: plan.salesOrderCode ?? '—', sku: plan.productName, productName: plan.productName,
      soLuong: plan.quantity, deadline: '—', arrangedAt: new Date().toISOString(), lines, realOrderId: o.id,
      productionInvoiceId: o.productionInvoiceId, piCode: o.piCode,
    })
  }
  return { rows, awaitingByLine, batchesByLine }
}

// ── Orchestrator: Hàn/Sơn (2 tầng) ─────────────────────────────────
// `stage` (HAN/SON) → nguồn dữ liệu thật qua fetchHanSonRows() (đợt 2), báo sản lượng gọi thẳng
// production-batches thật (KCS duyệt ở màn khác, xem KcsStagePage). Không truyền stage → giữ hành
// vi cũ (bump done cục bộ) cho các nơi nhúng read-only — hiện không còn nơi nào gọi kiểu này
// (LenhSanXuatHan/Son luôn truyền stage), giữ lại thuần phòng thủ kiểu.
export function TwoTierScreen({ cfg, seed, readOnly = false, stage }: {
  cfg: StageCfg; seed?: () => ProcRow[]; readOnly?: boolean; stage?: SanLuongStage
}) {
  const { data: fetched, refetch } = useFetch<HanSonFetch>(
    () => stage ? fetchHanSonRows(stage) : Promise.resolve({ rows: [], awaitingByLine: new Map(), batchesByLine: new Map() }), [stage])
  // "Lỗi" theo đợt (2026-09-09, đồng bộ Sắt/VTTP) - fetch 1 lần, lọc theo batchesByLine ở
  // VatTuDetailBoard (cùng idiom ChotPanel/StepPanel, VatTuTpDetail.tsx).
  const { data: reviews, refetch: refetchReviews } = useFetch(() => stage ? api.getQcReviewsForProductionBatches() : Promise.resolve([]), [stage])

  const [rows, setRows] = useState<ProcRow[]>(() => seed?.() ?? [])
  useEffect(() => {
    if (!stage) return
    setRows(fetched?.rows ?? [])
  }, [fetched, stage])

  const [selPoId, setSelPoId] = useState<number | null>(null)
  // Gom theo PI (2026-08-31, đồng nhất với Phôi - xem PiListBoard đầu file). null = đang ở tầng
  // ngoài cùng (danh sách PI); có giá trị = đã chọn 1 PI, đang xem danh sách SKU trong PI đó.
  const [selPiId, setSelPiId] = useState<string | null>(null)

  // done đã có sẵn trong ProcLine.doneQty (từ passedQty của plan) — chỉ còn chờ-KCS cần map riêng.
  const awaitingByLine = fetched?.awaitingByLine ?? new Map<number, number>()
  const batchesByLine = fetched?.batchesByLine ?? new Map<number, BeProductionBatch[]>()

  const selPo = rows.find(r => r.id === selPoId) ?? null
  const piGroups = useMemo(() => buildPiGroups(rows), [rows])
  const selPiGroup = selPiId ? piGroups.find(g => g.productionInvoiceId === selPiId) ?? null : null

  const updateLineFlat = (poId: number, ul: ProcLine) =>
    setRows(rs => rs.map(r => r.id !== poId ? r : { ...r, lines: r.lines?.map(l => l.id === ul.id ? ul : l) }))

  // LineDetailCard.submit()/sendToKcs() await promise này rồi mới clear ô nhập/tắt busy - alert()
  // báo lỗi ngay, sau đó NÉM LẠI lỗi để caller biết thất bại (không tự xoá ô nhập/không coi như đã
  // xong khi thật ra chưa lưu được - 2026-09-09, sửa cùng lúc với bug thiếu await ở LineDetailCard).
  const recordQty = async (po: ProcRow, line: ProcLine, qty: number) => {
    if (!stage || !po.realOrderId || !line.realPieceId) return
    try {
      await api.recordProductionBatch(po.realOrderId, { stage, pieceId: line.realPieceId, qty })
      refetch(); refetchReviews()
    } catch (e) {
      alert(errMsg(e, 'Không lưu được đợt'))
      throw e
    }
  }
  const finishBatch = async (batchId: string) => {
    try {
      await api.finishProductionBatch(batchId)
      // refetchReviews() (2026-09-11, QA audit C3) - trước đây chỉ refetch() (rows/batches), không
      // đụng `reviews` - nếu KCS duyệt/từ chối 1 đợt trong lúc màn này đang mở, cột "Lỗi"/nút "Bù
      // đủ" (dựa vào reviews) hiện SỐ CŨ cho tới khi rời trang/reload, lệch với "Đã báo"/"Còn lại"
      // (đã cập nhật đúng từ refetch() ở trên).
      refetch(); refetchReviews()
    } catch (e) {
      alert(errMsg(e, 'Không gửi được'))
      throw e
    }
  }

  if (selPo) {
    return <VatTuDetailBoard
      lines={selPo.lines ?? []} cfg={cfg} readOnly={readOnly}
      title={selPo.sku}
      subtitle={`${selPo.poNumber} · ${selPo.productName} · SL ${fmt(selPo.soLuong)} · hạn ${dateVN(selPo.deadline)}`}
      bannerLabel="Đồng bộ" backLabel="Quay lại danh sách lệnh"
      onBack={() => setSelPoId(null)}
      onUpdateLine={stage ? undefined : l => updateLineFlat(selPo.id, l)}
      onRecord={stage && !readOnly ? (l, qty) => recordQty(selPo, l, qty) : undefined}
      onFinishBatch={stage && !readOnly ? finishBatch : undefined}
      choKcsFor={stage ? (id => awaitingByLine.get(id) ?? 0) : undefined}
      showThucCo={stage ? false : undefined}
      batchesByLine={stage ? batchesByLine : undefined}
      reviews={stage ? (reviews ?? []) : undefined}
      manualInput
    />
  }
  if (selPiGroup) {
    return <PoListBoard
      rows={selPiGroup.rows} cfg={cfg} isPhoi={false} sequential={!stage}
      onEnter={id => setSelPoId(id)}
      onBack={() => setSelPiId(null)} piCode={selPiGroup.piCode}
    />
  }
  return <PiListBoard groups={piGroups} cfg={cfg} onEnter={id => setSelPiId(id)} />
}

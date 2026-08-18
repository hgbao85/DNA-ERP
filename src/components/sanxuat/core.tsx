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
import { ChevronRight, ChevronDown, Clock, AlertTriangle, Plus, CalendarClock, Layers, CheckCircle2, Play, Square, Lock, Scissors, Wrench, Flame, SprayCan } from 'lucide-react'
import LenhSanXuatBoard, { type BoardColumn } from './LenhSanXuatBoard'
import { useFetch } from '../../hooks/useFetch'
import * as api from '../../services/api'
import type { SatIssueView } from '../../services/api'
import type { BeProductionOrderSummary, ProductionBatchStage as SanLuongStage } from '../../services/production-batches-api'

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
  startedAt?: string | null
  cutAtStart?: number | null
  lastSession?: { from: string; to: string; cut: number } | null
  manhs?: ProcManh[]    // Phôi
  lines?: ProcLine[]    // Hàn/Sơn
  /** Hàn/Sơn nối BE thật (đợt 2): ProductionOrder.id thật (BE) dùng để báo sản lượng — xem
   *  production-batches-api.ts. Không set cho Phôi (vẫn mock). */
  realOrderId?: string
}
export interface StageCfg {
  label: string
  done: string
  verb: string
  itemLabel: string
  unit: string
  Icon: React.ComponentType<{ size?: number }>
}

// Cấu hình dùng chung cho công đoạn Phôi/Hàn/Sơn — dùng lại ở màn Lệnh sản xuất riêng
// (Phoi/Han/Son@demo.com) lẫn ở màn chi tiết Khung cơ khí bên KHSX (xem ThongKePagePlan.tsx).
export const PHOI_CFG: StageCfg = { label: 'Phôi', done: 'Đã cắt', verb: 'cắt', itemLabel: 'Loại sắt', unit: 'cây', Icon: Wrench }
export const HAN_CFG: StageCfg = { label: 'Hàn', done: 'Đã hàn', verb: 'hàn', itemLabel: 'Mảnh', unit: 'cái', Icon: Flame }
export const SON_CFG: StageCfg = { label: 'Sơn', done: 'Đã sơn', verb: 'sơn', itemLabel: 'Loại sơn', unit: 'lít', Icon: SprayCan }

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
const totalCut = (r: ProcRow) => allLines(r).reduce((s, l) => s + l.doneQty, 0)
const poSummary = (r: ProcRow) => {
  const daLam = skuDongBo(r)
  const pct = r.soLuong > 0 ? Math.round((daLam / r.soLuong) * 100) : 0
  return { pct, daLam, conLai: r.soLuong - daLam }
}
// Phôi: tiến độ theo tổng CÂY (đã cắt / cần) — không dùng đồng bộ mảnh→bộ.
const poSummaryCay = (r: ProcRow) => {
  const lines = allLines(r)
  const need = lines.reduce((s, l) => s + l.needQty, 0)
  const done = lines.reduce((s, l) => s + l.doneQty, 0)
  const pct = need > 0 ? Math.round((done / need) * 100) : 0
  return { pct, daLam: done, conLai: Math.max(0, need - done) }
}
const durText = (fromISO: string, toISO: string) => {
  const mins = Math.max(0, Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / 60000))
  if (mins < 60) return `${mins} phút`
  const h = Math.floor(mins / 60), m = mins % 60
  return m ? `${h}h${m}p` : `${h}h`
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

// ── Tầng 1: Danh sách lệnh (PO) ────────────────────────────────────
interface PoView { r: ProcRow; s: ReturnType<typeof poSummary>; unlocked: boolean; running: boolean; canEnter: boolean; arranged: boolean; seqUnlocked: boolean; alert: boolean }

function PoListBoard({ rows, cfg, isPhoi, sequential = true, onEnter, onStart, onEnd }: {
  rows: ProcRow[]; cfg: StageCfg; isPhoi: boolean
  /** "Làm tuần tự" (PO sau chỉ mở khi PO trước đủ 100%) — quy ước riêng của demo/mock, KHÔNG có gì
   *  tương ứng ở BE. Hàn/Sơn nối BE thật (đợt 2) tắt hẳn để không chặn oan PO thật theo thứ tự
   *  bất kỳ trả về từ listProductionOrdersForStage(). */
  sequential?: boolean
  onEnter: (poId: number) => void; onStart: (poId: number) => void; onEnd: (poId: number) => void
}) {
  const sumOf = (r: ProcRow) => isPhoi ? poSummaryCay(r) : poSummary(r)
  const views: PoView[] = rows.map((r, i) => {
    const s = sumOf(r)
    const arranged = !!r.arrangedAt
    const seqUnlocked = !sequential || i === 0 || sumOf(rows[i - 1]).pct >= 100
    const unlocked = arranged && seqUnlocked
    const running = !!r.startedAt
    // Phôi: bấm thẳng vào PO (không cần Bắt đầu ca) · không đồng bộ mảnh nên không báo lệch.
    return { r, s, arranged, seqUnlocked, unlocked, running, canEnter: isPhoi ? unlocked : unlocked && running, alert: !isPhoi && unlocked && skuLech(r) }
  })

  const cols: BoardColumn<PoView>[] = [
    {
      key: 'po', header: 'PO', cell: v => (
        <span style={{ fontWeight: 700 }}>
          {!v.seqUnlocked
            ? <Lock size={13} style={{ verticalAlign: -2, marginRight: 5, color: 'var(--text3)' }} />
            : v.alert && <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 5, color: 'var(--red)' }} />}
          {v.r.poNumber}
        </span>
      )
    },
    { key: 'sku', header: 'SKU', cell: v => v.r.sku },
    { key: 'sl', header: 'Số lượng', align: 'right', cell: v => fmt(v.r.soLuong) },
    { key: 'done', header: isPhoi ? `${cfg.done} (${cfg.unit})` : cfg.done, align: 'right', cell: v => <span style={{ fontWeight: 700, color: v.alert ? 'var(--red)' : 'var(--text)' }}>{fmt(v.s.daLam)}</span> },
    { key: 'remain', header: isPhoi ? `Còn lại (${cfg.unit})` : 'Còn lại', align: 'right', cell: v => <span style={{ color: v.s.conLai > 0 ? ACCENT : 'var(--green)', fontWeight: 600 }}>{fmt(v.s.conLai)}</span> },
    { key: 'progress', header: 'Tiến độ', width: 160, cell: v => <Progress pct={v.s.pct} /> },
    { key: 'deadline', header: 'Deadline', cell: v => dateVN(v.r.deadline) },
    // Cột "Ca" (Bắt đầu/Kết thúc) chỉ cho Hàn/Sơn. Phôi bấm thẳng vào PO.
    ...((isPhoi ? [] : [{
      key: 'ca', header: `Ca ${cfg.verb}`, width: 180, cell: (v: PoView) => (
        <div onClick={e => e.stopPropagation()}>
          {!v.seqUnlocked
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text3)' }}><Lock size={12} /> Chờ PO trước</span>
            : !v.arranged
              ? <span style={{ fontSize: 12, color: 'var(--text3)' }}>—</span>
              : v.s.pct >= 100
                ? <span className="badge green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12} /> Hoàn tất</span>
                : v.running
                  ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                    <button onClick={() => onEnd(v.r.id)} className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12, background: 'var(--red)', borderColor: 'var(--red)' }}>
                      <Square size={12} /> Kết thúc
                    </button>
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>đang {cfg.verb} · từ {timeVN(v.r.startedAt!)}</span>
                  </div>
                  : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
                    <button onClick={() => onStart(v.r.id)} className="primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', fontSize: 12 }}>
                      <Play size={12} /> Bắt đầu
                    </button>
                    {v.r.lastSession && <span style={{ fontSize: 11, color: 'var(--text3)' }}>ca trước: {fmt(v.r.lastSession.cut)} {cfg.unit} · {durText(v.r.lastSession.from, v.r.lastSession.to)}</span>}
                  </div>}
        </div>
      )
    }]) as BoardColumn<PoView>[]),
  ]

  const Icon = cfg.Icon
  return (
    <LenhSanXuatBoard<PoView>
      icon={<Icon size={18} />}
      title={`Lệnh sản xuất — Công đoạn ${cfg.label}`}
      subtitle={isPhoi
        ? `Theo dõi tiến độ ${cfg.verb} theo PO/SKU · bấm PO để xem mảnh & xác nhận cắt theo đợt`
        : `Theo dõi tiến độ ${cfg.verb} theo PO/SKU · nhập sản lượng theo ${cfg.itemLabel.toLowerCase()}`}
      columns={cols}
      rows={views}
      rowKey={v => v.r.id}
      rowTone={v => !v.unlocked ? 'muted' : v.alert ? 'alert' : 'default'}
      clickable={v => v.canEnter}
      onRowClick={v => onEnter(v.r.id)}
      rowTitle={v => !v.arranged ? 'Chủ chuyền chưa sắp xếp lệnh này' : !v.seqUnlocked ? 'Phải hoàn tất PO trước (đủ 100%) mới mở lệnh này' : v.alert ? 'Chưa khớp đồng bộ — nhấn để xem' : isPhoi ? 'Nhấn để xem các mảnh của SKU' : !v.running ? 'Nhấn "Bắt đầu" để mở nhập sản lượng' : 'Nhấn để nhập sản lượng theo vật tư'}
      footer={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <CalendarClock size={14} /> Làm <b style={{ color: 'var(--text2)' }}>tuần tự</b>: PO sau chỉ mở khi PO trước đủ 100%. {isPhoi
          ? <>Tiến độ theo <b style={{ color: 'var(--text2)' }}>tổng cây đã cắt / cần</b>; <b style={{ color: 'var(--text2)' }}>đồng bộ sắt</b> (điểm nghẽn loại sắt) xem trong từng mảnh.</>
          : <><b style={{ color: 'var(--text2)' }}>{cfg.done}</b> = số sản phẩm ráp được đủ mọi {cfg.itemLabel.toLowerCase()} (đồng bộ); dòng đỏ = chưa khớp. Bấm <b style={{ color: 'var(--text2)' }}>Bắt đầu/Kết thúc</b> để đo sản lượng theo ca.</>}
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
export function VatTuDetailBoard({ lines, cfg, readOnly, title, subtitle, bannerLabel, dbUnit = 'bộ', backLabel, onBack, onUpdateLine, pendingFor, onConfirmCut, manualInput, showThucCo, onReport, choKcsFor, partStock }: {
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
  /** KCS-gated (Hàn/Sơn): báo sản lượng → tạo lô CHỜ KCS (thay vì cộng thẳng done). */
  onReport?: (line: ProcLine, qty: number) => void
  /** KCS-gated: SL đang chờ KCS duyệt của 1 dòng (để hiện gợi ý + trừ khi nhập). */
  choKcsFor?: (lineId: number) => number
  /** Sync đoạn từ Phôi: trả số ĐOẠN tồn (KCS đạt) cho 1 thanh sắt cấu thành. Có → dùng thay thucCo tĩnh. */
  partStock?: (part: ProcPart) => number
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

  const submit = (line: ProcLine) => {
    const add = Number(draft[line.id])
    if (!add || add <= 0) return
    if (onReport) onReport(line, add) // KCS-gated: đẩy sang chờ KCS
    else onUpdateLine?.({ ...line, doneQty: Math.min(line.needQty, line.doneQty + add), lastInputAt: new Date().toISOString() })
    setDraft(d => ({ ...d, [line.id]: '' }))
  }

  const cols: BoardColumn<ProcLine>[] = [
    {
      key: 'item', header: cfg.itemLabel, cell: l => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          {l.parts?.length
            ? <button onClick={e => { e.stopPropagation(); toggleParts(l.id) }} title="Xem thanh sắt cấu thành"
              style={{ display: 'inline-flex', padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
              {openParts.has(l.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
            : null}
          <span style={{ fontWeight: 600 }}>{l.itemName}</span>
        </span>
      )
    },
    { key: 'spec', header: 'Quy cách', cell: l => <span style={{ color: 'var(--text3)' }}>{l.spec}</span> },
    { key: 'perManh', header: 'SL/bộ', align: 'right', cell: l => `×${perManh(l)}` },
    { key: 'need', header: `Định mức (${cfg.unit})`, align: 'right', cell: l => fmt(l.needQty) },
    {
      key: 'done', header: `${cfg.done} (${cfg.unit})`, align: 'right', cell: l => {
        const short = shortOf(l)
        const pend = choKcsFor?.(l.id) ?? 0
        return <>
          {fmt(l.doneQty)}
          {pend > 0 && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--amber)' }}>chờ KCS: {fmt(pend)} {cfg.unit}</span>}
          {short > 0 && <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: 'var(--red)' }}>cần {cfg.verb} thêm {fmt(short)} {cfg.unit}</span>}
        </>
      }
    },
    ...((showThucCo ?? !phoiMode) ? [{
      key: 'thucCo', header: 'Thực có', align: 'right', cell: (l: ProcLine) => (
        <span style={{ fontWeight: 600 }}>{fmt(l.thucCoQty ?? 0)}</span>
      )
    } as BoardColumn<ProcLine>] : []),
    {
      key: 'remain', header: 'Còn lại', align: 'right', cell: l => {
        const remain = l.needQty - l.doneQty
        return <span style={{ fontWeight: 600, color: remain <= 0 ? 'var(--green)' : ACCENT }}>{fmt(Math.max(remain, 0))}</span>
      }
    },
    {
      key: 'updated', header: 'Cập nhật lúc', cell: l => {
        const stale = minutesSince(l.lastInputAt) >= REMIND_MINUTES
        return l.lastInputAt
          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: stale ? 'var(--amber)' : 'var(--text3)' }}><Clock size={12} /> {timeVN(l.lastInputAt)}</span>
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
        key: 'input', header: `Nhập số ${cfg.unit} vừa ${cfg.verb}`, width: 220, cell: (l: ProcLine) => {
          const pend = choKcsFor?.(l.id) ?? 0
          const remain = l.needQty - l.doneQty - pend
          if (remain <= 0) return <span className="badge green">{pend > 0 ? 'chờ KCS duyệt' : 'đủ định mức'}</span>
          return (
            <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
              <input
                type="number" min={0} max={remain} placeholder={`tối đa ${fmt(remain)}`} value={draft[l.id] ?? ''}
                onChange={e => {
                  const val = e.target.value
                  if (val === '') return setDraft(d => ({ ...d, [l.id]: '' }))
                  let n = Math.floor(Number(val))
                  if (isNaN(n)) return
                  if (n < 0) n = 0
                  if (n > remain) n = remain
                  setDraft(d => ({ ...d, [l.id]: String(n) }))
                }}
                onKeyDown={e => { if (e.key === 'Enter') submit(l) }}
                style={{ width: 110 }}
              />
              <button className="primary" onClick={() => submit(l)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', fontSize: 12 }}>
                <Plus size={13} /> Ghi nhận
              </button>
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
          ? (onReport
            ? <>Nhập số <b>{cfg.unit} đã {cfg.verb}</b> theo từng {itemLabelLC} → chuyển <b>chờ KCS duyệt</b>; chỉ SL KCS đạt mới tính tiến độ.</>
            : <>Nhập số <b>{cfg.unit} đã {cfg.verb}</b> theo từng {itemLabelLC} — hệ thống tự lưu mốc thời gian.</>)
          : <>Số lượng <b>đã {cfg.verb}</b> tự cập nhật từ màn <b>Xác nhận sản lượng</b> — màn này chỉ theo dõi đồng bộ.</>}</div></>}
      beforeTable={banner}
      columns={cols}
      rows={lines}
      rowKey={l => l.id}
      rowTone={l => shortOf(l) > 0 ? 'alert' : 'default'}
      expandedRow={l => {
        if (!(l.parts && openParts.has(l.id))) return null
        const thucCoOf = (pt: ProcPart) => partStock ? partStock(pt) : (pt.thucCo ?? 0) // sync từ Phôi nếu có
        const rapDuocOf = (pt: ProcPart) => pt.perChiTiet > 0 ? Math.floor(thucCoOf(pt) / pt.perChiTiet) : 0
        const rapMin = l.parts.length ? Math.min(...l.parts.map(rapDuocOf)) : 0
        const thR2: React.CSSProperties = { ...td, fontWeight: 600, fontSize: 12, color: 'var(--text2)' }
        return (
          <div style={{ padding: '10px 16px 14px', background: 'var(--surface2)' }}>
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
                  {l.parts!.map((pt, i) => {
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
        )
      }}
    />
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

// Bắt đầu/Kết thúc ca — dùng chung cho mọi orchestrator
type SetRows = React.Dispatch<React.SetStateAction<ProcRow[]>>
const caActions = (setRows: SetRows) => ({
  startPo: (id: number) => setRows(rs => rs.map(r => r.id !== id ? r : { ...r, startedAt: new Date().toISOString(), cutAtStart: totalCut(r), lastSession: null })),
  endPo: (id: number) => setRows(rs => rs.map(r => {
    if (r.id !== id || !r.startedAt) return r
    return { ...r, lastSession: { from: r.startedAt, to: new Date().toISOString(), cut: totalCut(r) - (r.cutAtStart ?? 0) }, startedAt: null, cutAtStart: null }
  })),
})

// ── Orchestrator: Phôi (3 tầng) ────────────────────────────────────
// "Đã cắt" của mỗi dòng = base(seed) + Σ cây các đợt ĐÃ XÁC NHẬN (DA_CAT) theo lineId.
// Xác nhận sản lượng làm ở màn riêng "Xác nhận sản lượng"; màn này chỉ theo dõi đồng bộ.
export function PhoiScreen({ cfg, rows, setRows, readOnly = false }: {
  cfg: StageCfg
  rows: ProcRow[]
  setRows: React.Dispatch<React.SetStateAction<ProcRow[]>>
  readOnly?: boolean
}) {
  const [selPoId, setSelPoId] = useState<number | null>(null)
  const [selManhId, setSelManhId] = useState<number | null>(null)
  const { startPo, endPo } = caActions(setRows)
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
  return <PoListBoard rows={view} cfg={cfg} isPhoi onEnter={id => { setSelPoId(id); setSelManhId(null) }} onStart={startPo} onEnd={endPo} />
}

// ── Nguồn dữ liệu thật cho Hàn/Sơn (đợt 2, thay hanSeed()/sonSeed()) ────────────────
// listProductionOrdersForStage() rồi getProductionBatchPlan() từng PO — cả 2 đã aggregate sẵn
// plannedQty/awaitingQcQty/passedQty theo MẢNH (Piece, không còn Part - xem
// ProductionBatchesService.getBatchPlan() ở BE), không cần tự cộng dồn từ batches như bản mock cũ.
// Bỏ hẳn tính năng "xem thanh sắt cấu thành" (ProcPart/partStock, đồng bộ tồn đoạn từ Phôi) — dữ
// liệu này chỉ tồn tại ở mock/seed; BE nay đã có segment-level BOM theo mảnh thật (PieceBom, cùng
// bảng Phôi dùng), nhưng nối lại tính năng này vẫn ngoài phạm vi lần đổi Part->Piece này.
interface HanSonFetch { rows: ProcRow[]; awaitingByLine: Map<number, number> }

async function fetchHanSonRows(stage: SanLuongStage): Promise<HanSonFetch> {
  const orders: BeProductionOrderSummary[] = await api.listProductionOrdersForStage()
  const settled = await Promise.all(orders.map(async o => {
    try { return { o, plan: await api.getProductionBatchPlan(o.id, stage) } }
    catch { return null }
  }))

  const rows: ProcRow[] = []
  const awaitingByLine = new Map<number, number>()
  for (const s of settled) {
    if (!s) continue
    const { o, plan } = s
    const lines: ProcLine[] = plan.items.map(item => {
      const lineId = Number(item.pieceId)
      awaitingByLine.set(lineId, item.awaitingQcQty)
      return {
        id: lineId, itemName: item.pieceName, spec: item.pieceCode,
        needQty: item.plannedQty, doneQty: item.passedQty,
        lastInputAt: null, realPieceId: item.pieceId,
      }
    })
    rows.push({
      // arrangedAt: không null - "chủ chuyền sắp xếp" là bước riêng của mock, không có gì tương
      // ứng ở BE; PO thật xuất hiện trong danh sách nghĩa là đã sẵn sàng để báo sản lượng.
      id: Number(o.id), poNumber: plan.salesOrderCode ?? '—', sku: plan.productName, productName: plan.productName,
      soLuong: plan.quantity, deadline: '—', arrangedAt: new Date().toISOString(), lines, realOrderId: o.id,
    })
  }
  return { rows, awaitingByLine }
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
    () => stage ? fetchHanSonRows(stage) : Promise.resolve({ rows: [], awaitingByLine: new Map() }), [stage])

  // "Bắt đầu/Kết thúc ca" luôn là overlay cục bộ, không persist ở BE (kể cả bản mock cũ) — merge
  // đè lên dữ liệu vừa fetch, giữ nguyên session đang chạy của đúng PO qua các lần refetch.
  const [rows, setRows] = useState<ProcRow[]>(() => seed?.() ?? [])
  useEffect(() => {
    if (!stage) return
    const next = fetched?.rows ?? []
    setRows(prev => next.map(r => {
      const old = prev.find(p => p.id === r.id)
      return old ? { ...r, startedAt: old.startedAt, cutAtStart: old.cutAtStart, lastSession: old.lastSession } : r
    }))
  }, [fetched, stage])

  const [selPoId, setSelPoId] = useState<number | null>(null)
  const { startPo, endPo } = caActions(setRows)

  // done đã có sẵn trong ProcLine.doneQty (từ passedQty của plan) — chỉ còn chờ-KCS cần map riêng.
  const awaitingByLine = fetched?.awaitingByLine ?? new Map<number, number>()

  const selPo = rows.find(r => r.id === selPoId) ?? null

  const updateLineFlat = (poId: number, ul: ProcLine) =>
    setRows(rs => rs.map(r => r.id !== poId ? r : { ...r, lines: r.lines?.map(l => l.id === ul.id ? ul : l) }))

  const report = async (po: ProcRow, line: ProcLine, qty: number) => {
    if (!stage || !po.realOrderId || !line.realPieceId) return
    await api.reportProductionBatch(po.realOrderId, { stage, pieceId: line.realPieceId, reportedQty: qty })
    refetch()
  }

  if (selPo) {
    return <VatTuDetailBoard
      lines={selPo.lines ?? []} cfg={cfg} readOnly={readOnly}
      title={`${selPo.poNumber} · ${selPo.sku}`}
      subtitle={`${selPo.productName} · SL ${fmt(selPo.soLuong)} · hạn ${dateVN(selPo.deadline)}`}
      bannerLabel="Đồng bộ" backLabel="Quay lại danh sách lệnh"
      onBack={() => setSelPoId(null)}
      onUpdateLine={stage ? undefined : l => updateLineFlat(selPo.id, l)}
      onReport={stage && !readOnly ? (l, qty) => report(selPo, l, qty) : undefined}
      choKcsFor={stage ? (id => awaitingByLine.get(id) ?? 0) : undefined}
      showThucCo={stage ? false : undefined}
      manualInput
    />
  }
  return <PoListBoard rows={rows} cfg={cfg} isPhoi={false} sequential={!stage} onEnter={id => setSelPoId(id)} onStart={startPo} onEnd={endPo} />
}

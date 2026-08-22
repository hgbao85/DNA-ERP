import { useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Factory, PackageCheck, Search, ShoppingCart, Wrench, type LucideIcon } from 'lucide-react'
import { useFetch } from '../../../hooks/useFetch'
import * as api from '../../../services/api'
import { useInspection, type PurchaseProposal } from '../../../context/InspectionContext'
import type { Sku } from '../../../types/sku'
import LenhSanXuatBoard, { type BoardColumn } from '../../../components/sanxuat/LenhSanXuatBoard'
import { VatTuDetailBoard, PHOI_CFG, HAN_CFG, SON_CFG, perSku, lechOf, type ProcManh, type ProcLine, type StageCfg } from '../../../components/sanxuat/core'
import type { ManhLine } from '../../../types/manh'
import ManhSkuDetail from '../InboundWarehouse/ManhSkuDetail'
import type { MockPiece } from '../../../lib/mock/chuyen-kiem-fixtures'
import { tabBtn, btnSecondary } from '../../../styles/buttons'
import ProgressBar from '../../../components/ProgressBar'
import { resolveProductionOrderId, buildProductionOrderInfoByMfgProduct, type ProductionOrderInfo } from '../../../services/production-invoice-item'
import type { BeSteelIssue } from '../../../services/steel-issues-api'
import type { BeProductionBatchPlan } from '../../../services/production-batches-api'

// ─── Types ───────────────────────────────────────────────────────────────────

type OrderStatus = 'PRODUCING' | 'DONE'
type MfgStage = 'PURCHASING' | 'FRAME' | 'WEAVING' | 'CHUYEN_KIEM' | 'PACKAGING'
type SubStatus = 'done' | 'in-progress' | 'pending'

interface MaterialItem {
  name: string
  ncc: string
  unitPrice: number
  qty: number      // Tổng SL
  unit: string
  boughtQty: number // Đã mua
}

// Công đoạn Đan dùng chung cấu trúc ManhLine/ManhAllocation + component ManhSkuDetail với "Theo dõi
// xuất đan" (khovttp@demo.com) và "Theo dõi nhập đan" (khotp@demo.com) — xem StageDetailCard.
// BE weaving-points không có field `name` riêng — `code` đóng vai trò tên/định danh chính.
interface WeavingPointLite { id: number; code: string; fullName?: string }

interface StageDetails {
  purchasing: { materials: MaterialItem[] }
  frame: {
    phoi: SubStatus; han: SubStatus; son: SubStatus
    // Dữ liệu chi tiết từng công đoạn nhỏ — cùng cấu trúc ProcManh/ProcLine dùng ở màn
    // Lệnh sản xuất Phôi/Hàn/Sơn, để hiển thị lại y hệt cho KHSX xem (xem FrameSubStages).
    phoiManhs: ProcManh[]
    hanLines: ProcLine[]
    sonLines: ProcLine[]
  }
  weaving: { nhapDan: SubStatus; xuatDan: SubStatus; lines: ManhLine[]; skuQty: number }
  // Chuyền kiểm/Đóng gói đọc thật qua getTransferCheckPieces()/getPackaging() — cùng nguồn 2 trang
  // Chuyền kiểm/Đóng gói thật của thủ kho thành phẩm (khotp@demo.com) — xem ChuyenKiemContent/PackagingContent.
  chuyenKiem: { daKiem: SubStatus; pieces: (MockPiece & { daKiemQty: number })[] }
  packaging: { dongGoi: SubStatus; totalBoxes: number; daDongQty: number }
}

interface MfgOrder {
  id: string
  code: string        // Mã PO — lấy từ exportOrder.poNumber (dữ liệu thật)
  piCode: string       // Mã PI — 1 SKU trong 1 PO chỉ có đúng 1 PI (xem skus.service.ts)
  sku: string
  productName: string
  customer: string
  deadline?: string
  approvedAt: string
  status: OrderStatus
  mfgStage?: MfgStage
  hasVariance: boolean // lệch định mức ở công đoạn Khung cơ khí (Phôi/Hàn/Sơn) — xem phoiStageStats/aggLineStats
}

// ─── Stage config ─────────────────────────────────────────────────────────────

const MFG_STAGES: { key: MfgStage; label: string; icon: React.ReactNode }[] = [
  { key: 'PURCHASING',  label: 'Mua hàng',     icon: <ShoppingCart size={16} /> },
  { key: 'FRAME',       label: 'Khung cơ khí', icon: <Wrench size={16} /> },
  { key: 'WEAVING',     label: 'Đan',          icon: <Factory size={16} /> },
  { key: 'CHUYEN_KIEM', label: 'Chuyền kiểm',  icon: <ClipboardCheck size={16} /> },
  { key: 'PACKAGING',   label: 'Đóng gói',     icon: <PackageCheck size={16} /> },
]

// Icon riêng cho MfgStageTracker (size nhỏ hơn để vừa vòng tròn 22px) — dùng component thay vì
// element đã dựng sẵn ở MFG_STAGES.icon để tự chọn size khi render.
const STAGE_TRACKER_ICONS: Record<MfgStage, LucideIcon> = {
  PURCHASING: ShoppingCart,
  FRAME: Wrench,
  WEAVING: Factory,
  CHUYEN_KIEM: ClipboardCheck,
  PACKAGING: PackageCheck,
}

// ─── Dữ liệu thật: Sku + PurchaseProposal ───────────────────────────────
// "Danh sách" và "Nội dung mua hàng" đọc trực tiếp từ Sku/PurchaseProposal thật
// (giống TheoDoiMuaHangPage.tsx). Khung cơ khí/Đan/Chuyền kiểm/Đóng gói cũng đã thật —
// xem fetchFrame/fetchWeaving/fetchChuyenKiem/fetchPackaging bên dưới.

function getPurchasingRows(pf: Sku, proposals: PurchaseProposal[]): MaterialItem[] {
  return proposals
    // NOTE: p.skuId là placeholder không liên quan gì tới Sku.id thật (xem comment đầu
    // purchasing-api.ts) — so sánh này gần như không bao giờ khớp, giữ nguyên hành vi cũ (chỉ sửa
    // kiểu cho biên dịch được), không phải bug do lần sửa kiểu id này gây ra.
    .filter(p => String(p.skuId) === pf.id)
    .flatMap(p => p.items.map(item => {
      // Key theo materialId (KHÔNG phải item.name) - 2 vật tư khác nhau có thể trùng tên hiển
      // thị, xem purchasing-api.ts D.p6-quote-key-collision.
      const key = String(item.materialId)
      const ncc = p.chosenSuppliers?.[key] ?? ''
      const offers = p.quotes?.[key] ?? []
      const chosenQuote = offers.find(q => q.supplierName === ncc) ?? offers[0]
      return {
        name: item.name,
        ncc: ncc || (chosenQuote?.supplierName ?? '—'),
        unitPrice: chosenQuote?.unitPrice ?? 0,
        qty: item.buyQty,
        unit: item.unit,
        boughtQty: item.receivedQty ?? 0,
      }
    }))
}

function getPurchasingPercent(materials: MaterialItem[]): number {
  if (materials.length === 0) return 100 // không có gì cần mua → coi như xong bước mua hàng
  const w = (m: MaterialItem) => m.qty <= 0 ? 0 : Math.min(1, m.boughtQty / m.qty)
  return Math.round(materials.reduce((s, m) => s + w(m), 0) / materials.length * 100)
}

// ─── Dữ liệu chi tiết Khung cơ khí/Đan/Chuyền kiểm/Đóng gói: API thật ─────────
// Tới 2026-08-19 4 công đoạn này sinh bằng hash giả ổn định theo PO vì "chưa có nguồn dữ liệu
// tổng hợp thật" — nay sai: steel-issues/production-batches/weaving-issues/transfer-check/
// packaging đều đã có endpoint thật nhận đúng 1 Sku (qua productionInvoiceId có sẵn trên Sku, hoặc
// productionOrderId resolve qua resolveProductionOrderId() — cùng cách weaving-issues-api.ts dùng).
// Đổi N+1 fetch/PO lấy dữ liệu thật, thay vì chờ 1 endpoint tổng hợp (chưa có, ngoài phạm vi).

function subStatusOf(need: number, done: number): SubStatus {
  if (need <= 0 || done <= 0) return 'pending'
  return done >= need ? 'done' : 'in-progress'
}

function lineTotals(lines: ProcLine[]): { need: number; done: number } {
  return { need: lines.reduce((s, l) => s + l.needQty, 0), done: lines.reduce((s, l) => s + l.doneQty, 0) }
}

// Phôi: gộp SteelIssue theo materialCode (đúng cách XuatSatPage đã gộp lại theo PI, 2026-08-19) —
// 1 material = 1 "mảnh" giả trong UI, mỗi đợt xuất sắt là 1 dòng con.
function mapSteelIssuesToPhoiManhs(steelIssues: BeSteelIssue[]): ProcManh[] {
  const byMaterial = new Map<string, BeSteelIssue[]>()
  for (const si of steelIssues) {
    const arr = byMaterial.get(si.materialCode) ?? []
    arr.push(si)
    byMaterial.set(si.materialCode, arr)
  }
  return Array.from(byMaterial.values()).map((issues, mi) => ({
    id: mi + 1,
    tenManh: issues[0].materialName,
    perSku: 1,
    lines: issues.map((si, li) => ({
      id: mi * 1000 + li,
      itemName: si.materialCode,
      spec: `Ø${si.barLengthMm}mm`,
      needQty: si.barCount,
      doneQty: si.actualBarCount ?? (si.status === 'QC_PASSED' ? si.barCount : 0),
      perManh: 1,
      lastInputAt: si.completedAt,
    })),
  }))
}

function mapBatchPlanToLines(plan: BeProductionBatchPlan | null): ProcLine[] {
  return (plan?.items ?? []).map(item => ({
    id: Number(item.pieceId),
    itemName: item.pieceName,
    spec: item.pieceCode,
    needQty: item.plannedQty,
    doneQty: item.passedQty,
    lastInputAt: null,
  }))
}

// productionInvoiceId PHẢI là PI thật (suy từ ProductionOrder qua buildProductionOrderInfoByMfgProduct()),
// KHÔNG phải pf.productionInvoiceId tĩnh (H6 fix) - field đó không tự cập nhật khi PI item bị gộp
// sang PI khác (chỉ productionInvoiceItem.productionInvoiceId đổi, planForm giữ nguyên), khiến màn
// này hiện sai mã PI và "chưa xuất sắt" dù sắt đã thực xuất dưới PI gộp.
async function fetchFrame(productionInvoiceId: string | null, orderId: string | null): Promise<StageDetails['frame']> {
  const [steelIssues, hanPlan, sonPlan] = await Promise.all([
    productionInvoiceId ? api.getSteelIssuesForInvoice(productionInvoiceId) : Promise.resolve([]),
    orderId ? api.getProductionBatchPlan(orderId, 'HAN') : Promise.resolve(null),
    orderId ? api.getProductionBatchPlan(orderId, 'SON') : Promise.resolve(null),
  ])
  const phoiManhs = mapSteelIssuesToPhoiManhs(steelIssues)
  const hanLines = mapBatchPlanToLines(hanPlan)
  const sonLines = mapBatchPlanToLines(sonPlan)
  const phoi: SubStatus = steelIssues.length === 0 ? 'pending' : steelIssues.every(si => si.status === 'QC_PASSED') ? 'done' : 'in-progress'
  const hanTotals = lineTotals(hanLines)
  const sonTotals = lineTotals(sonLines)
  return {
    phoi, han: subStatusOf(hanTotals.need, hanTotals.done), son: subStatusOf(sonTotals.need, sonTotals.done),
    phoiManhs, hanLines, sonLines,
  }
}

// Đan: dùng nguyên component thật ManhSkuDetail (đã dùng cho 2 màn thủ kho thật) — chỉ đổi nguồn
// dữ liệu nạp vào từ mock sang getWeavingIssuePlan() thật.
async function fetchWeaving(pf: Sku, skuQty: number): Promise<StageDetails['weaving']> {
  const items = await api.getWeavingIssuePlan(pf)
  const lines: ManhLine[] = items.map(it => ({
    id: Number(it.pieceId),
    name: it.pieceName,
    unit: 'cái',
    totalQty: it.totalQty,
    tonThuc: it.remainingToIssue,
    allocations: it.allocations.map((a, ai) => ({
      id: Number(it.pieceId) * 1000 + ai,
      weavingPointId: Number(a.weavingPointId),
      xuatQty: a.issuedQty,
      nhapQty: a.receivedQty,
    })),
  }))
  const totalQty = items.reduce((s, it) => s + it.totalQty, 0)
  const issuedQty = items.reduce((s, it) => s + it.issuedQty, 0)
  const receivedQty = items.reduce((s, it) => s + it.allocations.reduce((a, x) => a + x.receivedQty, 0), 0)
  return { xuatDan: subStatusOf(totalQty, issuedQty), nhapDan: subStatusOf(issuedQty, receivedQty), lines, skuQty }
}

// Chuyền kiểm: readyQty ("chờ thực thi") là luỹ kế SUM(WeavingReceipt.qty), KHÔNG trừ phần đã kiểm
// (xem transfer-check-api.ts) — "chờ thực thi hiện tại" = readyQty - checkedQty, khớp đúng ý nghĩa
// cột "Chờ thực thi" của ChuyenKiemContent bên dưới (remaining = totalQty - choThucThi - daKiemQty).
async function fetchChuyenKiem(pf: Sku): Promise<StageDetails['chuyenKiem']> {
  const pieces = await api.getTransferCheckPieces(pf)
  const mapped = pieces.map(p => ({
    id: p.pieceId, name: p.pieceName, totalQty: p.totalQty,
    choThucThi: Math.max(0, p.readyQty - p.checkedQty),
    daKiemQty: p.checkedQty,
  }))
  const totalQty = pieces.reduce((s, p) => s + p.totalQty, 0)
  const checkedQty = pieces.reduce((s, p) => s + p.checkedQty, 0)
  return { daKiem: subStatusOf(totalQty, checkedQty), pieces: mapped }
}

async function fetchPackaging(pf: Sku): Promise<StageDetails['packaging']> {
  const progress = await api.getPackaging(pf)
  return { dongGoi: subStatusOf(progress.totalQty, progress.packedQty), totalBoxes: progress.totalQty, daDongQty: progress.packedQty }
}

function emptyExecutionStages(skuQty: number): Pick<StageDetails, 'frame' | 'weaving' | 'chuyenKiem' | 'packaging'> {
  return {
    frame: { phoi: 'pending', han: 'pending', son: 'pending', phoiManhs: [], hanLines: [], sonLines: [] },
    weaving: { nhapDan: 'pending', xuatDan: 'pending', lines: [], skuQty },
    chuyenKiem: { daKiem: 'pending', pieces: [] },
    packaging: { dongGoi: 'pending', totalBoxes: 0, daDongQty: 0 },
  }
}

async function fetchExecutionStages(pf: Sku, skuQty: number, poInfo: ProductionOrderInfo | undefined): Promise<Pick<StageDetails, 'frame' | 'weaving' | 'chuyenKiem' | 'packaging'>> {
  const orderId = await resolveProductionOrderId(pf)
  const [frame, weaving, chuyenKiem, packaging] = await Promise.all([
    fetchFrame(poInfo?.productionInvoiceId ?? pf.productionInvoiceId ?? null, orderId),
    fetchWeaving(pf, skuQty),
    fetchChuyenKiem(pf),
    fetchPackaging(pf),
  ])
  return { frame, weaving, chuyenKiem, packaging }
}

async function buildOrderRow(pf: Sku, proposals: PurchaseProposal[], skuQty: number, poInfo: ProductionOrderInfo | undefined): Promise<{ order: MfgOrder; details: StageDetails }> {
  const materials = getPurchasingRows(pf, proposals)
  const purchPct = getPurchasingPercent(materials)
  const { frame, weaving, chuyenKiem, packaging } = purchPct >= 100 ? await fetchExecutionStages(pf, skuQty, poInfo) : emptyExecutionStages(skuQty)
  const details: StageDetails = { purchasing: { materials }, frame, weaving, chuyenKiem, packaging }
  const done = isAllDone(details)
  const hasVariance = phoiStageStats(frame.phoiManhs).lech || aggLineStats(frame.hanLines).lech || aggLineStats(frame.sonLines).lech
  const order: MfgOrder = {
    id: pf.id,
    code: pf.exportOrder?.poNumber ?? 'Chưa gắn đơn hàng',
    // PI thật từ ProductionOrder (H6 fix) - poInfo.piCode, KHÔNG phải pf.piCode tĩnh (xem comment
    // ở fetchFrame). Fallback pf.piCode chỉ cho trường hợp chưa resolve được (PO chưa duyệt).
    piCode: poInfo?.piCode ?? pf.piCode,
    sku: pf.mfgProduct?.factoryCode ?? '—',
    productName: pf.mfgProduct?.name ?? '',
    customer: pf.customerName ?? '—',
    deadline: pf.exportOrder?.deliveryDate,
    approvedAt: pf.createdAt,
    status: done ? 'DONE' : 'PRODUCING',
    mfgStage: done ? undefined : (purchPct < 100 ? 'PURCHASING' : 'FRAME'),
    hasVariance,
  }
  return { order, details }
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<OrderStatus, { label: string; bg: string; color: string; border: string }> = {
  PRODUCING: { label: 'Đang sản xuất', bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber)' },
  DONE:      { label: 'Hoàn thành',    bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green)' },
}

// Đơn lệnh quá hạn khi có deadline, đã qua hạn, và chưa hoàn thành — dùng chung cho bảng danh sách + trang chi tiết
// để tránh 2 cài đặt độc lập của cùng 1 quy tắc nghiệp vụ lệch nhau.
function isOrderOverdue(deadline: string | undefined, isDone: boolean): boolean {
  return !!deadline && new Date(deadline) < new Date() && !isDone
}

const th: React.CSSProperties = { padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--surface2)', textAlign: 'left', whiteSpace: 'nowrap' }
const td: React.CSSProperties = { padding: '11px 14px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'middle' }

type FilterStatus = 'all' | OrderStatus
const PAGE_SIZE = 20

// ─── Stage detail sub-components ──────────────────────────────────────────────

// Bố cục cột giống trang "Theo dõi mua hàng" (account mua hàng) — xem TheoDoiMuaHangPage.tsx.
// Hạn giao lấy chung từ deadline của lệnh SX (sync từ KHSX), không lưu riêng theo từng vật tư.
function PurchasingContent({ materials, deadline }: { materials: MaterialItem[]; deadline?: string }) {
  const thS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }
  if (materials.length === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa có đề xuất mua vật tư nào cho lệnh này</div>
  }
  return (
    <div>
    {deadline && (
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
        Hạn giao vật tư: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{format(new Date(deadline), 'dd/MM/yyyy')}</span>
      </div>
    )}
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thS}>Tên vật tư</th>
          <th style={thS}>NCC</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đơn giá</th>
          <th style={{ ...thS, textAlign: 'right' }}>Tổng SL</th>
          <th style={thS}>ĐVT</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đã mua</th>
          <th style={{ ...thS, textAlign: 'right' }}>Còn lại</th>
        </tr>
      </thead>
      <tbody>
        {materials.map((m, i) => {
          const remaining = Math.max(0, m.qty - m.boughtQty)
          return (
            <tr key={i}>
              <td style={{ ...tdS, fontWeight: 600 }}>{m.name}</td>
              <td style={tdS}>{m.ncc}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{m.unitPrice ? m.unitPrice.toLocaleString('vi-VN') + 'đ' : '—'}</td>
              <td style={{ ...tdS, textAlign: 'right' }}>{m.qty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, color: 'var(--text3)' }}>{m.unit}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: m.boughtQty > 0 ? '#16a34a' : 'var(--text3)' }}>{m.boughtQty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>{remaining.toLocaleString('vi-VN')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
    </div>
  )
}

// Bảng mảnh chờ kiểm/đã kiểm — cùng cột với trang Chuyền kiểm thật của thủ kho thành phẩm
// (khotp@demo.com), chỉ xem (không có nút "Kiểm").
function ChuyenKiemContent({ chuyenKiem }: { chuyenKiem: StageDetails['chuyenKiem'] }) {
  const thS: React.CSSProperties = { padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap' }
  const tdS: React.CSSProperties = { padding: '7px 10px', fontSize: 12, borderBottom: '1px solid var(--border)' }
  if (chuyenKiem.pieces.length === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa tới lượt kiểm — đợi công đoạn Đan hoàn tất</div>
  }
  return (
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={thS}>Mảnh</th>
          <th style={{ ...thS, textAlign: 'right' }}>Chờ thực thi</th>
          <th style={{ ...thS, textAlign: 'right' }}>Đã kiểm</th>
          <th style={{ ...thS, textAlign: 'right' }}>Còn lại</th>
        </tr>
      </thead>
      <tbody>
        {chuyenKiem.pieces.map(p => {
          const remaining = Math.max(0, p.totalQty - p.choThucThi - p.daKiemQty)
          return (
            <tr key={p.id}>
              <td style={{ ...tdS, fontWeight: 600 }}>{p.name}</td>
              <td style={{ ...tdS, textAlign: 'right', color: 'var(--text3)' }}>{p.choThucThi.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: p.daKiemQty > 0 ? '#16a34a' : 'var(--text3)' }}>{p.daKiemQty.toLocaleString('vi-VN')}</td>
              <td style={{ ...tdS, textAlign: 'right', fontWeight: 700, color: remaining > 0 ? '#d97706' : '#16a34a' }}>{remaining.toLocaleString('vi-VN')}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}

// 3 số tổng thùng — cùng số liệu với trang Đóng gói thật của thủ kho thành phẩm, chỉ xem.
function PackagingContent({ packaging }: { packaging: StageDetails['packaging'] }) {
  if (packaging.totalBoxes === 0) {
    return <div style={{ padding: '10px 4px', fontSize: 12, color: 'var(--text3)' }}>Chưa tới lượt đóng gói — đợi công đoạn Chuyền kiểm hoàn tất</div>
  }
  const remaining = Math.max(0, packaging.totalBoxes - packaging.daDongQty)
  const stats: { label: string; value: number; color: string }[] = [
    { label: 'Tổng thùng',   value: packaging.totalBoxes, color: 'var(--text)' },
    { label: 'Đã đóng gói',  value: packaging.daDongQty,  color: packaging.daDongQty > 0 ? '#16a34a' : 'var(--text3)' },
    { label: 'Còn lại',      value: remaining,             color: remaining > 0 ? '#d97706' : '#16a34a' },
  ]
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {stats.map(s => (
        <div key={s.label} style={{ flex: '1 1 140px', minWidth: 140, border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{s.label}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value.toLocaleString('vi-VN')}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Khung cơ khí: 3 tab con Phôi/Hàn/Sơn ─────────────────────────────────────
// Nhúng lại đúng bảng chi tiết (VatTuDetailBoard) dùng ở màn Lệnh sản xuất của phoi@/han@/son@demo.com,
// ở chế độ chỉ xem (không có cột nhập/xác nhận) — để KHSX xem được thông tin chi tiết như 3 account đó.

type FrameSubTab = 'PHOI' | 'HAN' | 'SON'

// Thời điểm nhập gần nhất trong 1 tập dòng vật tư — dùng để KHSX biết dữ liệu còn "nóng" hay không.
function latestInputAt(lines: ProcLine[]): string | null {
  return lines.reduce<string | null>((latest, l) => (l.lastInputAt && (!latest || l.lastInputAt > latest)) ? l.lastInputAt : latest, null)
}

function timeAgo(iso: string | null): string {
  return iso ? formatDistanceToNow(new Date(iso), { addSuffix: true, locale: vi }) : 'chưa cập nhật'
}

interface StageLineStats { need: number; done: number; pct: number; lech: boolean; lastInputAt: string | null }

function aggLineStats(lines: ProcLine[]): StageLineStats {
  const need = lines.reduce((s, l) => s + l.needQty, 0)
  const done = lines.reduce((s, l) => s + l.doneQty, 0)
  return { need, done, pct: need > 0 ? Math.round(done / need * 100) : 0, lech: lechOf(lines), lastInputAt: latestInputAt(lines) }
}

// Phôi không đồng bộ theo cả lệnh (mỗi mảnh dùng loại sắt riêng, không so sánh chéo được — xem
// PoListBoard trong core.tsx): % tính trên tổng cây (gộp mọi mảnh) nhưng lệch xét riêng từng mảnh
// (có ít nhất 1 mảnh tự lệch giữa các loại sắt của chính nó). Hàn/Sơn dùng chung 1 tập vật tư cho
// cả lệnh nên so sánh trực tiếp trên toàn bộ dòng (xem aggLineStats).
function phoiStageStats(manhs: ProcManh[]): StageLineStats {
  const lines = manhs.flatMap(m => m.lines)
  const need = lines.reduce((s, l) => s + l.needQty, 0)
  const done = lines.reduce((s, l) => s + l.doneQty, 0)
  return { need, done, pct: need > 0 ? Math.round(done / need * 100) : 0, lech: manhs.some(m => lechOf(m.lines)), lastInputAt: latestInputAt(lines) }
}

// ─── Tab chuyển Phôi/Hàn/Sơn ──────────────────────────────────────────────────
// Trước đây là 3 card to (viền + progress bar + mô tả riêng từng thẻ) — trùng lặp với thanh tiến độ
// tổng ở trên. Giờ chỉ còn 1 hàng tab gọn (icon + nhãn + % + cờ lệch định mức nếu có), giống hệt
// pattern tab công đoạn chính (tabBtn) để nhất quán trong toàn trang.
function FrameStageTab({ cfg, stats, active, onClick }: {
  cfg: StageCfg; stats: StageLineStats; active: boolean; onClick: () => void
}) {
  const Icon = cfg.Icon
  const accent = stats.lech ? 'var(--red)' : stats.pct >= 100 ? 'var(--green)' : stats.pct > 0 ? 'var(--amber)' : 'var(--text3)'
  return (
    <button
      onClick={onClick}
      title={stats.lech ? `${cfg.label}: vật tư chưa cân đối — bấm để xem chi tiết` : `Xem chi tiết công đoạn ${cfg.label}`}
      style={tabBtn(active, accent)}
    >
      <Icon size={14} /> {cfg.label}
      {stats.lech && <AlertTriangle size={12} />}
      <span>{stats.pct}%</span>
    </button>
  )
}

// Chi tiết từng loại sắt hiện thẳng dưới mỗi mảnh (dùng expandedRow của LenhSanXuatBoard) —
// KHSX xem được ngay, khỏi phải bấm vào từng dòng như trước.
function PhoiManhMiniBoard({ manhs }: { manhs: ProcManh[] }) {
  const views = manhs.map(m => {
    const tong = m.lines.reduce((s, l) => s + l.needQty, 0)
    const done = m.lines.reduce((s, l) => s + l.doneQty, 0)
    return { m, tong, done, remain: Math.max(0, tong - done), lech: lechOf(m.lines), lastInputAt: latestInputAt(m.lines) }
  })
  const cols: BoardColumn<typeof views[number]>[] = [
    { key: 'manh', header: 'Mảnh', cell: v => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
        {v.lech && <AlertTriangle size={13} color="var(--red)" />}
        {v.m.tenManh}
      </span>
    ) },
    { key: 'perSku', header: 'SL/SKU', align: 'right', cell: v => `×${perSku(v.m)}` },
    { key: 'tong', header: 'Định mức (cây)', align: 'right', cell: v => v.tong.toLocaleString('vi-VN') },
    { key: 'done', header: 'Đã cắt (cây)', align: 'right', cell: v => <span style={{ fontWeight: 700 }}>{v.done.toLocaleString('vi-VN')}</span> },
    { key: 'remain', header: 'Còn lại (cây)', align: 'right', cell: v => <span style={{ color: v.remain > 0 ? 'var(--amber)' : 'var(--green)', fontWeight: 600 }}>{v.remain.toLocaleString('vi-VN')}</span> },
    { key: 'updated', header: 'Cập nhật', cell: v => <span style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(v.lastInputAt)}</span> },
  ]
  return (
    <LenhSanXuatBoard
      title="Danh sách mảnh" subtitle="Chi tiết từng loại sắt hiện sẵn bên dưới mỗi mảnh — mảnh có ⚠ đang lệch định mức giữa các loại sắt, cần kiểm tra"
      columns={cols} rows={views} rowKey={v => v.m.id}
      rowTone={v => v.lech ? 'alert' : 'default'}
      expandedRow={v => (
        <div style={{ padding: '4px 14px 16px', background: 'var(--surface2)' }}>
          <VatTuDetailBoard
            lines={v.m.lines} cfg={PHOI_CFG} readOnly showThucCo={false}
            title={v.m.tenManh} subtitle="Chi tiết từng loại sắt của mảnh — chỉ xem"
            bannerLabel="Đồng bộ sắt" dbUnit="mảnh"
          />
        </div>
      )}
    />
  )
}

function FrameSubStages({ frame }: { frame: StageDetails['frame'] }) {
  const [tab, setTab] = useState<FrameSubTab>('PHOI')

  const tabs: { key: FrameSubTab; cfg: StageCfg; stats: StageLineStats }[] = [
    { key: 'PHOI', cfg: PHOI_CFG, stats: phoiStageStats(frame.phoiManhs) },
    { key: 'HAN',  cfg: HAN_CFG,  stats: aggLineStats(frame.hanLines) },
    { key: 'SON',  cfg: SON_CFG,  stats: aggLineStats(frame.sonLines) },
  ]
  const activeTab = tabs.find(t => t.key === tab)!

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        {tabs.map(t => (
          <FrameStageTab key={t.key} cfg={t.cfg} stats={t.stats} active={tab === t.key} onClick={() => setTab(t.key)} />
        ))}
      </div>

      {activeTab.stats.lech && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 12 }}>
          <AlertTriangle size={13} /> {activeTab.cfg.label}: vật tư chưa cân đối, cần kiểm tra
        </div>
      )}

      {tab === 'PHOI' && (
        <PhoiManhMiniBoard manhs={frame.phoiManhs} />
      )}
      {tab === 'HAN' && (
        <VatTuDetailBoard
          lines={frame.hanLines} cfg={HAN_CFG} readOnly
          title="Chi tiết hàn khung" subtitle="Tiến độ hàn ráp theo từng mảnh — chỉ xem"
          bannerLabel="Đồng bộ"
        />
      )}
      {tab === 'SON' && (
        <VatTuDetailBoard
          lines={frame.sonLines} cfg={SON_CFG} readOnly
          title="Chi tiết sơn phủ" subtitle="Tiến độ sơn theo loại sơn — chỉ xem"
          bannerLabel="Đồng bộ"
        />
      )}
    </div>
  )
}

// ─── Đan: chỉ hiện "Nhập đan" ──────────────────────────────────────────────────
// Dùng lại đúng component ManhSkuDetail (chế độ 'view') như "Theo dõi xuất đan"/"Theo dõi nhập đan"
// bên kho — đã lược bỏ 2 cấp PO/SKU vì đã ở đúng 1 lệnh. Không hiện "Xuất đan" riêng — chỉ "Nhập
// đan" là đủ để KHSX theo dõi công đoạn Đan.
function WeavingSubStages({ weaving, pointLabel }: { weaving: StageDetails['weaving']; pointLabel: (id: number) => string }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Thống kê đan</span>
      </div>
      <ManhSkuDetail lines={weaving.lines} skuQty={weaving.skuQty} pointLabel={pointLabel} variant="view" />
    </div>
  )
}

// ─── Parallel stage helpers ───────────────────────────────────────────────────

const PARALLEL_STAGE_KEYS = new Set<MfgStage>(['FRAME', 'WEAVING', 'CHUYEN_KIEM', 'PACKAGING'])

function getStagePercent(key: MfgStage, details: StageDetails): number {
  const w = (s: SubStatus) => s === 'done' ? 1 : s === 'in-progress' ? 0.5 : 0
  if (key === 'FRAME')       return Math.round((w(details.frame.phoi) + w(details.frame.han) + w(details.frame.son)) / 3 * 100)
  if (key === 'WEAVING')     return Math.round((w(details.weaving.nhapDan) + w(details.weaving.xuatDan)) / 2 * 100)
  if (key === 'CHUYEN_KIEM') return Math.round(w(details.chuyenKiem.daKiem) * 100)
  if (key === 'PACKAGING')   return Math.round(w(details.packaging.dongGoi) * 100)
  return 0
}

function isAllDone(details: StageDetails): boolean {
  return (
    details.frame.phoi === 'done' && details.frame.han === 'done' && details.frame.son === 'done' &&
    details.weaving.nhapDan === 'done' && details.weaving.xuatDan === 'done' &&
    details.chuyenKiem.daKiem === 'done' &&
    details.packaging.dongGoi === 'done'
  )
}

// Công đoạn song song (Frame/Weaving/ChuyenKiem/Packaging) đang là "điểm nghẽn" hiện tại của lệnh —
// công đoạn đầu tiên (theo thứ tự MFG_STAGES) có % > 0 và < 100; nếu không có công đoạn nào dở dang
// thì trả về công đoạn cuối cùng đã có tiến độ (đã xong, công đoạn kế tiếp chưa bắt đầu).
function getCurrentParallelStage(details: StageDetails): { stage: MfgStage; pct: number } | null {
  let last: { stage: MfgStage; pct: number } | null = null
  for (const s of MFG_STAGES) {
    if (!PARALLEL_STAGE_KEYS.has(s.key)) continue
    const pct = getStagePercent(s.key, details)
    if (pct > 0) last = { stage: s.key, pct }
    if (pct > 0 && pct < 100) return { stage: s.key, pct }
  }
  return last
}

// Dùng cho cột "Công đoạn hiện tại" ở bảng danh sách — 1 nhãn + % duy nhất thay vì 2 cột
// Trạng thái/Tiến độ tách rời như trước.
function currentStageLabel(order: MfgOrder, details: StageDetails): { label: string; icon: React.ReactNode; pct: number } {
  if (order.status === 'DONE') return { label: 'Hoàn thành', icon: <CheckCircle2 size={14} />, pct: 100 }
  if (order.mfgStage === 'PURCHASING') {
    const stage = MFG_STAGES.find(s => s.key === 'PURCHASING')!
    return { label: stage.label, icon: stage.icon, pct: getPurchasingPercent(details.purchasing.materials) }
  }
  const active = getCurrentParallelStage(details)
  const stage = MFG_STAGES.find(s => s.key === (active?.stage ?? 'FRAME'))!
  return { label: stage.label, icon: stage.icon, pct: active?.pct ?? 0 }
}

// ─── Stage detail card ────────────────────────────────────────────────────────

function StageDetailCard({
  stage,
  isActive,
  details,
  orderDeadline,
  pointLabel,
}: {
  stage: typeof MFG_STAGES[number]
  isActive: boolean
  details: StageDetails
  orderDeadline?: string
  pointLabel: (id: number) => string
}) {
  const statusColor = isActive ? 'var(--amber)' : 'var(--green)'

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)' }}>
          {stage.icon}
          <span style={{ fontSize: 13, fontWeight: 700 }}>{stage.label}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor }}>
          {isActive
            ? PARALLEL_STAGE_KEYS.has(stage.key) ? `${getStagePercent(stage.key, details)}%` : 'Đang thực hiện'
            : 'Hoàn thành'}
        </span>
      </div>

      <div style={{ padding: '12px 16px', background: 'var(--surface)' }}>
        {stage.key === 'PURCHASING' && (
          <PurchasingContent materials={details.purchasing.materials} deadline={orderDeadline} />
        )}
        {stage.key === 'FRAME' && (
          <FrameSubStages frame={details.frame} />
        )}
        {stage.key === 'WEAVING' && (
          <WeavingSubStages weaving={details.weaving} pointLabel={pointLabel} />
        )}
        {stage.key === 'CHUYEN_KIEM' && (
          <ChuyenKiemContent chuyenKiem={details.chuyenKiem} />
        )}
        {stage.key === 'PACKAGING' && (
          <PackagingContent packaging={details.packaging} />
        )}
      </div>
    </div>
  )
}

// ─── Progress tracker ─────────────────────────────────────────────────────────

// Tracker vừa hiển thị tiến độ vừa đóng vai trò "filter" chọn công đoạn xem chi tiết (thay cho
// dãy tab riêng "Chi tiết từng công đoạn" trước đây) — bấm vào 1 công đoạn đã tới (có trong
// reachedStages) để chuyển selectedStage. Công đoạn đang chọn không dùng thêm màu nào (tránh
// đụng ngữ nghĩa xanh lá/cam/xám của trạng thái) — chỉ to hơn + đổ bóng nhẹ để nổi lên.
function MfgStageTracker({
  currentStage,
  allDone = false,
  stagePercents,
  reachedStages,
  selectedStage,
  onSelectStage,
}: {
  currentStage?: MfgStage
  allDone?: boolean
  stagePercents?: Partial<Record<MfgStage, number>>
  reachedStages?: Set<MfgStage>
  selectedStage?: MfgStage | null
  onSelectStage?: (stage: MfgStage) => void
}) {
  const currentIdx = allDone
    ? MFG_STAGES.length
    : currentStage
      ? MFG_STAGES.findIndex(s => s.key === currentStage)
      : -1

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {MFG_STAGES.map((stage, idx) => {
        const pct        = stagePercents?.[stage.key]
        const done        = allDone || (pct !== undefined ? pct >= 100 : idx < currentIdx)
        const active      = !done && (pct !== undefined ? pct > 0 : idx === currentIdx)
        const clickable   = !!onSelectStage && !!reachedStages?.has(stage.key)
        const isSelected  = selectedStage === stage.key
        // Không dùng thêm màu nào — vòng tròn giữ nguyên màu trạng thái (xanh lá/cam/xám).
        // Bước đang chọn "nổi" lên bằng transform: scale + đổ bóng, KHÔNG đổi width/height thật
        // (transform không chiếm thêm chỗ trong layout) — tránh làm dịch layout các bước còn lại
        // khi alignItems:'center' của hàng cha canh lại theo chiều cao (từng bị lỗi khi đổi
        // width/height trực tiếp).
        const color       = done ? 'var(--green)' : active ? 'var(--amber)' : 'var(--border)'
        const Icon        = STAGE_TRACKER_ICONS[stage.key]

        return (
          <div key={stage.key} style={{ display: 'flex', alignItems: 'center', flex: idx < MFG_STAGES.length - 1 ? '1 1 0' : undefined }}>
            <div
              onClick={clickable ? () => onSelectStage!(stage.key) : undefined}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 64, cursor: clickable ? 'pointer' : 'default' }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: color, color: done || active ? '#fff' : 'var(--text3)',
                transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                boxShadow: isSelected ? '0 3px 8px rgba(0,0,0,0.28)' : undefined,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}>
                {done ? <CheckCircle2 size={13} /> : <Icon size={13} />}
              </div>
              <div style={{ fontSize: 11, fontWeight: active || isSelected ? 700 : 600, color: active ? 'var(--amber)' : done ? 'var(--text2)' : 'var(--text3)', whiteSpace: 'nowrap' }}>
                {stage.label}{active && pct !== undefined && PARALLEL_STAGE_KEYS.has(stage.key) ? ` · ${pct}%` : ''}
              </div>
            </div>
            {idx < MFG_STAGES.length - 1 && (
              <div style={{ flex: 1, height: 2, marginBottom: 18, background: done ? 'var(--green)' : 'var(--border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Detail page ──────────────────────────────────────────────────────────────

function ThongKeDetailPage({ order, details, onBack, pointLabel }: { order: MfgOrder; details: StageDetails; onBack: () => void; pointLabel: (id: number) => string }) {
  const allDone   = isAllDone(details)
  const isDone    = order.status === 'DONE' || allDone
  const isOverdue = isOrderOverdue(order.deadline, isDone)
  const meta      = STATUS_META[isDone ? 'DONE' : 'PRODUCING']

  // Stage cards to show
  const reachedCards: { stage: typeof MFG_STAGES[number]; isActive: boolean }[] = []

  if (isDone) {
    MFG_STAGES.forEach(stage => reachedCards.push({ stage, isActive: false }))
  } else if (order.status === 'PRODUCING' && order.mfgStage) {
    if (PARALLEL_STAGE_KEYS.has(order.mfgStage)) {
      reachedCards.push({ stage: MFG_STAGES.find(s => s.key === 'PURCHASING')!, isActive: false })
      for (const stage of MFG_STAGES) {
        if (!PARALLEL_STAGE_KEYS.has(stage.key)) continue
        const pct = getStagePercent(stage.key, details)
        if (pct > 0) reachedCards.push({ stage, isActive: pct < 100 })
      }
    } else {
      const currentIdx = MFG_STAGES.findIndex(s => s.key === order.mfgStage)
      MFG_STAGES.forEach((stage, idx) => {
        if (idx <= currentIdx) reachedCards.push({ stage, isActive: idx === currentIdx })
      })
    }
  }

  // Luôn đúng 1 công đoạn được xem chi tiết tại một thời điểm (thay vì xếp chồng mọi card công đoạn
  // đã tới, có thể rất dài khi PO đã Hoàn thành) — chọn bằng cách bấm thẳng vào công đoạn đã tới trên
  // thanh "Trạng thái sản xuất" (MfgStageTracker), không còn dãy tab riêng bên dưới. Mặc định chọn
  // công đoạn đang thực hiện; nếu đã xong hết thì mặc định chọn công đoạn cuối cùng.
  const [selectedStage, setSelectedStage] = useState<MfgStage | null>(
    reachedCards.find(c => c.isActive)?.stage.key ?? reachedCards[reachedCards.length - 1]?.stage.key ?? null,
  )
  const selectedCard = reachedCards.find(c => c.stage.key === selectedStage) ?? null
  const reachedStages = new Set(reachedCards.map(c => c.stage.key))

  const stagePercents: Partial<Record<MfgStage, number>> | undefined =
    order.mfgStage && PARALLEL_STAGE_KEYS.has(order.mfgStage)
      ? {
          FRAME:       getStagePercent('FRAME',       details),
          WEAVING:     getStagePercent('WEAVING',     details),
          CHUYEN_KIEM: getStagePercent('CHUYEN_KIEM', details),
          PACKAGING:   getStagePercent('PACKAGING',   details),
        }
      : undefined

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}
        >
          <ArrowLeft size={15} />
          Quay lại danh sách
        </button>
        <span style={{ color: 'var(--text3)', fontSize: 13 }}>/</span>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>Chi tiết lệnh</span>
      </div>

      {/* Header card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 24px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: '#1d4ed8', letterSpacing: '0.02em' }}>{order.code}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>PI: {order.piCode}</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 6 }}>{order.productName}</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>Mã xưởng: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{order.sku}</span></div>
          </div>
          <span style={{ display: 'inline-block', padding: '5px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 28px', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text3)' }}>
          <span>Khách hàng: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{order.customer}</span></span>
          <span>Ngày tạo: <span style={{ fontWeight: 600, color: 'var(--text)' }}>{format(new Date(order.approvedAt), 'dd/MM/yyyy')}</span></span>
          <span>
            Hạn giao: <span style={{ fontWeight: 600, color: isOverdue ? '#dc2626' : 'var(--text)' }}>
              {order.deadline ? format(new Date(order.deadline), 'dd/MM/yyyy') : '—'}{isOverdue ? ' · Quá hạn' : ''}
            </span>
          </span>
        </div>
      </div>

      {/* Production status */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 24px', marginBottom: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Trạng thái sản xuất</div>

        {isDone
          ? <MfgStageTracker allDone reachedStages={reachedStages} selectedStage={selectedStage} onSelectStage={setSelectedStage} />
          : <MfgStageTracker currentStage={order.mfgStage} stagePercents={stagePercents} reachedStages={reachedStages} selectedStage={selectedStage} onSelectStage={setSelectedStage} />}

        {selectedCard && (
          <div style={{ marginTop: 20 }}>
            <StageDetailCard stage={selectedCard.stage} isActive={selectedCard.isActive} details={details} orderDeadline={order.deadline} pointLabel={pointLabel} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── List page ────────────────────────────────────────────────────────────────

// Trạng thái lệnh sản xuất (PI) tối thiểu cần để quyết định 1 SKU đã "vào sản xuất" hay còn "lên kế
// hoạch".
interface PIApprovalItem { prodApproval?: { status?: string }; quantity?: number }
interface PIStatusRow { id: string; status: string; items?: PIApprovalItem[] }

export default function ThongKePagePlan() {
  const { data: skusData, isLoading } = useFetch<Sku[]>(() => api.getSkus(), [])
  const { data: pisData } = useFetch<PIStatusRow[]>(() => api.getProductionInvoices(), [])
  const { data: weavingPointsData } = useFetch<WeavingPointLite[]>(() => (api as any).getWeavingPoints(), [])
  // PI thật theo mfgProductId, suy từ ProductionOrder (H6 fix) - PHẢI dùng thay pf.piCode/
  // pf.productionInvoiceId tĩnh, xem comment ở fetchFrame/buildOrderRow.
  const { data: poInfoData } = useFetch<Map<string, ProductionOrderInfo>>(() => buildProductionOrderInfoByMfgProduct(), [])
  // Memo hoá - `poInfoData` giữ nguyên `null` khi fetch lỗi (vd 403 do thiếu quyền
  // PRODUCTION_ORDER:VIEW), nếu không memo thì mỗi render tạo Map MỚI, khiến effect bên dưới (nhận
  // poInfoMap làm dep) chạy lại vô hạn -> gọi lại API vô hạn -> đơ tab (phát hiện qua browser thật
  // 2026-08-22, Sếp bấm "Tổng hợp lệnh SX" bị đơ + hàng nghìn lỗi fetch trong console).
  const poInfoMap = useMemo(() => poInfoData ?? new Map<string, ProductionOrderInfo>(), [poInfoData])
  const { proposals } = useInspection()
  const piMap = useMemo(() => new Map((pisData ?? []).map(p => [p.id, p])), [pisData])
  // Lên kế hoạch (PLANNING) chưa vào sản xuất — ẩn khỏi "Bảng thống kê", trừ khi đã có SKU được
  // duyệt (đã thật sự bắt đầu sản xuất dù pi.status còn PLANNING).
  const skus = useMemo(() => (skusData ?? []).filter(pf => {
    if (pf.status === 'DRAFT') return false
    const pi = pf.productionInvoiceId != null ? piMap.get(pf.productionInvoiceId) : undefined
    if (!pi) return false
    const hasApprovedItem = (pi.items ?? []).some(it => it.prodApproval?.status === 'APPROVED')
    return pi.status !== 'PLANNING' || hasApprovedItem
  }), [skusData, piMap])
  const weavingPoints = useMemo(() => weavingPointsData ?? [], [weavingPointsData])
  const pointLabel = (id: number) => {
    const p = weavingPoints.find(w => w.id === id)
    return p?.fullName ? `${p.code} (${p.fullName})` : (p?.code ?? `#${id}`)
  }

  // buildOrderRow giờ gọi API thật (N+1 theo từng PO: steel-issues/production-batch-plan/
  // weaving-issue-plan/transfer-check/packaging) — không còn tính đồng bộ được, phải qua useFetch.
  const { data: orderRowsData, isLoading: rowsLoading } = useFetch(
    () => Promise.all(skus.map(pf => {
      const pi = pf.productionInvoiceId != null ? piMap.get(pf.productionInvoiceId) : undefined
      const skuQty = pi?.items?.[0]?.quantity ?? 0
      return buildOrderRow(pf, proposals, skuQty, poInfoMap.get(pf.mfgProductId))
    })),
    [skus, proposals, piMap, poInfoMap],
  )
  const orderRows = orderRowsData ?? []

  const [filter, setFilter]         = useState<FilterStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(1)

  const q = search.trim().toLowerCase()
  const filtered = orderRows
    .filter(({ order }) => filter === 'all' || order.status === filter)
    .filter(({ order }) => !q || [order.code, order.sku, order.productName, order.customer].some(v => v.toLowerCase().includes(q)))

  const counts = {
    all:       orderRows.length,
    PRODUCING: orderRows.filter(({ order }) => order.status === 'PRODUCING').length,
    DONE:      orderRows.filter(({ order }) => order.status === 'DONE').length,
    OVERDUE:   orderRows.filter(({ order }) => isOrderOverdue(order.deadline, order.status === 'DONE')).length,
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageSafe  = Math.min(page, pageCount)
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)

  const selectedRow = selectedId != null ? orderRows.find(({ order }) => order.id === selectedId) ?? null : null
  if (selectedRow) {
    return <ThongKeDetailPage order={selectedRow.order} details={selectedRow.details} onBack={() => setSelectedId(null)} pointLabel={pointLabel} />
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Bảng thống kê</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Tổng {counts.all} · Đang sản xuất {counts.PRODUCING} · Hoàn thành {counts.DONE}
          {counts.OVERDUE > 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}> · ⚠ Quá hạn {counts.OVERDUE}</span>}
        </p>
      </div>

      {/* Filter + Search */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([['all', 'Tất cả'], ['PRODUCING', 'Đang sản xuất'], ['DONE', 'Hoàn thành']] as [FilterStatus, string][]).map(([key, label]) => (
            <button key={key} onClick={() => { setFilter(key); setPage(1) }}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 20, border: 'none', cursor: 'pointer',
                background: filter === key ? '#1d4ed8' : 'var(--surface2)',
                color: filter === key ? '#fff' : 'var(--text)',
              }}>
              {label} <span style={{ opacity: 0.75 }}>({key === 'all' ? counts.all : counts[key as OrderStatus]})</span>
            </button>
          ))}
        </div>
        <div style={{ position: 'relative', width: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Tìm mã PO, SKU, sản phẩm, khách hàng..."
            style={{ width: '100%', paddingLeft: 32, paddingRight: 10, paddingTop: 6, paddingBottom: 6, fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th}>Mã PI</th>
              <th style={th}>Mã PO</th>
              <th style={th}>SKU / Sản phẩm</th>
              <th style={th}>Khách hàng</th>
              <th style={{ ...th, width: 220 }}>Công đoạn hiện tại</th>
              <th style={th}>Hạn giao</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading || rowsLoading) ? (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</td></tr>
            ) : pageItems.map(({ order: o, details }) => {
              const isDone     = o.status === 'DONE'
              const isOverdue  = isOrderOverdue(o.deadline, isDone)
              const stageInfo  = currentStageLabel(o, details)
              return (
                <tr
                  key={o.id}
                  onClick={() => setSelectedId(o.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(o.id) } }}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface2)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '' }}
                >
                  <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700 }}>{o.piCode}</td>
                  <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text2)' }}>{o.code}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>{o.productName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{o.sku}</div>
                  </td>
                  <td style={{ ...td, color: 'var(--text2)' }}>{o.customer}</td>
                  <td style={{ ...td, width: 220 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                      {stageInfo.icon} {stageInfo.label}
                      {o.hasVariance && <AlertTriangle size={12} color="var(--red)" />}
                    </div>
                    <ProgressBar value={stageInfo.pct} max={100} />
                  </td>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: isOverdue ? '#dc2626' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                    {o.deadline ? format(new Date(o.deadline), 'dd/MM/yyyy') : '—'}
                    {isOverdue && <div style={{ fontSize: 11, color: '#dc2626' }}>Quá hạn</div>}
                  </td>
                </tr>
              )
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
                  Không có lệnh nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
          <span>Hiển thị {pageItems.length}/{filtered.length} dòng</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={pageSafe <= 1}
              style={{ ...btnSecondary, padding: '5px 8px', display: 'flex', opacity: pageSafe <= 1 ? 0.5 : 1, cursor: pageSafe <= 1 ? 'default' : 'pointer' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span>Trang {pageSafe}/{pageCount}</span>
            <button
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={pageSafe >= pageCount}
              style={{ ...btnSecondary, padding: '5px 8px', display: 'flex', opacity: pageSafe >= pageCount ? 0.5 : 1, cursor: pageSafe >= pageCount ? 'default' : 'pointer' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

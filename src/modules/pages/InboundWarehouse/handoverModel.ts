/**
 * Logic thuần của "Giao nhận giữa tổ" phía kho (24/11/2026, docs THIET-KE-GIAO-NHAN-GIUA-TO): kho Phôi giao đoạn cho Hàn / Sơn,
 * kho Hàn (xưởng có kho Sơn) giao mảnh đã hàn cho Sơn - đều qua phiếu XK. Không đụng React để test riêng.
 */
import type { IssueSlipLine, IssueSlipLineInput, IssueSlipLineKind } from '../../../services/issue-slips-api'
import type { FramePlanRow, HandoverStage, SegmentPlanRow } from '../../../services/stage-handover-api'
import { FIXED_WAREHOUSES, warehouseKindOf } from '../../../utils/warehouseKinds'

export const HANDOVER_STAGE_LABEL: Record<HandoverStage, string> = { HAN: 'Hàn', SON: 'Sơn' }

export const HANDOVER_KINDS: readonly IssueSlipLineKind[] = ['SEGMENT_HANDOVER', 'FRAME_HANDOVER']
export const isHandoverKind = (k: IssueSlipLineKind): boolean => HANDOVER_KINDS.includes(k)

const round4 = (n: number) => Math.round(n * 1e4) / 1e4 + 0

/** Kho Hàn của xưởng có kho Sơn (Phú An) mới giao mảnh cho Sơn bằng phiếu; Hàn Phước An vẫn dùng phiếu chuyển kho như cũ. */
export function hanWarehouseHasPaint(scope: string | null | undefined): boolean {
  if (!scope || warehouseKindOf(scope) !== 'HAN') return false
  const workshop = FIXED_WAREHOUSES[scope]?.workshop ?? null
  if (!workshop) return false
  return Object.values(FIXED_WAREHOUSES).some(w => w.kind === 'SON' && w.workshop === workshop)
}

// ─── Kho Phôi: giao đoạn ─────────────────────────────────────────────────────

/** 1 dòng bảng "Giao đoạn cho Hàn": 1 mã đoạn × 1 tổ nhận (mảnh không qua Hàn dùng đoạn ở Sơn). */
export interface SegmentHandoverRow {
  /** Khoá ô nhập: `${segmentSpecId}|${segmentSteps}|${stage}`. */
  key: string
  /** Khoá mã đoạn (2 tổ cùng 1 mã đoạn dùng chung 1 ô tồn). */
  codeKey: string
  row: SegmentPlanRow
  stage: HandoverStage
  /** Tổ này cần bao nhiêu đoạn của mã này. */
  requiredQty: number
  /** Đã giao cho tổ này (phiếu đã xuất). */
  handedOverQty: number
  /** Đang trên phiếu chờ ký cho tổ này. */
  draftQty: number
}

export const segmentCodeKey = (segmentSpecId: string, segmentSteps: string) => `${segmentSpecId}|${segmentSteps}`

/** Tách mỗi mã đoạn theo tổ nhận. Mã đoạn chưa có tổ nào (dữ liệu thiếu) coi như của Hàn. */
export function segmentHandoverRows(rows: readonly SegmentPlanRow[]): SegmentHandoverRow[] {
  const out: SegmentHandoverRow[] = []
  for (const row of rows) {
    const codeKey = segmentCodeKey(row.segmentSpecId, row.segmentSteps)
    const stages = row.stages.length > 0
      ? row.stages
      : [{ stage: 'HAN' as const, requiredQty: row.requiredQty, handedOverQty: row.handedOverQty, draftQty: row.draftQty }]
    for (const s of stages) {
      out.push({
        key: `${codeKey}|${s.stage}`, codeKey, row, stage: s.stage,
        requiredQty: s.requiredQty, handedOverQty: s.handedOverQty, draftQty: s.draftQty,
      })
    }
  }
  return out
}

/** Còn phải giao cho tổ (cần − đã giao − chờ ký), không âm. */
export const segmentStillNeeded = (r: Pick<SegmentHandoverRow, 'requiredQty' | 'handedOverQty' | 'draftQty'>): number =>
  Math.max(0, round4(r.requiredQty - r.handedOverQty - r.draftQty))

/**
 * Giao được tối đa ở dòng này = giao được của mã đoạn (BE: còn giữ + dư − chờ ký) − số đang gõ ở dòng tổ khác cùng mã đoạn.
 * Làm tròn xuống số nguyên (BE chỉ nhận số đoạn nguyên).
 */
export function segmentRowMax(
  r: SegmentHandoverRow,
  all: readonly SegmentHandoverRow[],
  qty: Readonly<Record<string, string>>,
): number {
  const others = all
    .filter(o => o.codeKey === r.codeKey && o.key !== r.key)
    .reduce((t, o) => t + parseQty(qty[o.key]), 0)
  return Math.max(0, Math.floor(r.row.availableQty - others + 1e-9))
}

/**
 * Số mặc định của ô "Giao lần này" (khoá dòng -> số): số còn phải giao của tổ, không quá số giao được. 2 tổ cùng 1 mã đoạn chia
 * chung số giao được (dòng trước lấy trước) để số mặc định không tự báo lỗi.
 */
export function segmentDefaults(rows: readonly SegmentHandoverRow[]): Record<string, number> {
  const left = new Map<string, number>()
  const out: Record<string, number> = {}
  for (const r of rows) {
    const avail = left.get(r.codeKey) ?? Math.max(0, Math.floor(r.row.availableQty + 1e-9))
    const n = Math.max(0, Math.min(avail, Math.ceil(segmentStillNeeded(r) - 1e-9)))
    out[r.key] = n
    left.set(r.codeKey, avail - n)
  }
  return out
}

// ─── Kho Hàn: giao mảnh cho Sơn ──────────────────────────────────────────────

export const frameRowKey = (r: Pick<FramePlanRow, 'productionOrderId' | 'pieceId'>) => `${r.productionOrderId}|${r.pieceId}`

/** Còn phải giao cho Sơn (cần − đã giao − chờ ký), không âm. */
export const frameStillNeeded = (r: Pick<FramePlanRow, 'requiredQty' | 'handedOverQty' | 'draftQty'>): number =>
  Math.max(0, round4(r.requiredQty - r.handedOverQty - r.draftQty))

/**
 * Giao được tối đa ở dòng mảnh: tồn mảnh ở kho Hàn tính chung mọi lệnh / SKU cùng mảnh (BE: tồn − chờ ký), nên trừ số đang gõ ở
 * các dòng khác cùng mảnh.
 */
export function frameRowMax(
  r: FramePlanRow,
  all: readonly FramePlanRow[],
  qty: Readonly<Record<string, string>>,
): number {
  const others = all
    .filter(o => o.pieceId === r.pieceId && frameRowKey(o) !== frameRowKey(r))
    .reduce((t, o) => t + parseQty(qty[frameRowKey(o)]), 0)
  return Math.max(0, Math.floor(r.availableQty - others + 1e-9))
}

/** Số mặc định của ô mảnh: còn phải giao, không quá tồn; các SKU cùng mảnh chia chung tồn (dòng trước lấy trước). */
export function frameDefaults(rows: readonly FramePlanRow[]): Record<string, number> {
  const left = new Map<string, number>()
  const out: Record<string, number> = {}
  for (const r of rows) {
    const avail = left.get(r.pieceId) ?? Math.max(0, Math.floor(r.availableQty + 1e-9))
    const n = Math.max(0, Math.min(avail, Math.ceil(frameStillNeeded(r) - 1e-9)))
    out[frameRowKey(r)] = n
    left.set(r.pieceId, avail - n)
  }
  return out
}

/** Số đang ở ô nhập: chưa gõ gì thì dùng số mặc định. */
export function effectiveQty(qty: Readonly<Record<string, string>>, defaults: Readonly<Record<string, number>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(defaults)) out[k] = qty[k] ?? String(v)
  for (const [k, v] of Object.entries(qty)) out[k] = v
  return out
}

// ─── Ô nhập ──────────────────────────────────────────────────────────────────

/** Chỉ số nguyên (số đoạn / số mảnh). */
export const qtyDigits = (raw: string) => raw.replace(/\D/g, '').slice(0, 6)

export function parseQty(raw: string | undefined): number {
  if (!raw) return 0
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Lỗi đỏ ngay dưới ô nhập; null = hợp lệ. */
export function qtyError(n: number, max: number, unit: 'đoạn' | 'mảnh'): string | null {
  if (n <= 0) return null
  if (max <= 0) return `Kho không còn ${unit} để giao`
  if (n > max) return `Chỉ giao được tối đa ${max} ${unit}`
  return null
}

// ─── Dòng phiếu đang lập ─────────────────────────────────────────────────────

/** Dòng giỏ "Phiếu đang lập" (cùng dạng CartLine, chưa có key). */
export interface HandoverCartLine extends IssueSlipLineInput {
  materialName: string
  unit: string
  lenhLabel: string
}

export function buildSegmentCartLine(
  pi: { productionInvoiceId: string; lenhCode: string },
  r: SegmentHandoverRow,
  qty: number,
): HandoverCartLine {
  return {
    kind: 'SEGMENT_HANDOVER',
    productionInvoiceId: pi.productionInvoiceId,
    segmentSpecId: r.row.segmentSpecId,
    segmentSteps: r.row.segmentSteps,
    stage: r.stage,
    qty,
    materialName: r.row.label,
    unit: 'đoạn',
    lenhLabel: pi.lenhCode,
  }
}

export function buildFrameCartLine(pi: { lenhCode: string }, r: FramePlanRow, qty: number): HandoverCartLine {
  return {
    kind: 'FRAME_HANDOVER',
    productionOrderId: r.productionOrderId,
    pieceId: r.pieceId,
    stage: 'SON',
    qty,
    materialName: r.pieceCode ? `${r.pieceName} (${r.pieceCode})` : r.pieceName,
    unit: 'mảnh',
    lenhLabel: r.sku ? `${pi.lenhCode} · ${r.sku}` : pi.lenhCode,
  }
}

/**
 * Khoá gộp của giỏ cho dòng giao: BE không cho 1 phiếu 2 dòng cùng (lệnh, mã đoạn) - kể cả khác tổ nhận - hay cùng (SKU, mảnh).
 * null = không phải dòng giao (giỏ dùng khoá cũ).
 */
export function handoverCartKey(l: Pick<IssueSlipLineInput, 'kind' | 'productionInvoiceId' | 'productionOrderId' | 'pieceId' | 'segmentSpecId' | 'segmentSteps'>): string | null {
  if (l.kind === 'SEGMENT_HANDOVER') return ['SEGMENT_HANDOVER', l.productionInvoiceId ?? '', l.segmentSpecId ?? '', l.segmentSteps ?? ''].join('|')
  if (l.kind === 'FRAME_HANDOVER') return ['FRAME_HANDOVER', l.productionOrderId ?? '', l.pieceId ?? ''].join('|')
  return null
}

/**
 * Mã đoạn đã nằm trên phiếu đang lập cho TỔ KHÁC: thêm vào sẽ thay mất dòng kia (1 phiếu chỉ 1 dòng / mã đoạn của lệnh).
 * Trả câu báo lỗi; null = thêm được.
 */
export function segmentCartConflict(
  cart: readonly Pick<IssueSlipLineInput, 'kind' | 'productionInvoiceId' | 'segmentSpecId' | 'segmentSteps' | 'stage' | 'productionOrderId' | 'pieceId'>[],
  line: HandoverCartLine,
): string | null {
  const key = handoverCartKey(line)
  if (!key || line.kind !== 'SEGMENT_HANDOVER') return null
  const other = cart.find(c => handoverCartKey(c) === key && c.stage !== line.stage)
  if (!other) return null
  const st = other.stage ? HANDOVER_STAGE_LABEL[other.stage] : ''
  return `Mã đoạn này của lệnh đã có trên phiếu đang lập cho tổ ${st} - mỗi phiếu chỉ 1 dòng / mã đoạn. Tạo phiếu đó trước rồi thêm tiếp.`
}

// ─── Phiếu xuất: nhãn ────────────────────────────────────────────────────────

const KIND_LABEL: Record<IssueSlipLineKind, string> = {
  STEEL: 'Sắt', CONSUMABLE: 'Tiêu hao', SHARED: 'Dùng chung', WEAVING_PIECE: 'Mảnh đan', WEAVING_MATERIAL: 'Kèm đan', PACKAGING: 'Đóng gói',
  MATERIAL_YIELD: 'Vật tư TP', MATERIAL_YIELD_RECIPE: 'Vật tư TP', SEGMENT_HANDOVER: 'Giao', FRAME_HANDOVER: 'Giao',
}

/** Cột "Loại" của dòng phiếu: "Tiêu hao Hàn", "Giao Hàn", "Giao Sơn"… */
export function slipKindLabel(kind: IssueSlipLineKind, stage: 'HAN' | 'SON' | null | undefined): string {
  if (kind === 'FRAME_HANDOVER') return 'Giao Sơn'
  const base = KIND_LABEL[kind] ?? kind
  return stage ? `${base} ${HANDOVER_STAGE_LABEL[stage]}` : base
}

/** Tổ nhận của các dòng giao trên phiếu (theo thứ tự Hàn, Sơn). */
type KindStage = { kind: IssueSlipLineKind; stage?: HandoverStage | null }

export function handoverStagesOf(lines: readonly KindStage[]): HandoverStage[] {
  const set = new Set<HandoverStage>()
  for (const l of lines) {
    if (l.kind === 'FRAME_HANDOVER') set.add('SON')
    else if (l.kind === 'SEGMENT_HANDOVER' && l.stage) set.add(l.stage)
  }
  return (['HAN', 'SON'] as const).filter(s => set.has(s))
}

/** Gợi ý ô "Người nhận": phiếu có dòng giao thì ghi rõ tổ nhận ký ("Tổ Hàn – <tên>"). */
export function recipientPlaceholder(lines: readonly KindStage[]): string {
  const stages = handoverStagesOf(lines)
  if (stages.length === 0) return 'Người nhận (tổ / tên)'
  return `Tổ ${stages.map(s => HANDOVER_STAGE_LABEL[s]).join(' / ')} – <tên>`
}

/** Cột "Quy cách" của phiếu in cho dòng giao đoạn: "Đoạn 460mm · Dập". */
export function handoverSpecText(l: Pick<IssueSlipLine, 'kind' | 'cutLengthMm' | 'segmentLabel'>): string {
  if (l.kind !== 'SEGMENT_HANDOVER') return ''
  const steps = l.segmentLabel?.split(' · ').slice(1).join(' · ') ?? ''
  const len = l.cutLengthMm != null ? `Đoạn ${l.cutLengthMm}mm` : 'Đoạn'
  return steps ? `${len} · ${steps}` : len
}

/** Ghi chú phiếu in cho dòng giao. */
export function handoverPrintNote(l: Pick<IssueSlipLine, 'kind' | 'stage'>): string {
  if (l.kind === 'FRAME_HANDOVER') return 'Giao tổ sơn (mảnh đã hàn)'
  if (l.kind === 'SEGMENT_HANDOVER') return l.stage === 'SON' ? 'Giao tổ sơn (đoạn)' : 'Giao tổ hàn (đoạn)'
  return ''
}

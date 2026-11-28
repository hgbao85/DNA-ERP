/**
 * Logic thuần của pallet Sơn (24/11/2026, docs THIET-KE-PALLET-SON) - màn kho Sơn (tab "Pallet", Xuất đan quét pallet) và màn công
 * nhân Sơn. Không đụng React để test được.
 */
import type { IssueSlipLineInput } from '../../../services/issue-slips-api'
import type { Pallet, PalletPieceRow, PalletStatus } from '../../../services/pallets-api'

export const PALLET_STATUS_ORDER: readonly PalletStatus[] = ['EMPTY', 'LOADED', 'PAINTED', 'ON_SLIP']

export const PALLET_STATUS_LABEL: Record<PalletStatus, string> = {
  EMPTY: 'Trống',
  LOADED: 'Chờ sơn',
  PAINTED: 'Sơn xong',
  ON_SLIP: 'Trên phiếu đan',
}

/** Màu viên trạng thái (biến màu của theme). */
export const PALLET_STATUS_TONE: Record<PalletStatus, { bg: string; fg: string }> = {
  EMPTY: { bg: 'var(--surface2)', fg: 'var(--text2)' },
  LOADED: { bg: 'var(--amber-bg)', fg: 'var(--amber)' },
  PAINTED: { bg: 'var(--green-bg)', fg: 'var(--green)' },
  ON_SLIP: { bg: 'var(--blue-bg)', fg: 'var(--blue-text)' },
}

/** Câu báo khi công nhân chưa quét điểm sơn (LAST_WS_KEY rỗng) mà quét pallet. */

/** Ô nhập số: chỉ giữ chữ số, tối đa 6 ký tự. */
export const qtyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 6)

export function parseQty(v: string): number | null {
  if (!/^\d+$/.test(v.trim())) return null
  const n = Number(v)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** Lọc danh sách pallet theo trạng thái + chữ tìm (mã pallet / lệnh / SKU / mảnh). */
export function filterPallets(list: readonly Pallet[], status: PalletStatus | 'ALL', q: string): Pallet[] {
  const text = q.trim().toLowerCase()
  return list.filter((p) => {
    if (status !== 'ALL' && p.status !== status) return false
    if (!text) return true
    return [p.code, p.load?.lenhCode, p.load?.piCode, p.load?.sku, p.load?.pieceName, p.load?.pieceCode]
      .some((s) => !!s && s.toLowerCase().includes(text))
  })
}

/** Số đếm theo trạng thái (cho pill lọc) - đếm trên danh sách đang có. */
export function countByStatus(list: readonly Pallet[]): Record<PalletStatus | 'ALL', number> {
  const out: Record<PalletStatus | 'ALL', number> = { ALL: list.length, EMPTY: 0, LOADED: 0, PAINTED: 0, ON_SLIP: 0 }
  for (const p of list) out[p.status] += 1
  return out
}

// ─── Xếp pallet ────────────────────────────────────────────────────────────────

export interface LoadCheck {
  /** Lỗi chặn (không gửi được). */
  error: string | null
  /** Cảnh báo vượt sức chứa (vẫn gửi được). */
  warning: string | null
  qty: number | null
}

/** Kiểm ô "Số mảnh" khi xếp: chặn vượt "Còn xếp được" (BE kiểm lại trong khoá), cảnh báo vượt sức chứa của mảnh. */
export function checkLoad(row: Pick<PalletPieceRow, 'remainingQty' | 'capacity'> | null, palletId: string | null, qtyText: string): LoadCheck {
  const qty = parseQty(qtyText)
  if (!row) return { error: 'Chọn mảnh', warning: null, qty }
  if (!palletId) return { error: 'Chọn pallet trống', warning: null, qty }
  if (qty == null) return { error: 'Nhập số mảnh', warning: null, qty }
  if (qty > row.remainingQty) {
    return { error: `Còn xếp được tối đa ${row.remainingQty} mảnh`, warning: null, qty }
  }
  const warning = row.capacity != null && qty > row.capacity
    ? `Vượt sức chứa ${row.capacity} mảnh / pallet - kiểm lại cho chắc pallet chịu được.`
    : null
  return { error: null, warning, qty }
}

/** 4 ô số đầu bảng mảnh: Sơn đã nhận / Đã xếp pallet / Còn xếp được / Kế hoạch. */
export function loadTiles(row: PalletPieceRow): { label: string; value: string; hint?: string }[] {
  return [
    {
      label: 'Sơn đã nhận',
      value: row.receivedQty == null ? '—' : String(row.receivedQty),
      ...(row.receivedQty == null ? { hint: 'chưa bật giao nhận giữa tổ' } : {}),
    },
    { label: 'Đã xếp pallet', value: String(row.loadedQty), hint: `${row.pendingQty} đang chờ sơn` },
    { label: 'Còn xếp được', value: String(row.remainingQty) },
    { label: 'Kế hoạch', value: String(row.plannedQty), hint: `đã báo Sơn ${row.reportedQty}` },
  ]
}

// ─── Xuất đan theo pallet ─────────────────────────────────────────────────────

/** 1 dòng xuất đan dựng từ các pallet đã quét (cùng SKU + mảnh gộp 1 dòng - BE không cho 2 dòng trùng). */
export interface PalletWeavingLine {
  key: string
  productionOrderId: string
  pieceId: string
  lenhCode: string
  sku: string
  pieceName: string
  pallets: { id: string; code: string; qty: number }[]
  /** Tổng số đã sơn của các pallet = trần của dòng (chỉ sửa giảm). */
  maxQty: number
  /** Số xuất (mặc định = maxQty). */
  qty: number
}

export const weavingLineKey = (orderId: string, pieceId: string) => `${orderId}:${pieceId}`

/** Pallet quét vào phiếu đan được không - null = được, chuỗi = lý do. */
export function palletWeavingError(p: Pallet, lines: readonly PalletWeavingLine[]): string | null {
  if (lines.some((l) => l.pallets.some((x) => x.id === p.id))) return `Pallet ${p.code} đã có trong phiếu đang lập`
  if (p.status === 'ON_SLIP') {
    return `Pallet ${p.code} đang nằm trên phiếu ${p.load?.slip?.code ?? 'chờ ký'} - huỷ phiếu đó trước nếu muốn đổi`
  }
  if (p.status !== 'PAINTED' || !p.load || p.load.paintedQty == null) {
    return `Pallet ${p.code} đang ${PALLET_STATUS_LABEL[p.status]} - chỉ pallet Sơn xong mới xuất đan được`
  }
  return null
}

/** Thêm 1 pallet Sơn xong: gộp vào dòng cùng SKU + mảnh (cộng số mặc định), chưa có thì thêm dòng mới. */
export function addPalletToLines(lines: readonly PalletWeavingLine[], p: Pallet): PalletWeavingLine[] {
  const load = p.load
  if (!load || load.paintedQty == null) return [...lines]
  const key = weavingLineKey(load.productionOrderId, load.pieceId)
  const entry = { id: p.id, code: p.code, qty: load.paintedQty }
  const i = lines.findIndex((l) => l.key === key)
  if (i < 0) {
    return [...lines, {
      key, productionOrderId: load.productionOrderId, pieceId: load.pieceId, lenhCode: load.lenhCode, sku: load.sku,
      pieceName: load.pieceName, pallets: [entry], maxQty: entry.qty, qty: entry.qty,
    }]
  }
  const cur = lines[i]
  const maxQty = cur.maxQty + entry.qty
  // Đang để đủ số thì giữ đủ số; đã sửa giảm thì cộng thêm đúng số của pallet mới.
  const next = { ...cur, pallets: [...cur.pallets, entry], maxQty, qty: cur.qty + entry.qty }
  return lines.map((l, j) => (j === i ? next : l))
}

/** Bỏ 1 pallet khỏi phiếu đang lập (dòng hết pallet thì bỏ dòng); số của dòng không vượt trần mới. */
export function removePalletFromLines(lines: readonly PalletWeavingLine[], palletId: string): PalletWeavingLine[] {
  const out: PalletWeavingLine[] = []
  for (const l of lines) {
    const removed = l.pallets.find((x) => x.id === palletId)
    if (!removed) { out.push(l); continue }
    const pallets = l.pallets.filter((x) => x.id !== palletId)
    if (pallets.length === 0) continue
    const maxQty = l.maxQty - removed.qty
    out.push({ ...l, pallets, maxQty, qty: Math.min(l.qty, maxQty) })
  }
  return out
}

/** Sửa số của dòng: chỉ GIẢM (≤ tổng số trên pallet), ≥ 1. Số không hợp lệ -> giữ số cũ. */
export function setLineQty(lines: readonly PalletWeavingLine[], key: string, text: string): PalletWeavingLine[] {
  const q = parseQty(text)
  return lines.map((l) => (l.key === key && q != null ? { ...l, qty: Math.min(q, l.maxQty) } : l))
}

/** Dòng gửi BE (WEAVING_PIECE + palletIds). */
export function buildWeavingLines(lines: readonly PalletWeavingLine[]): IssueSlipLineInput[] {
  return lines.map((l) => ({
    kind: 'WEAVING_PIECE',
    productionOrderId: l.productionOrderId,
    pieceId: l.pieceId,
    qty: l.qty,
    palletIds: l.pallets.map((p) => p.id),
  }))
}

/** Lấy mã tem từ chữ gõ / link quét (link `/floor?pallet=` -> token; còn lại giữ nguyên, vd "PL-001"). */
export function palletQueryOf(text: string): string {
  const raw = text.trim()
  try {
    const u = new URL(raw)
    return u.searchParams.get('pallet')?.trim() || raw
  } catch {
    return raw.toUpperCase().startsWith('PL-') ? raw.toUpperCase() : raw
  }
}

// ─── Công nhân Sơn ─────────────────────────────────────────────────────────────

export interface ShortCheck { error: string | null; qty: number | null; reason: string }

/** "Báo thiếu": số nhỏ hơn số trên pallet (≥ 1) + lý do ≥ 3 ký tự (cùng luật BE). */
export function checkShort(loadQty: number, qtyText: string, reasonText: string): ShortCheck {
  const qty = parseQty(qtyText)
  const reason = reasonText.trim()
  if (qty == null) return { error: 'Nhập số mảnh đã sơn xong', qty, reason }
  if (qty >= loadQty) return { error: `Báo thiếu phải nhỏ hơn ${loadQty} (đủ số thì bấm "Sơn xong pallet này")`, qty, reason }
  if (reason.length < 3) return { error: 'Ghi lý do thiếu (ít nhất 3 ký tự)', qty, reason }
  return { error: null, qty, reason }
}

/** Câu trạng thái của pallet trên màn công nhân (null = báo được). */
export function workerPalletNote(p: Pallet): { tone: 'ok' | 'warn' | 'info'; text: string } | null {
  if (p.status === 'LOADED') return null
  if (p.status === 'EMPTY') return { tone: 'warn', text: `Pallet ${p.code} đang trống - chưa có hàng để báo. Báo thủ kho Sơn xếp pallet.` }
  const who = p.load?.paintedByName ? ` (${p.load.paintedByName})` : ''
  return { tone: 'ok', text: `Pallet ${p.code} đã báo Sơn xong ${p.load?.paintedQty ?? ''} mảnh${who}.`.replace('  ', ' ') }
}

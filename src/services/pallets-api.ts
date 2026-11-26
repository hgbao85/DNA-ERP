/**
 * Pallet Sơn (24/11/2026, docs THIET-KE-PALLET-SON-2026-11-24) - BE module `pallets` + 2 route công nhân ở `floor`.
 *  - Thủ kho Sơn: GET/POST /pallets (danh sách, tạo pallet), GET /pallets/load-options (lệnh + mảnh xếp được), POST
 *    /pallets/:id/load | unload, PATCH /pallets/piece-capacity, GET /pallets/lookup?q= (quét tem / gõ mã PL-001 ở Xuất đan).
 *  - Công nhân Sơn: GET /floor/pallets/:token (quét tem), POST /floor/scan/:ws/pallets/:token/paint ("Sơn xong" / "Báo thiếu").
 *  - Xuất đan: dòng WEAVING_PIECE của phiếu XK gửi kèm `palletIds` (issue-slips-api).
 * Mọi trả lời đọc có `enabled` (công tắc PALLET_SON_ENABLED của BE): false thì FE không hiện tab / nút pallet.
 */
import { http } from './core/http'

export type PalletStatus = 'EMPTY' | 'LOADED' | 'PAINTED' | 'ON_SLIP'

export interface PalletSlipRef { id: string; code: string; status: 'DRAFT' | 'ISSUED' | 'CANCELLED' }

/** 1 lượt xếp pallet (đang nằm trên pallet, hoặc lịch sử). */
export interface PalletLoad {
  id: string
  productionInvoiceId: string
  piCode: string
  lenhCode: string
  productionOrderId: string
  sku: string
  productName: string
  pieceId: string
  pieceCode: string
  pieceName: string
  qty: number
  capacity: number | null
  overCapacity: boolean
  loadedAt: string
  loadedByName: string | null
  paintedQty: number | null
  shortReason: string | null
  paintedAt: string | null
  paintedByName: string | null
  productionBatchId: string | null
  slip: PalletSlipRef | null
  clearedAt: string | null
  clearedByName: string | null
  /** 'ISSUED' (xuất đan xong) | 'UNLOADED' (thủ kho gỡ). */
  clearedReason: string | null
}

export interface Pallet {
  id: string
  code: string
  qrToken: string
  status: PalletStatus
  statusLabel: string
  warehouseCode: string
  warehouseName: string
  note: string | null
  updatedAt: string
  load: PalletLoad | null
}

export interface PalletDetail extends Pallet { history: PalletLoad[] }

export interface PalletWarehouse { id: string; code: string; name: string }

export interface PalletList {
  enabled: boolean
  warehouse: PalletWarehouse | null
  counts: Record<PalletStatus, number>
  pallets: Pallet[]
}

export interface PalletLoadPi { productionInvoiceId: string; code: string; lenhCode: string; deadline: string | null }

/** 1 (SKU, mảnh) qua Sơn của lệnh + số để xếp. */
export interface PalletPieceRow {
  productionOrderId: string
  sku: string
  productName: string
  pieceId: string
  pieceCode: string
  pieceName: string
  plannedQty: number
  /** Sơn đã nhận (giao nhận giữa tổ) - null khi BE tắt giao nhận / mảnh không có cổng nhận. */
  receivedQty: number | null
  reportedQty: number
  /** Đang chờ sơn trên pallet. */
  pendingQty: number
  /** Đã xếp pallet (mọi lượt, trừ lượt gỡ). */
  loadedQty: number
  reportableQty: number
  remainingQty: number
  capacity: number | null
}

export interface PalletLoadOptionsList {
  enabled: boolean
  handoverEnabled?: boolean
  warehouse: PalletWarehouse | null
  pis: PalletLoadPi[]
}

export interface PalletLoadOptionsDetail {
  enabled: boolean
  handoverEnabled: boolean
  warehouse: PalletWarehouse
  productionInvoiceId: string
  code: string
  lenhCode: string
  rows: PalletPieceRow[]
}

export function getPallets(params: { status?: PalletStatus; q?: string } = {}): Promise<PalletList> {
  const p = new URLSearchParams()
  if (params.status) p.set('status', params.status)
  if (params.q?.trim()) p.set('q', params.q.trim())
  const qs = p.toString()
  return http.get<PalletList>(`/pallets${qs ? `?${qs}` : ''}`)
}

export function getPallet(id: string): Promise<PalletDetail> {
  return http.get<PalletDetail>(`/pallets/${encodeURIComponent(id)}`)
}

export function lookupPallet(q: string): Promise<Pallet> {
  return http.get<Pallet>(`/pallets/lookup?q=${encodeURIComponent(q.trim())}`)
}

export function createPallets(count: number, note?: string): Promise<Pallet[]> {
  return http.post<Pallet[]>('/pallets', { count, ...(note?.trim() ? { note: note.trim() } : {}) })
}

export function getPalletLoadPis(): Promise<PalletLoadOptionsList> {
  return http.get<PalletLoadOptionsList>('/pallets/load-options')
}

export function getPalletLoadRows(productionInvoiceId: string): Promise<PalletLoadOptionsDetail> {
  return http.get<PalletLoadOptionsDetail>(`/pallets/load-options?productionInvoiceId=${encodeURIComponent(productionInvoiceId)}`)
}

export function loadPallet(id: string, input: { productionOrderId: string; pieceId: string; qty: number }) {
  return http.post<{ pallet: Pallet; warning: string | null }>(`/pallets/${encodeURIComponent(id)}/load`, input)
}

export function unloadPallet(id: string): Promise<Pallet> {
  return http.post<Pallet>(`/pallets/${encodeURIComponent(id)}/unload`)
}

export function setPieceCapacity(pieceId: string, capacity: number | null) {
  return http.patch<{ pieceId: string; capacity: number | null }>('/pallets/piece-capacity', { pieceId, capacity })
}

// ─── Công nhân Sơn ─────────────────────────────────────────────────────────────

export interface PalletWorkerView { enabled: boolean; pallet: Pallet | null }

export function getPalletForWorker(token: string): Promise<PalletWorkerView> {
  return http.get<PalletWorkerView>(`/floor/pallets/${encodeURIComponent(token)}`)
}

export interface PaintPalletResult extends PalletWorkerView {
  productionBatch: { id: string } | null
  short: boolean
}

/** `ws` = điểm sơn công nhân quét gần nhất (LAST_WS_KEY). Bỏ `qty` = đủ số trên pallet. */
export function paintPallet(
  ws: string,
  token: string,
  input: { qty?: number; shortReason?: string },
  idempotencyKey: string,
): Promise<PaintPalletResult> {
  return http.post<PaintPalletResult>(
    `/floor/scan/${encodeURIComponent(ws)}/pallets/${encodeURIComponent(token)}/paint`,
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
}

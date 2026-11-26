/**
 * Vị trí kho Thành phẩm + soạn hàng theo booking + load từng cont (25/11/2026, docs THIET-KE-VI-TRI-KHO-LOAD-CONT, V1-V9) - BE module
 * `vi-tri-kho`. HỢP ĐỒNG với BE src/modules/vi-tri-kho/*.ts - đổi 2 bên cùng lúc.
 *  - Thủ kho Thành phẩm: ô (khai 1 / hàng loạt, tắt), tồn thùng theo bộ 3, chuyển ô, cất hàng chưa có ô, lịch sử.
 *  - Công nhân đóng gói (màn /floor): GET /vi-tri-kho/floor/scan/:token (báo đóng gói vẫn qua ck-dg/scan/:ws/packing + locationId).
 *  - Thủ kho kho gom hàng: danh sách lấy hàng của booking, lấy (quét ô), trả về ô, cont (số cont, seal, ảnh, đóng / mở lại).
 * Mọi trả lời đọc có `enabled` (công tắc VI_TRI_KHO_ENABLED của BE): false thì FE không hiện gì mới. Số lượng tính theo BỘ.
 */
import { http } from './core/http'

/** Bộ 3 khoá (V9): lệnh (LSX) · SKU · PO. */
export interface VtkTriple {
  itemId: string
  lenhCode: string
  sku: string
  productName: string
  poCode: string | null
  salesOrderItemId: string | null
  orderQty: number
}

export interface VtkWarehouse { id: string; code: string; name: string }

export interface VtkLocation {
  id: string
  code: string
  zone: string
  aisle: string
  slot: string
  qrToken: string
  isActive: boolean
  totalQty: number
  lines: (VtkTriple & { qty: number })[]
}

export interface VtkScannedLocation {
  id: string
  code: string
  isActive: boolean
  warehouseCode: string
  warehouseName: string
  totalQty: number
  lines: (VtkTriple & { qty: number })[]
}

export interface VtkStockRow extends VtkTriple {
  inStockQty: number
  locations: { id: string; code: string; qty: number }[]
  loadingQty: number
  unplacedQty: number
  toPackQty: number
}

export interface VtkStockTotal { inStockQty: number; loadingQty: number; unplacedQty: number; toPackQty: number }

export type VtkMovementKind = 'PUTAWAY' | 'PUTAWAY_CANCEL' | 'MOVE' | 'PICK' | 'UNPICK'

export interface VtkMovement extends VtkTriple {
  id: string
  kind: VtkMovementKind
  kindLabel: string
  qty: number
  note: string | null
  createdAt: string
  fromCode: string | null
  toCode: string | null
  bookingNo: string | null
  containerNo: string | null
  actorName: string | null
}

export interface VtkWriteResult { replay: boolean; movementId: string; mixWarning: string | null }

export interface VtkPickLocation { locationId: string; code: string; qty: number; suggestedQty: number }

export interface VtkPickLine extends VtkTriple {
  lineId: string
  qty: number
  shippedQty: number
  loadedQty: number
  remainingQty: number
  locations: VtkPickLocation[]
  shortQty: number
}

export type VtkContainerStatus = 'OPEN' | 'LOADED'

export interface VtkContainer {
  id: string
  bookingId: string
  containerNo: string | null
  sealNo: string | null
  photoUrls: string[]
  status: VtkContainerStatus
  note: string | null
  createdByName: string | null
  loadedAt: string | null
  loadedByName: string | null
  totalQty: number
  closeProblems: string[]
  lines: (VtkTriple & { bookingLineId: string; qty: number })[]
}

export type VtkPickList =
  | { enabled: false }
  | {
    enabled: true
    booking: {
      id: string; bookingNo: string; status: string; customerName: string; containerType: string; containerQty: number
      warehouseCode: string; warehouseName: string
    }
    lines: VtkPickLine[]
    containers: VtkContainer[]
  }

type Off = { enabled: false }
const key = (k: string) => ({ headers: { 'Idempotency-Key': k } })
const enc = encodeURIComponent

export const getViTriKhoConfig = () => http.get<{ enabled: boolean }>('/vi-tri-kho/config')

// ─── Công nhân đóng gói ───────────────────────────────────────────────────────────────────

export function scanFloorLocation(token: string, p: { ws?: string; itemId?: string | null } = {}) {
  const q = new URLSearchParams()
  if (p.ws) q.set('ws', p.ws)
  if (p.itemId) q.set('itemId', p.itemId)
  const s = q.toString()
  return http.get<Off | { enabled: true; location: VtkScannedLocation; mixWarning: string | null }>(
    `/vi-tri-kho/floor/scan/${enc(token)}${s ? `?${s}` : ''}`,
  )
}

// ─── Thủ kho Thành phẩm ───────────────────────────────────────────────────────────────────

export const getLocations = () =>
  http.get<Off | { enabled: true; warehouse: VtkWarehouse; locations: VtkLocation[] }>('/vi-tri-kho/locations')

export const lookupLocation = (token: string) =>
  http.get<Off | { enabled: true; location: VtkScannedLocation }>(`/vi-tri-kho/locations/by-token/${enc(token)}`)

export const createLocation = (data: { zone: string; aisle: number; slot: number }) =>
  http.post<VtkLocation>('/vi-tri-kho/locations', data)

export const bulkCreateLocations = (data: { zone: string; aisleFrom: number; aisleTo: number; slotFrom: number; slotTo: number }) =>
  http.post<{ warehouse: VtkWarehouse; created: VtkLocation[]; skipped: string[] }>('/vi-tri-kho/locations/bulk', data)

export const setLocationActive = (id: string, isActive: boolean) =>
  http.patch<{ id: string; code: string; isActive: boolean }>(`/vi-tri-kho/locations/${enc(id)}`, { isActive })

export const getFgStock = () =>
  http.get<Off | { enabled: true; warehouse: VtkWarehouse; rows: VtkStockRow[]; total: VtkStockTotal }>('/vi-tri-kho/stock')

export function getMovements(p: { locationId?: string; itemId?: string } = {}) {
  const q = new URLSearchParams()
  if (p.locationId) q.set('locationId', p.locationId)
  if (p.itemId) q.set('itemId', p.itemId)
  const s = q.toString()
  return http.get<Off | { enabled: true; warehouse: VtkWarehouse; movements: VtkMovement[] }>(`/vi-tri-kho/movements${s ? `?${s}` : ''}`)
}

export const moveStock = (data: { fromToken: string; toToken: string; itemId: string; qty: number; note?: string }, k: string) =>
  http.post<VtkWriteResult>('/vi-tri-kho/move', data, key(k))

export const putawayStock = (data: { locationToken: string; itemId: string; qty: number }, k: string) =>
  http.post<VtkWriteResult>('/vi-tri-kho/putaway', data, key(k))

// ─── Soạn hàng theo booking + cont ───────────────────────────────────────────────────────

export const getPickList = (bookingId: string) => http.get<VtkPickList>(`/vi-tri-kho/bookings/${enc(bookingId)}/pick-list`)

export const pickToContainer = (
  bookingId: string,
  data: { containerId: string; bookingLineId: string; locationToken: string; expectedLocationId?: string; qty: number },
  k: string,
) => http.post<VtkWriteResult>(`/vi-tri-kho/bookings/${enc(bookingId)}/pick`, data, key(k))

export const createContainer = (bookingId: string, data: { containerNo?: string; sealNo?: string } = {}) =>
  http.post<VtkContainer>(`/vi-tri-kho/bookings/${enc(bookingId)}/containers`, data)

export const updateContainer = (id: string, data: { containerNo?: string; sealNo?: string; photoUrls?: string[]; note?: string }) =>
  http.patch<VtkContainer>(`/vi-tri-kho/containers/${enc(id)}`, data)

export const deleteContainer = (id: string) => http.del<{ id: string; deleted: boolean }>(`/vi-tri-kho/containers/${enc(id)}`)

export const returnFromContainer = (id: string, data: { bookingLineId: string; locationToken: string; qty: number }, k: string) =>
  http.post<VtkWriteResult>(`/vi-tri-kho/containers/${enc(id)}/return`, data, key(k))

export const closeContainer = (id: string) => http.post<VtkContainer>(`/vi-tri-kho/containers/${enc(id)}/close`, {})

export const reopenContainer = (id: string) => http.post<VtkContainer>(`/vi-tri-kho/containers/${enc(id)}/reopen`, {})

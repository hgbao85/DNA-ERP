/**
 * Huỷ lệnh theo SKU - đợt 1 (23/11/2026, anh Nhân trả lời 7 câu): KHSX đề nghị huỷ 1 SKU (1 lệnh sản xuất) kèm lý do, Sếp duyệt mới
 * huỷ. BE `/production-order-cancellations` (src/modules/production-invoices/order-cancellation). Kiểu dưới CHÉP theo
 * OrderCancelRequestDto bên BE.
 */
import { http } from './core/http';

export type OrderCancelStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

export interface OrderCancelRequestDto {
  id: string;
  productionOrderId: string;
  poNumber: string;
  productionInvoiceId: string | null;
  /** Mã PI - chỉ dùng tra cứu, KHÔNG hiện (hiện số LSX / mã lệnh). */
  productionInvoiceCode: string | null;
  productionInvoiceItemId: string;
  lsxCode: string | null;
  /** Mã lệnh để hiện (BE tính: số LSX, số đã chuyển sang dòng mới, hoặc mã lệnh). */
  lenhCode: string;
  factoryCode: string;
  quantity: number;
  status: OrderCancelStatus;
  reason: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Dòng SKU mới cấp cho dòng đơn sau khi huỷ (để KHSX lên lệnh lại). */
  replacementItemId: string | null;
  /** Q3 (24/11/2026): QLSX quyết sắt chưa cắt - null = chưa quyết. */
  cutDecision?: CutDecision | null;
  cutDecidedAt?: string | null;
  cutDecisionNote?: string | null;
}

export type CutDecision = 'CONTINUE' | 'STOP';

export interface SteelReturnLine { materialId: string; lengthMm: number; bars: number }

/** Q3: SKU đã huỷ còn sắt ở tổ cắt (chép CutSteelRowDto bên BE). */
export interface CutSteelRow {
  request: OrderCancelRequestDto;
  isMergedInvoice: boolean;
  otherSkuActive: boolean;
  materials: {
    materialId: string;
    materialCode: string;
    materialName: string;
    barLengthsMm: number[];
    unreceivedBars: number;
    leftoverMm: number;
    returnedMm: number;
  }[];
  returns: { materialCode: string; lengthMm: number; bars: number; createdAt: string }[];
}

/** Nhân 26/11 câu 2: 1 dòng sắt tổ cắt trả về chờ thủ kho Phôi xác nhận (chép PendingSteelReturnDto bên BE). */
export interface PendingSteelReturn {
  id: string;
  productionInvoiceId: string;
  lenhCode: string;
  factoryCode: string;
  materialCode: string;
  materialName: string;
  lengthMm: number;
  bars: number;
  warehouseName: string;
  createdByName: string;
  createdAt: string;
}

export function getPendingSteelReturns(): Promise<PendingSteelReturn[]> {
  return http.get<PendingSteelReturn[]>('/production-order-cancellations/steel-returns/pending');
}

export function confirmSteelReturn(id: string, countedBars: number): Promise<PendingSteelReturn[]> {
  return http.post<PendingSteelReturn[]>(`/production-order-cancellations/steel-returns/${id}/confirm`, { countedBars });
}

/** Nhân 26/11 câu 1: khung đan lấy tồn khác kho thành phẩm - đang chuyển (chép WovenInTransitDto bên BE). */
export interface WovenInTransit {
  id: string;
  qty: number;
  pieceCode: string;
  pieceName: string;
  targetLenhCode: string;
  targetFactoryCode: string;
  sourceLenhCode: string;
  sourceFactoryCode: string;
  fromWarehouseName: string;
  toWarehouseName: string;
  createdAt: string;
  /** Lệnh nhận đã huỷ khi khung còn đang chuyển: nhận bao nhiêu thành tồn ở kho này, phần không nhận về lại kho nguồn. */
  targetCancelled: boolean;
}

export function getWovenInTransit(): Promise<WovenInTransit[]> {
  return http.get<WovenInTransit[]>('/production-order-cancellations/woven-transfers/pending');
}

/** receivedQty: số khung thực nhận (0..qty); phần không nhận về lại kho nguồn. Nhận 0 thì không cần ảnh phiếu. */
export function confirmWovenReceived(id: string, signedSlipUrls: string[], receivedQty: number): Promise<WovenInTransit[]> {
  return http.post<WovenInTransit[]>(`/production-order-cancellations/woven-transfers/${id}/receive`, { signedSlipUrls, receivedQty });
}

export async function getCutSteel(): Promise<CutSteelRow[]> {
  return http.get<CutSteelRow[]>('/production-order-cancellations/cut-steel');
}

/** Huỷ lệnh đợt 2 - Q5/Q6 (chép CancelledGoodsRowDto bên BE). */
export type CancelledGoodsKind = 'PACKED' | 'WOVEN';

export interface CancelledGoodsRow {
  requestId: string;
  lenhCode: string;
  factoryCode: string;
  sourceItemId: string;
  wireName: string | null;
  cushionName: string | null;
  /** Kho thành phẩm của lệnh bị huỷ - nơi khung đan thành tồn (Q6 câu 3a, 26/11/2026). */
  warehouseCode: string;
  warehouseName: string;
  packedAvailable: number;
  /** Khung đã đan còn tồn ở kho thành phẩm theo mảnh - tự cấp cho lệnh sau cùng mảnh + màu dây (Q6 câu 1b). */
  woven: { pieceId: string; pieceCode: string; pieceName: string; available: number }[];
  targets: {
    itemId: string;
    lenhCode: string;
    orderCode: string | null;
    customerName: string | null;
    quantity: number;
    packedQty: number;
    sameWire: boolean;
    sameCushion: boolean;
  }[];
  transfers: { id: string; kind: CancelledGoodsKind; qty: number; pieceName: string | null; targetLenhCode: string; createdAt: string }[];
}

export async function getCancelledGoods(): Promise<CancelledGoodsRow[]> {
  return http.get<CancelledGoodsRow[]>('/production-order-cancellations/goods');
}

/** KHSX chuyển hàng đã đóng gói (PACKED) / khung đã đan (WOVEN, kèm pieceId) sang 1 dòng SKU đang chạy. */
export async function transferCancelledGoods(
  requestId: string,
  input: { kind: CancelledGoodsKind; targetItemId: string; pieceId?: string; qty: number; note?: string },
): Promise<CancelledGoodsRow> {
  return http.post<CancelledGoodsRow>(`/production-order-cancellations/${requestId}/transfer-goods`, input);
}

/** QLSX: cho cắt tiếp (CONTINUE) hoặc ngưng + nhập trả cây (STOP). */
export async function decideCutSteel(
  requestId: string,
  input: { decision: CutDecision; returns?: SteelReturnLine[]; note?: string },
): Promise<CutSteelRow> {
  return http.post<CutSteelRow>(`/production-order-cancellations/${requestId}/cut-decision`, input);
}

export async function getOrderCancelRequests(
  q: { status?: OrderCancelStatus; productionInvoiceId?: string; productionOrderId?: string } = {},
): Promise<OrderCancelRequestDto[]> {
  return http.get<OrderCancelRequestDto[]>('/production-order-cancellations', { params: q });
}

/** Câu 8 (anh Nhân 24/11/2026) - chép theo CancelImpactDto bên BE. */
export interface CancelImpactDto {
  requestId: string;
  fromSnapshot: boolean;
  takenAt: string;
  floorStage: string;
  isMergedInvoice: boolean;
  steelIssued: { materialCode: string; materialName: string; barLengthMm: number; bars: number; receivedBars: number }[];
  signedPurchases: {
    itemId: string;
    materialCode: string;
    materialName: string;
    unit: string;
    signedQty: number;
    receivedQty: number;
    unitPrice: number | null;
    amount: number | null;
    supplierName: string | null;
    supplierOrderCode: string | null;
  }[];
  signedAmountTotal: number;
  missingPriceCount: number;
  stages: { stage: string; label: string; rows: { name: string; qty: number }[] }[];
}

/** Sắt đã xuất, dòng mua đã ký (kèm tiền), hàng từng công đoạn - cho hộp duyệt huỷ của Sếp. */
export async function getOrderCancelImpact(requestId: string): Promise<CancelImpactDto> {
  return http.get<CancelImpactDto>(`/production-order-cancellations/${requestId}/impact`);
}

/** KHSX (hoặc Admin) đề nghị huỷ 1 SKU. */
export async function requestOrderCancel(productionOrderId: string, reason: string): Promise<OrderCancelRequestDto> {
  return http.post<OrderCancelRequestDto>('/production-order-cancellations', { productionOrderId, reason });
}

/** Người đề nghị rút lại khi Sếp chưa quyết. */
export async function withdrawOrderCancel(requestId: string): Promise<OrderCancelRequestDto> {
  return http.post<OrderCancelRequestDto>(`/production-order-cancellations/${requestId}/withdraw`);
}

/** Sếp duyệt (approve=true) hoặc từ chối (approve=false, bắt buộc ghi lý do vào note). */
export async function decideOrderCancel(
  requestId: string,
  input: { approve: boolean; note?: string },
): Promise<OrderCancelRequestDto> {
  return http.post<OrderCancelRequestDto>(`/production-order-cancellations/${requestId}/decide`, input);
}

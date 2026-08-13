/**
 * Adapter KIỂM TRA VẬT TƯ TRƯỚC SẢN XUẤT: FE ⇄ BE thật (module `material-inspection`, chốt
 * 2026-08-12). Thay InspectionContext.requests/SEED_REQUESTS (mock).
 * Neo vào PlanForm(origin='PRODUCTION_CONFIRM') - Sku.id ở FE CHÍNH LÀ PlanForm.id (xem
 * sku-api.ts toSku(): `id: pf.id` map thẳng), nên planFormId gửi lên chỉ cần String(pf.id),
 * KHÔNG cần tra ngược productionInvoiceItemId như transfer-check-api.ts/packaging-api.ts (2
 * domain đó key theo productionInvoiceItem, không phải PlanForm).
 * actualStock của dòng có materialId LUÔN do BE tự đọc StockQuant lúc submitKho - FE không gửi
 * số, chỉ gửi overrides cho dòng hiếm không map được vật tư thật (materialId null).
 */
import { http } from './core/http';
import type { Sku } from '../types/sku';
import type { InspRequest, KhoState, InspItem, KhoKey } from '../context/InspectionContext';

export interface BeInspectionKhoItem {
  id: string;
  materialId: string | null;
  materialName: string;
  materialUnit: string;
  required: number;
  actualStock: number | null;
  shortage: number;
}

export interface BeInspectionKhoResult {
  id: string;
  warehouseCode: string;
  status: 'PENDING' | 'SUBMITTED';
  submittedAt: string | null;
  submittedById: string | null;
  proposalCreated: boolean;
  purchaseProposalId: string | null;
  items: BeInspectionKhoItem[];
}

export interface BeInspectionRequest {
  id: string;
  planFormId: string;
  poNumber: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  deliveryDeadline: string | null;
  productionStarted: boolean;
  productionStartedAt: string | null;
  createdAt: string;
  khoResults: BeInspectionKhoResult[];
}

export async function getInspectionRequests(): Promise<BeInspectionRequest[]> {
  const res = await http.get<BeInspectionRequest[] | { data: BeInspectionRequest[] }>(
    '/material-inspection-requests?limit=100',
  );
  return Array.isArray(res) ? res : res.data;
}

/** Find-or-create idempotent theo planFormId (xem MaterialInspectionService.create) - gọi lại
 *  nhiều lần an toàn (vd bấm 2 lần), không tạo trùng request. */
export async function createInspectionRequest(pf: Sku): Promise<BeInspectionRequest> {
  return http.post<BeInspectionRequest>('/material-inspection-requests', {
    planFormId: String(pf.id),
  });
}

export async function submitInspectionKho(
  requestId: string,
  warehouseCode: string,
  overrides?: { itemId: string; actualStock: number }[],
): Promise<BeInspectionRequest> {
  return http.post<BeInspectionRequest>(
    `/material-inspection-requests/${requestId}/kho/${warehouseCode}/submit`,
    overrides && overrides.length > 0 ? { overrides } : {},
  );
}

export async function startInspectionProduction(requestId: string): Promise<BeInspectionRequest> {
  return http.post<BeInspectionRequest>(`/material-inspection-requests/${requestId}/start-production`);
}

const WAREHOUSE_CODE_TO_KHO_KEY: Record<string, KhoKey> = {
  'phoi-son-han': 'phoiSonHan',
  'vat-tu-tp': 'vatTuTP',
  'thanh-pham': 'thanhPham',
};

const EMPTY_KHO: KhoState = { status: 'pending', items: [], khoResultId: '' };

function toKhoState(kr: BeInspectionKhoResult): KhoState {
  return {
    status: kr.status === 'SUBMITTED' ? 'done' : 'pending',
    submittedAt: kr.submittedAt ?? undefined,
    khoResultId: kr.id,
    purchaseProposalId: kr.purchaseProposalId ?? undefined,
    items: kr.items.map((it): InspItem => ({
      id: it.id,
      materialId: it.materialId,
      name: it.materialName,
      unit: it.materialUnit,
      required: it.required,
      actualStock: it.actualStock,
    })),
  };
}

/**
 * `proposalCreated` (FE, mức cả request) = ĐÃ có ít nhất 1 kho được tạo đề xuất mua thật (OR theo
 * `InspectionKhoResultResponseDto.proposalCreated` của từng kho) - đúng nghĩa "KHSX đã bấm Tạo đề
 * xuất mua hàng cho lệnh này", KHÔNG suy từ shortage (kho đủ hàng thì không bao giờ có đề xuất -
 * nếu gate theo "hết shortage chưa được đề xuất" sẽ báo nhầm proposalCreated=true cho lệnh đủ
 * hàng ngay từ đầu, chưa ai bấm gì).
 */
export function toInspRequest(be: BeInspectionRequest): InspRequest {
  const byCode = new Map(be.khoResults.map((k) => [WAREHOUSE_CODE_TO_KHO_KEY[k.warehouseCode] ?? k.warehouseCode, k]));

  return {
    id: be.id,
    skuId: be.planFormId,
    poNumber: be.poNumber,
    skuCode: be.mfgProductCode,
    skuName: be.mfgProductName ?? undefined,
    sentAt: be.createdAt,
    deadline: be.deliveryDeadline ?? undefined,
    phoiSonHan: byCode.has('phoiSonHan') ? toKhoState(byCode.get('phoiSonHan')!) : EMPTY_KHO,
    vatTuTP: byCode.has('vatTuTP') ? toKhoState(byCode.get('vatTuTP')!) : EMPTY_KHO,
    thanhPham: byCode.has('thanhPham') ? toKhoState(byCode.get('thanhPham')!) : EMPTY_KHO,
    proposalCreated: be.khoResults.some((k) => k.proposalCreated),
    productionStarted: be.productionStarted,
    productionStartedAt: be.productionStartedAt ?? undefined,
  };
}

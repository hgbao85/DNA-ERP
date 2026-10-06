/**
 * Adapter SẢN XUẤT vật tư thành phẩm KHÔNG gắn piece (module `material-yield-recipes` các phần
 * issue/production/qc, 2026-10-01) - mirror material-yield-issues-api.ts (xuất/nhận nguyên liệu
 * vào) + production-batches-api.ts (báo công đoạn/gửi KCS/duyệt KCS), nhưng khoá theo
 * (productionInvoiceId, recipeId) thay vì (productionOrderId, pieceId) - vật tư này KHÔNG gắn
 * piece/SKU nào, chỉ thuộc về cả PI. Xem MaterialYieldRecipeProductionService (BE).
 */
import { http, withIdempotencyKey } from './core/http';
import type { ProcessStep } from '../types/sku';

// ── Nhu cầu sản xuất theo PI (MaterialYieldRecipesService.getProductionDemand) ───────────────────

export interface BeMaterialYieldRecipeDemandItem {
  recipeId: string;
  outputMaterialId: string;
  outputMaterialCode: string;
  outputMaterialName: string;
  requiredOutputQty: number;
  onHandOutputQty: number;
  shortfallOutputQty: number;
  inputMaterialId: string;
  inputMaterialCode: string;
  inputMaterialName: string;
  requiredInputQty: number;
}

export async function getMaterialYieldRecipeDemand(
  productionInvoiceId: string,
): Promise<BeMaterialYieldRecipeDemandItem[]> {
  return http.get<BeMaterialYieldRecipeDemandItem[]>(
    `/production-invoices/${productionInvoiceId}/material-yield-recipe-demand`,
  );
}

// ── Xuất/nhận nguyên liệu vào (MaterialYieldRecipeIssue) ──────────────────────────────────────────

export interface BeMaterialYieldRecipeIssue {
  id: string;
  productionInvoiceId: string;
  piCode: string;
  recipeId: string;
  inputMaterialId: string;
  inputMaterialCode: string;
  inputMaterialName: string;
  issuedQty: number;
  status: 'ISSUED' | 'RECEIVED';
  issuedAt: string;
  issuedById: string;
  receivedQty: number | null;
  receivedAt: string | null;
  receivedById: string | null;
}

/** Thủ kho xuất nguyên liệu vào (vd thanh nhôm) cho 1 recipe theo PI - kiểm tồn + warehouseScope ở BE. */
export async function issueMaterialYieldRecipe(
  productionInvoiceId: string,
  data: { recipeId: string; issuedQty: number },
): Promise<BeMaterialYieldRecipeIssue> {
  return http.post<BeMaterialYieldRecipeIssue>(
    `/production-invoices/${productionInvoiceId}/material-yield-recipe-issues`,
    data,
    withIdempotencyKey(),
  );
}

export async function getMaterialYieldRecipeIssuesForInvoice(
  productionInvoiceId: string,
): Promise<BeMaterialYieldRecipeIssue[]> {
  const res = await http.get<
    BeMaterialYieldRecipeIssue[] | { data: BeMaterialYieldRecipeIssue[] }
  >(`/production-invoices/${productionInvoiceId}/material-yield-recipe-issues`);
  return Array.isArray(res) ? res : res.data;
}

/** Phôi xem đợt chờ/đã nhận của mình - flat qua mọi PI, cùng lý do getMaterialYieldIssuesByStatus(). */
export async function getMaterialYieldRecipeIssuesByStatus(
  status?: 'ISSUED' | 'RECEIVED',
): Promise<BeMaterialYieldRecipeIssue[]> {
  const qs = status ? `status=${status}&limit=100` : 'limit=100';
  const res = await http.get<
    BeMaterialYieldRecipeIssue[] | { data: BeMaterialYieldRecipeIssue[] }
  >(`/material-yield-recipe-issues?${qs}`);
  return Array.isArray(res) ? res : res.data;
}

export async function receiveMaterialYieldRecipeIssue(
  issueId: string,
  receivedQty?: number,
): Promise<void> {
  await http.post(`/material-yield-recipe-issues/${issueId}/receive`, { receivedQty });
}

// ── Báo công đoạn + gửi KCS (MaterialYieldStepBatch/Bundle) ───────────────────────────────────────

export interface BeMaterialYieldStepBundle {
  id: string;
  productionInvoiceId: string;
  piCode: string;
  recipeId: string;
  outputMaterialCode: string;
  outputMaterialName: string;
  step: ProcessStep;
  qty: number;
  status: 'AWAITING_QC' | 'QC_PASSED';
  submittedAt: string;
  submittedById: string;
}

/** Phôi báo "vừa {step} xong N {đơn vị}" cho 1 recipe - tích luỹ vào MaterialYieldStepBatch, chưa gửi KCS. */
export async function recordMaterialYieldStepBatch(
  productionInvoiceId: string,
  data: { recipeId: string; step: ProcessStep; qty: number },
): Promise<void> {
  await http.post(
    `/production-invoices/${productionInvoiceId}/material-yield-step-batches`,
    data,
    withIdempotencyKey(),
  );
}

/** Gom mọi batch CHƯA gửi của (recipe, step) thành 1 bundle gửi KCS - service tự tính qty. */
export async function submitMaterialYieldStep(
  productionInvoiceId: string,
  data: { recipeId: string; step: ProcessStep },
): Promise<BeMaterialYieldStepBundle> {
  return http.post<BeMaterialYieldStepBundle>(
    `/production-invoices/${productionInvoiceId}/material-yield-step-bundles`,
    data,
  );
}

/** Phôi xem lại bundle CỦA CHÍNH PI này (mọi status) - khối "Các đợt đã gửi". */
export async function getMaterialYieldStepBundlesForInvoice(
  productionInvoiceId: string,
): Promise<BeMaterialYieldStepBundle[]> {
  return http.get<BeMaterialYieldStepBundle[]>(
    `/production-invoices/${productionInvoiceId}/material-yield-step-bundles`,
  );
}

/** KCS xem bundle đang chờ/đã duyệt - flat qua mọi PI, cùng lý do getPieceStepBundles(). */
export async function getMaterialYieldStepBundles(
  status?: 'AWAITING_QC' | 'QC_PASSED',
): Promise<BeMaterialYieldStepBundle[]> {
  const res = await http.get<BeMaterialYieldStepBundle[] | { data: BeMaterialYieldStepBundle[] }>(
    `/material-yield-step-bundles?limit=100${status ? `&status=${status}` : ''}`,
  );
  return Array.isArray(res) ? res : res.data;
}

/** 1 dòng qc_reviews nhánh công đoạn vật tư không gắn piece (materialYieldStepBundleId != null). */
export interface BeMaterialYieldStepBundleQcReview {
  id: string;
  materialYieldStepBundleId: string | null;
  failedQty: number;
  reviewedAt: string;
  reviewedById: string;
}

/** Fetch hết rồi lọc client theo materialYieldStepBundleId != null - cùng idiom getQcReviewsForPieceStepBundles(). */
export async function getQcReviewsForMaterialYieldStepBundles(): Promise<
  BeMaterialYieldStepBundleQcReview[]
> {
  const res = await http.get<
    BeMaterialYieldStepBundleQcReview[] | { data: BeMaterialYieldStepBundleQcReview[] }
  >('/qc-reviews?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.filter((r) => r.materialYieldStepBundleId != null);
}

export async function reviewMaterialYieldStepQc(
  materialYieldStepBundleId: string,
  data: { failedQty: number; reason?: string; defectReasonId?: string; photoUrl?: string },
): Promise<void> {
  await http.post(`/material-yield-step-bundles/${materialYieldStepBundleId}/qc-review`, data);
}

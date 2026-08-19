/**
 * Adapter STOCK: FE ⇄ BE thật (module `stock` — stock-quant + stock-ledger, Phase 3 Ledger
 * Core). stock_quant là cache tồn kho (materialize từ stock_ledger bằng trigger DB, chỉ đọc).
 * stock_ledger là sổ cái bút toán kép fromWarehouse->toWarehouse - đa số đọc qua GET ở đây, ghi
 * bút toán thật đi qua các flow nghiệp vụ khác (warehouse-transfers...). Ngoại lệ duy nhất:
 * adjustStock() - POST /stock-ledger/adjust, dùng cho "Sửa nhanh tồn kho" ở MfgWarehousesPage.tsx
 * và MaterialsPage.tsx (Admin > Vật tư).
 */
import { http, withIdempotencyKey } from './core/http';

export interface BeStockQuant {
  id: string;
  warehouseId: string;
  warehouseCode: string;
  materialId: string | null;
  materialCode: string | null;
  segmentSpecId: string | null;
  segmentSpecLabel: string | null;
  qty: number;
  updatedAt: string;
}

export interface BeStockLedgerEntry {
  id: string;
  fromWarehouseId: string;
  fromWarehouseCode: string;
  toWarehouseId: string;
  toWarehouseCode: string;
  materialId: string | null;
  materialCode: string | null;
  segmentSpecId: string | null;
  segmentSpecLabel: string | null;
  qty: number;
  refType: string;
  note: string | null;
  createdAt: string;
}

export async function getStockQuants(params?: { warehouseId?: string; materialId?: string; segmentSpecId?: string }): Promise<BeStockQuant[]> {
  return http.get<BeStockQuant[]>('/stock-quant', { params });
}

export async function getStockLedger(params: { warehouseId: string; limit?: number }): Promise<BeStockLedgerEntry[]> {
  const res = await http.get<{ data: BeStockLedgerEntry[] } | BeStockLedgerEntry[]>('/stock-ledger', {
    params: { limit: 100, ...params },
  });
  return Array.isArray(res) ? res : res.data;
}

/** materialId/segmentSpecId - đúng 1 trong 2 phải có giá trị (khớp ràng buộc XOR của
 *  CreateStockAdjustmentDto ở BE - segmentSpecId dùng cho "Kho phôi", xem docs/quy-doi-doan-phoi.md). */
export async function adjustStock(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  materialId?: string;
  segmentSpecId?: string;
  qty: number;
  note?: string;
}): Promise<BeStockLedgerEntry> {
  return http.post<BeStockLedgerEntry>('/stock-ledger/adjust', input, withIdempotencyKey());
}

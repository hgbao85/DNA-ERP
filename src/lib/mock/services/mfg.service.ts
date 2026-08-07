import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';

const clone = <T>(v: T): T => structuredClone(v);
const ok = async <T>(v: T) => { await mockDelay(); return v; };

// ─── Service classes ──────────────────────────────────────────────────────────

// getAll/getItems vẫn mock (đọc mockStore.mfgWarehouses/mfgWarehouseItems) — dùng bởi
// VatTuDashboardPage.tsx để tra tồn kho "phôi-sơn-hàn" nhanh. Phần CRUD kho thật đã chuyển
// sang warehouses-api.ts/MfgWarehousesPage.tsx (Tổng hợp kho, Admin) - class này KHÔNG còn
// dùng để tạo/sửa/xoá kho hay ghi nhận nhập/xuất, chỉ còn đọc.
class MfgWarehouseService extends BaseService<any> {
  constructor() { super('mfgWarehouses'); }

  async getAll() {
    const s = mockStore.get();
    const warehouses = clone(s.mfgWarehouses).map((wh: any) => {
      const items = s.mfgWarehouseItems.filter((i: any) => i.warehouseId === wh.id);
      return {
        ...wh,
        _count: { items: items.length },
        totalQty: items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0),
      };
    });
    return ok(warehouses);
  }

  async getItems(warehouseId: number, search?: string) {
    let items = mockStore.get().mfgWarehouseItems.filter((i) => i.warehouseId === warehouseId);
    if (search) items = items.filter((i) => i.name?.includes(search));
    return ok(clone(items));
  }
}

class ExportPurposeService extends BaseService<any> {
  constructor() { super('exportPurposes'); }

  async createWithLabel(label: string) {
    await mockDelay();
    const row = { id: nextId(), label };
    mockStore.update((s) => s.exportPurposes.push(row));
    return row;
  }
}

// Không extends BaseService — collection 'weavingPoints' đã lên BE thật (weaving-points-api.ts).
// Chỉ còn getByPoint (đọc mockStore.weavingByPoint) - dùng bởi QuanLyDiemDanPage.tsx. Phần
// phân bổ/nhận đan/chuyển kiểm khác đã không còn trang nào gọi tới, đã bỏ.
class WeavingService {
  async getByPoint() { return ok(clone(mockStore.get().weavingByPoint)); }
}

// ─── Service instances (singletons) ──────────────────────────────────────────

const warehouseSvc = new MfgWarehouseService();
const exportPurposeSvc = new ExportPurposeService();
const weavingSvc = new WeavingService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

// Upload file demo (ảnh KCS, hợp đồng...) — không có backend lưu file thật ở phase này,
// vẫn giữ mock cho mọi nơi cần 1 URL giả (kcsCore.tsx, đính kèm PO...).
export const uploadContractFile = async (_file: File) => {
  await mockDelay();
  return `/mock/contract-${Date.now()}.pdf`;
};

export const getMfgWarehouses = () => warehouseSvc.getAll();
export const getMfgWarehouseItems = (warehouseId: number, search?: string) => warehouseSvc.getItems(warehouseId, search);

export const getExportPurposes = () => exportPurposeSvc.getAll();
export const createExportPurpose = (label: string) => exportPurposeSvc.createWithLabel(label);
export const updateExportPurpose = (id: number, data: Record<string, unknown>) => exportPurposeSvc.update(id, data);
export const deleteExportPurpose = (id: number) => exportPurposeSvc.remove(id);

export const getWeavingByPoint = () => weavingSvc.getByPoint();

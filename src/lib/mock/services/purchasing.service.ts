import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';

// ─── Service classes ──────────────────────────────────────────────────────────

class SupplierService extends BaseService<any> {
  constructor() { super('suppliers'); }

  async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return super.create(data, { isActive: true });
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    return { id, ...data };
  }

  async remove(id: number) {
    await mockDelay();
    return { id };
  }
}

class MaterialSupplierService extends BaseService<any> {
  constructor() { super('materialSuppliers'); }

  async getByMaterial(_materialId?: number) {
    await mockDelay();
    return this.clone(this.collection());
  }

  async create(data: Record<string, unknown>): Promise<Record<string, unknown>> {
    await mockDelay();
    return { id: nextId(), ...data };
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    return { id, ...data };
  }

  async remove(id: number) {
    await mockDelay();
    return { id };
  }
}

class PurchaseCommandService extends BaseService<any> {
  constructor() { super('purchaseCommands'); }

  async findById(id: number | string): Promise<any> {
    await mockDelay();
    return this.clone(this.collection().find((c) => c.id === id));
  }

  async compute(id: number) {
    await mockDelay();
    return { id, computed: true };
  }

  async updateItem(itemId: number, data: Record<string, unknown>) {
    await mockDelay();
    return { id: itemId, ...data };
  }
}

// ─── Service instances (singletons) ──────────────────────────────────────────

const supplierSvc = new SupplierService();
const materialSupplierSvc = new MaterialSupplierService();
const purchaseCommandSvc = new PurchaseCommandService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getSuppliers = () => supplierSvc.getAll();
export const createSupplier = (data: Record<string, unknown>) => supplierSvc.create(data);
export const updateSupplier = (id: number, data: Record<string, unknown>) => supplierSvc.update(id, data);
export const deleteSupplier = (id: number) => supplierSvc.remove(id);

export const getMaterialSuppliers = (materialId?: number) => materialSupplierSvc.getByMaterial(materialId);
export const createMaterialSupplier = (data: Record<string, unknown>) => materialSupplierSvc.create(data);
export const updateMaterialSupplier = (id: number, data: Record<string, unknown>) => materialSupplierSvc.update(id, data);
export const deleteMaterialSupplier = (id: number) => materialSupplierSvc.remove(id);

export const getPurchaseCommands = () => purchaseCommandSvc.getAll();
export const getPurchaseCommand = (id: number) => purchaseCommandSvc.findById(id);
export const computePurchaseCommand = (id: number) => purchaseCommandSvc.compute(id);
export const updateCommandItem = (itemId: number, data: Record<string, unknown>) => purchaseCommandSvc.updateItem(itemId, data);

// ─── PurchaseOrder flow ───────────────────────────────────────────────────────

export const getPurchaseOrders = async (): Promise<any[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).purchaseOrders ?? []);
};

export const createPurchaseOrder = async (data: {
  source: 'KHSX' | 'WAREHOUSE' | 'MANUAL';
  sourceRef?: string;
  skuName?: string;
  note?: string;
  items: Array<{ materialName: string; unit: string; requiredQty: number; buyQty: number }>;
}): Promise<any> => {
  await mockDelay();
  const now = new Date().toISOString();
  const pos = (mockStore.get() as any).purchaseOrders ?? [];
  const code = `MH-2026-${String(pos.length + 1).padStart(3, '0')}`;
  const po = {
    id: nextId(),
    code,
    source: data.source,
    sourceRef: data.sourceRef ?? null,
    skuName: data.skuName ?? null,
    status: 'PENDING_WAREHOUSE',
    items: data.items.map(it => ({
      id: nextId(),
      materialName: it.materialName,
      unit: it.unit,
      requiredQty: it.requiredQty,
      stockActual: null,
      buyQty: it.buyQty,
      supplierId: null,
      supplierName: null,
      unitPrice: null,
      expectedDate: null,
      note: null,
    })),
    totalAmount: null,
    note: data.note ?? null,
    rejectionReason: null,
    createdAt: now,
    confirmedAt: null,
    submittedAt: null,
    approvedAt: null,
  };
  mockStore.update((s: any) => {
    if (!s.purchaseOrders) s.purchaseOrders = [];
    s.purchaseOrders.push(po);
  });
  return structuredClone(po);
};

export const confirmPurchaseOrderByWarehouse = async (
  id: number,
  items: Array<{ id: number; stockActual: number; buyQty: number }>
): Promise<any> => {
  await mockDelay();
  const now = new Date().toISOString();
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    // Chỉ xác nhận lệnh đang ở đúng trạng thái chờ kho — chặn double-submit tạo reservation trùng
    if (!po || po.status !== 'PENDING_WAREHOUSE') return;
    if (!s.mfgWarehouseReservations) s.mfgWarehouseReservations = [];

    // Tồn khả dụng thật tại thời điểm xác nhận (tồn kho - phần lệnh khác đang giữ chỗ),
    // trừ dần khi xử lý từng dòng để không cho chính lệnh này tự giữ vượt quá tồn thật
    const availableByName = new Map<string, number>();
    const availFor = (norm: string) => {
      if (!availableByName.has(norm)) {
        const onHand = (s.mfgWarehouseItems ?? [])
          .filter((w: any) => w.name?.toLowerCase().trim() === norm)
          .reduce((sum: number, w: any) => sum + (w.quantity ?? 0), 0);
        const reserved = s.mfgWarehouseReservations
          .filter((r: any) => r.status === 'ACTIVE' && r.materialName?.toLowerCase().trim() === norm)
          .reduce((sum: number, r: any) => sum + (r.quantity ?? 0), 0);
        availableByName.set(norm, Math.max(0, onHand - reserved));
      }
      return availableByName.get(norm)!;
    };

    po.status = 'WAREHOUSE_CONFIRMED';
    po.confirmedAt = now;

    items.forEach(upd => {
      const it = po.items.find((i: any) => i.id === upd.id);
      if (!it) return;
      const norm = it.materialName?.toLowerCase().trim() ?? '';
      const cap = availFor(norm);
      // Chặn giá trị phi số (NaN/Infinity) trước khi tính toán, tránh làm hỏng dữ liệu PO
      const safeInput = Number.isFinite(upd.stockActual) ? upd.stockActual : 0;
      // Không cho ghi nhận tồn thực tế vượt quá tồn khả dụng thật — phần vượt tự động chuyển thành cần mua
      const stockActual = Math.max(0, Math.min(safeInput, cap));
      it.stockActual = stockActual;
      it.buyQty = Math.max(0, it.requiredQty - stockActual);

      // Giữ chỗ TOÀN BỘ nhu cầu (cả phần đã có sẵn lẫn phần sẽ đặt mua) cho lệnh này —
      // để khi hàng đặt mua về kho sau này không bị một lệnh khác giành mất trước khi lệnh này dùng tới.
      const claim = it.requiredQty;
      if (claim > 0) {
        s.mfgWarehouseReservations.push({
          id: nextId(),
          materialName: it.materialName,
          quantity: claim,
          sourcePOId: po.id,
          sourcePOCode: po.code,
          status: 'ACTIVE',
          createdAt: now,
        });
      }
      // Chỉ trừ phần tồn sẵn có thật đã lấy ngay bây giờ cho dòng kế tiếp cùng tên trong chính lệnh này
      if (norm) availableByName.set(norm, cap - stockActual);
    });
  });
  return structuredClone(((mockStore.get() as any).purchaseOrders ?? []).find((p: any) => p.id === id));
};

export const submitPurchaseOrderForApproval = async (
  id: number,
  items: Array<{
    id: number;
    quotes: Array<{ supplierId?: number; supplierName: string; unitPrice: number; expectedDate?: string; note?: string }>;
  }>
): Promise<any> => {
  await mockDelay();
  const now = new Date().toISOString();
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    if (!po) return;
    po.status = 'PENDING_APPROVAL';
    po.submittedAt = now;
    items.forEach(upd => {
      const it = po.items.find((i: any) => i.id === upd.id);
      if (!it) return;
      it.quotes = upd.quotes.map(q => ({
        id: nextId(),
        supplierId: q.supplierId ?? null,
        supplierName: q.supplierName,
        unitPrice: q.unitPrice,
        expectedDate: q.expectedDate ?? null,
        note: q.note ?? null,
      }));
      // Reset lựa chọn cũ (nếu gửi lại sau khi bị từ chối) — chờ GĐ chọn lại
      it.selectedQuoteId = null;
      it.supplierId = null;
      it.supplierName = null;
      it.unitPrice = null;
      it.expectedDate = null;
    });
    po.totalAmount = null;
  });
  return structuredClone(((mockStore.get() as any).purchaseOrders ?? []).find((p: any) => p.id === id));
};

export const approvePurchaseOrder = async (
  id: number,
  selections: Array<{ itemId: number; quoteId: number }>
): Promise<any> => {
  await mockDelay();
  const now = new Date().toISOString();
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    if (!po) return;
    let total = 0;
    selections.forEach(sel => {
      const it = po.items.find((i: any) => i.id === sel.itemId);
      const quote = it?.quotes?.find((q: any) => q.id === sel.quoteId);
      if (!it || !quote) return;
      it.selectedQuoteId = quote.id;
      it.supplierId = quote.supplierId ?? null;
      it.supplierName = quote.supplierName;
      it.unitPrice = quote.unitPrice;
      it.expectedDate = quote.expectedDate ?? null;
      total += quote.unitPrice * (it.buyQty ?? 0);
    });
    po.totalAmount = total || null;
    po.status = 'PURCHASING';
    po.approvedAt = now;
  });
  return structuredClone(((mockStore.get() as any).purchaseOrders ?? []).find((p: any) => p.id === id));
};

export const updatePurchaseOrderPurchaseStatus = async (
  id: number,
  status: 'PURCHASING' | 'PURCHASED'
): Promise<any> => {
  await mockDelay();
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    if (!po || (po.status !== 'PURCHASING' && po.status !== 'PURCHASED')) return;
    po.status = status;
  });
  return structuredClone(((mockStore.get() as any).purchaseOrders ?? []).find((p: any) => p.id === id));
};

export const createWarehouseReceiptForPO = async (id: number): Promise<any> => {
  await mockDelay();
  const now = new Date().toISOString();
  let receipt: any;
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    if (!po || po.status !== 'PURCHASED') return;
    if (!s.warehouseReceipts) s.warehouseReceipts = [];
    if (s.warehouseReceipts.some((r: any) => r.purchaseOrderId === id)) return;
    const count = s.warehouseReceipts.length + 1;
    receipt = {
      id: nextId(),
      code: `NK-2026-${String(count).padStart(3, '0')}`,
      purchaseOrderId: id,
      purchaseOrderCode: po.code,
      skuName: po.skuName ?? null,
      status: 'PENDING',
      items: po.items.map((it: any) => ({
        id: nextId(),
        purchaseOrderItemId: it.id,
        materialName: it.materialName,
        unit: it.unit,
        orderedQty: it.buyQty,
        receivedQty: null,
        warehouseId: null,
        note: null,
      })),
      note: null,
      createdAt: now,
      receivedAt: null,
    };
    s.warehouseReceipts.push(receipt);
  });
  return structuredClone(receipt);
};

export const rejectPurchaseOrder = async (id: number, reason?: string): Promise<any> => {
  await mockDelay();
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    // Chỉ cho từ chối khi đang chờ GĐ duyệt — đúng với luồng nghiệp vụ duy nhất hiện có (TongQuanPage)
    if (!po || po.status !== 'PENDING_APPROVAL') return;
    po.status = 'REJECTED';
    po.rejectionReason = reason ?? null;
    // Trả lại tồn kho đã giữ chỗ cho lệnh này vì lệnh bị từ chối
    (s.mfgWarehouseReservations ?? []).forEach((r: any) => {
      if (r.sourcePOId === id && r.status === 'ACTIVE') r.status = 'RELEASED';
    });
  });
  return structuredClone(((mockStore.get() as any).purchaseOrders ?? []).find((p: any) => p.id === id));
};

export const getWarehouseReceipts = async (): Promise<any[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).warehouseReceipts ?? []);
};

export const getWarehouseReservations = async (): Promise<any[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).mfgWarehouseReservations ?? []);
};

export const confirmWarehouseReceipt = async (
  id: number,
  items: Array<{ id: number; receivedQty: number; warehouseId: number }>
): Promise<any> => {
  await mockDelay();
  const now = new Date().toISOString();
  mockStore.update((s: any) => {
    const receipt = (s.warehouseReceipts ?? []).find((r: any) => r.id === id);
    if (!receipt || receipt.status === 'RECEIVED') return;
    receipt.status = 'RECEIVED';
    receipt.receivedAt = now;
    items.forEach(upd => {
      const it = receipt.items.find((i: any) => i.id === upd.id);
      if (it) { it.receivedQty = upd.receivedQty; it.warehouseId = upd.warehouseId; }
    });
    // Update warehouse stock
    items.forEach(upd => {
      const receiptItem = receipt.items.find((i: any) => i.id === upd.id);
      if (!receiptItem || !upd.warehouseId) return;
      const whItems = s.mfgWarehouseItems ?? [];
      const existing = whItems.find((wi: any) =>
        wi.warehouseId === upd.warehouseId &&
        wi.name?.toLowerCase().trim() === receiptItem.materialName?.toLowerCase().trim()
      );
      if (existing) {
        existing.quantity = (existing.quantity ?? 0) + upd.receivedQty;
      } else {
        whItems.push({ id: nextId(), warehouseId: upd.warehouseId, name: receiptItem.materialName, unit: receiptItem.unit ?? '', quantity: upd.receivedQty, code: null });
      }
      if (!s.mfgWarehouseTxns) s.mfgWarehouseTxns = [];
      s.mfgWarehouseTxns.push({
        id: nextId(), warehouseId: upd.warehouseId, type: 'IMPORT',
        quantity: upd.receivedQty, refCode: receipt.purchaseOrderCode,
        note: `Nhập từ đơn mua ${receipt.purchaseOrderCode}`,
        date: now, item: { name: receiptItem.materialName, unit: receiptItem.unit ?? '' },
      });
    });
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === receipt.purchaseOrderId);
    if (po) po.status = 'RECEIVED';
  });
  return structuredClone(((mockStore.get() as any).warehouseReceipts ?? []).find((r: any) => r.id === id));
};

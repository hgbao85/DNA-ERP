import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';
import { CATEGORY_WAREHOUSE_CODE } from '../../../types/purchase-order';

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

  async getByMaterial(materialId?: number) {
    await mockDelay();
    const all = this.clone(this.collection());
    return materialId != null ? all.filter((x: any) => x.materialId === materialId) : all;
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
  piCode?: string;
  skuName?: string;
  note?: string;
  items: Array<{ materialName: string; unit: string; requiredQty: number; buyQty: number; category?: string | null }>;
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
    piCode: data.piCode ?? null,
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
      category: it.category ?? null,
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
    // Giữ chỗ tồn kho ngay khi KHSX gửi đề xuất mua hàng — không chờ kho xác nhận mới cập nhật
    if (!s.mfgWarehouseReservations) s.mfgWarehouseReservations = [];
    po.items.forEach((it: any) => {
      if (it.requiredQty > 0) {
        s.mfgWarehouseReservations.push({
          id: nextId(),
          materialName: it.materialName,
          quantity: it.requiredQty,
          sourcePOId: po.id,
          sourcePOCode: po.code,
          status: 'ACTIVE',
          createdAt: now,
        });
      }
    });
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
    // Chỉ xác nhận lệnh đang ở đúng trạng thái chờ kho — chặn double-submit
    if (!po || po.status !== 'PENDING_WAREHOUSE') return;
    if (!s.mfgWarehouseReservations) s.mfgWarehouseReservations = [];

    // Tồn khả dụng thật tại thời điểm xác nhận (tồn kho - phần lệnh KHÁC đang giữ chỗ).
    // Phần lệnh này tự giữ (đã tạo từ lúc KHSX gửi đề xuất) không bị trừ vào đây vì đó là
    // chính phần đang được xác nhận, không phải đối thủ tranh chấp tồn kho.
    const availableByName = new Map<string, number>();
    const availFor = (norm: string) => {
      if (!availableByName.has(norm)) {
        const onHand = (s.mfgWarehouseItems ?? [])
          .filter((w: any) => w.name?.toLowerCase().trim() === norm)
          .reduce((sum: number, w: any) => sum + (w.quantity ?? 0), 0);
        const reserved = s.mfgWarehouseReservations
          .filter((r: any) => r.status === 'ACTIVE' && r.sourcePOId !== po.id && r.materialName?.toLowerCase().trim() === norm)
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
      // Giữ chỗ đã được tạo sẵn từ lúc KHSX gửi đề xuất (createPurchaseOrder) — không tạo lại ở đây.
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
  const created: any[] = [];
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    if (!po || po.status !== 'PURCHASED') return;
    if (!s.warehouseReceipts) s.warehouseReceipts = [];
    if (s.warehouseReceipts.some((r: any) => r.purchaseOrderId === id)) return;

    const nextCode = () => `NK-2026-${String(s.warehouseReceipts.length + 1).padStart(3, '0')}`;
    const makeItem = (it: any, warehouseId: number | null) => ({
      id: nextId(),
      purchaseOrderItemId: it.id,
      materialName: it.materialName,
      unit: it.unit,
      orderedQty: it.buyQty,
      receivedQty: null,
      warehouseId,
      note: null,
      category: it.category ?? null,
    });
    const makeReceipt = (items: any[], warehouseId: number | null) => ({
      id: nextId(),
      code: nextCode(),
      purchaseOrderId: id,
      purchaseOrderCode: po.code,
      piCode: po.piCode ?? null,
      skuName: po.skuName ?? null,
      status: 'PENDING',
      items: items.map((it: any) => makeItem(it, warehouseId)),
      note: null,
      createdAt: now,
      receivedAt: null,
    });

    // Nếu MỌI dòng của PO đều đã gắn category (sat/son/day/vatTuPhuKien/baoBiDongGoi) — tách thành
    // nhiều phiếu nhập, mỗi phiếu đúng 1 kho, item đã gán sẵn warehouseId (không cần chọn tay).
    // Nếu còn dòng chưa gắn category (PO tạo qua đường cũ) — giữ nguyên hành vi cũ: 1 phiếu, chọn kho thủ công.
    const allCategorized = po.items.length > 0 && po.items.every((it: any) => !!it.category);

    if (allCategorized) {
      const groups = new Map<string, any[]>();
      po.items.forEach((it: any) => {
        const whCode = CATEGORY_WAREHOUSE_CODE[it.category as keyof typeof CATEGORY_WAREHOUSE_CODE];
        if (!groups.has(whCode)) groups.set(whCode, []);
        groups.get(whCode)!.push(it);
      });
      groups.forEach((items, whCode) => {
        const wh = (s.mfgWarehouses ?? []).find((w: any) => w.code === whCode);
        const receipt = makeReceipt(items, wh?.id ?? null);
        s.warehouseReceipts.push(receipt);
        created.push(receipt);
      });
    } else {
      const receipt = makeReceipt(po.items, null);
      s.warehouseReceipts.push(receipt);
      created.push(receipt);
    }
  });
  return structuredClone(created);
};

export const rejectPurchaseOrder = async (id: number, reason?: string): Promise<any> => {
  await mockDelay();
  mockStore.update((s: any) => {
    const po = (s.purchaseOrders ?? []).find((p: any) => p.id === id);
    // Cho từ chối khi đang chờ GĐ duyệt (TongQuanPage) hoặc còn ở bước chờ kho xác nhận (LenhMuaKhoPage)
    if (!po || (po.status !== 'PENDING_APPROVAL' && po.status !== 'PENDING_WAREHOUSE')) return;
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
    if (po) {
      // 1 PO có thể bị tách thành nhiều phiếu nhập (mỗi kho 1 phiếu) — chỉ coi PO đã RECEIVED
      // khi TẤT CẢ phiếu nhập của PO này đều đã RECEIVED, không phải khi phiếu đầu tiên xong.
      const siblingReceipts = (s.warehouseReceipts ?? []).filter((r: any) => r.purchaseOrderId === po.id);
      const allReceived = siblingReceipts.length > 0 && siblingReceipts.every((r: any) => r.status === 'RECEIVED');
      if (allReceived) {
        po.status = 'RECEIVED';
        // Hàng đã về kho — giải phóng chỗ đã giữ cho lệnh này để không bị trừ trùng vào tồn khả dụng
        (s.mfgWarehouseReservations ?? []).forEach((r: any) => {
          if (r.sourcePOId === po.id && r.status === 'ACTIVE') r.status = 'RELEASED';
        });
      }
    }
  });
  return structuredClone(((mockStore.get() as any).warehouseReceipts ?? []).find((r: any) => r.id === id));
};

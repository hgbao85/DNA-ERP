import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import type { ManhOrder } from '../../../types/manh';

// ─── Mảnh theo PO — PO là cấp lớn nhất, 1 PO có nhiều SKU, mỗi SKU ứng với 1 mã PI riêng. Xuất đan
// (vật tư thành phẩm) và nhập đan (kho thành phẩm) đọc/ghi CHUNG 1 bản ghi ManhAllocation (theo
// từng điểm đan) nên luôn đồng bộ với nhau — không phải 2 hệ thống độc lập. 1 mảnh có thể xuất cho
// nhiều điểm đan khác nhau, mỗi điểm đan có luỹ kế xuất/nhập riêng. Bảng này độc lập với tồn kho
// mfgWarehouseItems (không liên quan tới chuyển kho nội bộ phôi sơn hàn → vật tư thành phẩm, vốn
// vẫn dùng cơ chế cũ). ─────────────────────────────────────────────────────────────────────────

export const getManhOrders = async (): Promise<ManhOrder[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).manhOrders ?? []);
};

// Xuất đan: chọn 1 điểm đan cho dòng mảnh, không vượt quá tồn thực hiện có.
export const xuatManh = async (lineId: number, weavingPointId: number, quantity: number): Promise<void> => {
  await mockDelay();
  mockStore.update((s: any) => {
    const orders = s.manhOrders ?? [];
    for (const order of orders) {
      const line = order.skus.flatMap((sku: any) => sku.lines).find((l: any) => l.id === lineId);
      if (!line) continue;
      const qty = Math.max(0, Math.min(quantity, line.tonThuc ?? 0));
      if (qty <= 0) return;

      if (!line.allocations) line.allocations = [];
      let alloc = line.allocations.find((a: any) => a.weavingPointId === weavingPointId);
      if (!alloc) {
        alloc = { id: nextId(), weavingPointId, xuatQty: 0, nhapQty: 0 };
        line.allocations.push(alloc);
      }
      alloc.xuatQty += qty;
      line.tonThuc -= qty;
      return;
    }
  });
};

// Nhập đan: xác nhận đã nhận về từ 1 điểm đan cụ thể — không vượt quá phần điểm đan đó đã xuất mà chưa nhập.
export const nhapManh = async (lineId: number, weavingPointId: number, quantity: number): Promise<void> => {
  await mockDelay();
  mockStore.update((s: any) => {
    const orders = s.manhOrders ?? [];
    for (const order of orders) {
      const line = order.skus.flatMap((sku: any) => sku.lines).find((l: any) => l.id === lineId);
      if (!line) continue;
      const alloc = (line.allocations ?? []).find((a: any) => a.weavingPointId === weavingPointId);
      if (!alloc) return;
      const remaining = alloc.xuatQty - alloc.nhapQty;
      const qty = Math.max(0, Math.min(quantity, remaining));
      if (qty <= 0) return;
      alloc.nhapQty += qty;
      return;
    }
  });
};

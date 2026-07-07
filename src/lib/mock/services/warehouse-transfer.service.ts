import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import type { WarehouseTransfer } from '../../../types/warehouse-transfer';
import { isValidTransferRoute } from '../../../types/warehouse-transfer';

const norm = (s: string) => s?.toLowerCase().trim() ?? '';

// "Khung ..." là mảnh luân chuyển qua chuỗi kho, có thêm trạng thái đan (manhStatus) — vật tư thường
// không có khái niệm này. Khung "chưa đan" ở vật tư thành phẩm rời hệ thống kho qua "xuất đan" (gửi
// cho điểm đan ngoài) và quay lại thẳng kho thành phẩm qua "nhập đan" — KHÔNG quay lại vật tư thành
// phẩm, nên vật tư thành phẩm không bao giờ giữ khung ở trạng thái "đã đan".
const isKhung = (name: string) => /^khung\s/i.test((name ?? '').trim());
const manhEligibleToSend = (w: any, fromWarehouseCode: string) => {
  if (!isKhung(w.name)) return true;
  if (fromWarehouseCode !== 'vat-tu-tp') return true; // phôi sơn hàn: khung luôn "chưa đan" khi xuất, đúng bản chất
  return (w.manhStatus ?? 'chua-dan') === 'da-dan';
};

// ─── Reads ────────────────────────────────────────────────────────────────────

export const getWarehouseTransfers = async (): Promise<WarehouseTransfer[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).warehouseTransfers ?? []);
};

export const getTransferReservations = async (): Promise<any[]> => {
  await mockDelay();
  return structuredClone((mockStore.get() as any).mfgTransferReservations ?? []);
};

// ─── Create (kho nguồn tạo phiếu — chỉ được đi đúng 1 bước theo chuỗi) ──────

export const createWarehouseTransfer = async (data: {
  fromWarehouseId: number;
  toWarehouseId: number;
  items: Array<{ materialName: string; unit: string; quantity: number }>;
  note?: string;
  piCode?: string;
}): Promise<WarehouseTransfer> => {
  await mockDelay();
  const now = new Date().toISOString();
  let created!: WarehouseTransfer;

  mockStore.update((s: any) => {
    const fromWh = (s.mfgWarehouses ?? []).find((w: any) => w.id === data.fromWarehouseId);
    const toWh = (s.mfgWarehouses ?? []).find((w: any) => w.id === data.toWarehouseId);
    if (!fromWh || !toWh) throw new Error('Kho nguồn hoặc kho đích không tồn tại');

    // Chặn sai hướng ngay tại service — không tin client, kể cả khi UI đã ẩn lựa chọn sai
    if (!isValidTransferRoute(fromWh.code, toWh.code)) {
      throw new Error(
        `Không được chuyển trực tiếp từ "${fromWh.name}" sang "${toWh.name}" — chỉ được chuyển đúng 1 bước theo chuỗi Phôi sơn hàn → Vật tư thành phẩm → Thành phẩm`
      );
    }

    if (!s.mfgTransferReservations) s.mfgTransferReservations = [];
    if (!s.warehouseTransfers) s.warehouseTransfers = [];

    const availFor = (materialNorm: string) => {
      const onHand = (s.mfgWarehouseItems ?? [])
        .filter((w: any) => w.warehouseId === data.fromWarehouseId && norm(w.name) === materialNorm && manhEligibleToSend(w, fromWh.code))
        .reduce((sum: number, w: any) => sum + (w.quantity ?? 0), 0);
      const reserved = s.mfgTransferReservations
        .filter((r: any) => r.status === 'ACTIVE' && r.warehouseId === data.fromWarehouseId && norm(r.materialName) === materialNorm)
        .reduce((sum: number, r: any) => sum + (r.quantity ?? 0), 0);
      return Math.max(0, onHand - reserved);
    };

    const clampedItems = data.items
      .map(it => {
        const cap = availFor(norm(it.materialName));
        const safeQty = Number.isFinite(it.quantity) ? it.quantity : 0;
        return { ...it, quantity: Math.max(0, Math.min(safeQty, cap)) };
      })
      .filter(it => it.quantity > 0);

    if (clampedItems.length === 0) {
      throw new Error('Không đủ tồn kho khả dụng để tạo phiếu chuyển kho cho (các) vật tư đã chọn');
    }

    const code = `CK-2026-${String(s.warehouseTransfers.length + 1).padStart(3, '0')}`;
    created = {
      id: nextId(),
      code,
      fromWarehouseId: data.fromWarehouseId,
      fromWarehouseName: fromWh.name,
      fromWarehouseCode: fromWh.code,
      toWarehouseId: data.toWarehouseId,
      toWarehouseName: toWh.name,
      toWarehouseCode: toWh.code,
      status: 'PENDING',
      items: clampedItems.map(it => ({ id: nextId(), materialName: it.materialName, unit: it.unit, quantity: it.quantity, note: null })),
      note: data.note ?? null,
      piCode: data.piCode ?? null,
      rejectionReason: null,
      createdAt: now,
      confirmedAt: null,
      rejectedAt: null,
    };
    s.warehouseTransfers.push(created);

    created.items.forEach(it => {
      s.mfgTransferReservations.push({
        id: nextId(),
        warehouseId: data.fromWarehouseId,
        materialName: it.materialName,
        quantity: it.quantity,
        sourceTransferId: created.id,
        status: 'ACTIVE',
        createdAt: now,
      });
    });
  });

  return structuredClone(created);
};

// ─── Confirm (kho đích xác nhận — trừ nguồn, cộng đích, ghi 2 dòng txn) ─────

export const confirmWarehouseTransfer = async (id: number): Promise<WarehouseTransfer | undefined> => {
  await mockDelay();
  const now = new Date().toISOString();

  mockStore.update((s: any) => {
    const t = (s.warehouseTransfers ?? []).find((x: any) => x.id === id);
    if (!t || t.status !== 'PENDING') return; // chặn double-confirm

    if (!s.mfgWarehouseItems) s.mfgWarehouseItems = [];
    if (!s.mfgWarehouseTxns) s.mfgWarehouseTxns = [];

    t.items.forEach((it: any) => {
      const materialNorm = norm(it.materialName);
      const khung = isKhung(it.materialName);

      // 1) Trừ tồn kho nguồn — clamp lại lần nữa phòng tồn đã đổi giữa lúc tạo và lúc xác nhận.
      // Với khung xuất từ vật tư thành phẩm: chỉ được trừ vào dòng "đã đan", không đụng dòng "chưa đan".
      const srcRow = s.mfgWarehouseItems.find((w: any) =>
        w.warehouseId === t.fromWarehouseId && norm(w.name) === materialNorm && manhEligibleToSend(w, t.fromWarehouseCode)
      );
      const actualQty = Math.min(it.quantity, srcRow?.quantity ?? 0);
      if (srcRow) srcRow.quantity = Math.max(0, srcRow.quantity - actualQty);

      // 2) Cộng tồn kho đích — hàng mới về luôn ở trạng thái "chưa đan" (nếu là khung), tạo dòng mới
      // nếu đích chưa có dòng "chưa đan" nào của vật tư này (không gộp nhầm vào dòng "đã đan" có sẵn).
      const dstRow = s.mfgWarehouseItems.find((w: any) =>
        w.warehouseId === t.toWarehouseId && norm(w.name) === materialNorm &&
        (khung ? (w.manhStatus ?? 'chua-dan') === 'chua-dan' : true)
      );
      if (dstRow) {
        dstRow.quantity = (dstRow.quantity ?? 0) + actualQty;
      } else {
        s.mfgWarehouseItems.push({
          id: nextId(), warehouseId: t.toWarehouseId, materialId: null, name: it.materialName, unit: it.unit, quantity: actualQty, code: null,
          ...(khung ? { manhStatus: 'chua-dan' } : {}),
        });
      }

      // 3) Ghi 2 dòng nhật ký — EXPORT tại nguồn, IMPORT tại đích
      s.mfgWarehouseTxns.push({
        id: nextId(), warehouseId: t.fromWarehouseId, type: 'EXPORT', quantity: actualQty,
        refCode: t.code, note: `Chuyển kho sang ${t.toWarehouseName}`, date: now,
        item: { name: it.materialName, unit: it.unit },
      });
      s.mfgWarehouseTxns.push({
        id: nextId(), warehouseId: t.toWarehouseId, type: 'IMPORT', quantity: actualQty,
        refCode: t.code, note: `Nhận chuyển kho từ ${t.fromWarehouseName}`, date: now,
        item: { name: it.materialName, unit: it.unit },
      });
    });

    // 4) Giải phóng reservation — hàng đã thực sự rời kho nguồn
    (s.mfgTransferReservations ?? []).forEach((r: any) => {
      if (r.sourceTransferId === t.id && r.status === 'ACTIVE') r.status = 'RELEASED';
    });

    t.status = 'CONFIRMED';
    t.confirmedAt = now;
  });

  return structuredClone(((mockStore.get() as any).warehouseTransfers ?? []).find((t: any) => t.id === id));
};

// Ghi chú: "xuất đan"/"nhập đan" (vật tư thành phẩm gửi mảnh chưa đan cho điểm đan, kho thành phẩm
// nhận mảnh đã đan về) giờ theo dõi qua bảng riêng theo PO/mảnh (xem manh.service.ts: xuatManh/
// nhapManh) thay vì trừ/cộng trực tiếp tồn kho mfgWarehouseItems như trước — lý do: 1 PO có nhiều
// dòng mảnh cần theo dõi luỹ kế xuất/nhập riêng biệt, và nhập đan phải đồng bộ với xuất đan (không
// được nhập vượt quá phần đã xuất), điều mà mô hình tồn kho theo tên vật tư không thể hiện được.

// ─── Reject (kho đích từ chối — KHÔNG mutate tồn kho ở đâu cả) ──────────────

export const rejectWarehouseTransfer = async (id: number, reason?: string): Promise<WarehouseTransfer | undefined> => {
  await mockDelay();
  const now = new Date().toISOString();

  mockStore.update((s: any) => {
    const t = (s.warehouseTransfers ?? []).find((x: any) => x.id === id);
    if (!t || t.status !== 'PENDING') return;
    t.status = 'REJECTED';
    t.rejectionReason = reason ?? null;
    t.rejectedAt = now;
    (s.mfgTransferReservations ?? []).forEach((r: any) => {
      if (r.sourceTransferId === t.id && r.status === 'ACTIVE') r.status = 'RELEASED';
    });
  });

  return structuredClone(((mockStore.get() as any).warehouseTransfers ?? []).find((t: any) => t.id === id));
};

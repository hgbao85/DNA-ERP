/**
 * Adapter PRODUCTION INVOICES: FE ⇄ BE thật (module `production-invoices`).
 * Map ngược `prodApprovalStatus` (field phẳng ở BE) thành `prodApproval` (object lồng, đúng
 * shape mock) để LenhSXPage/ThongKePagePlan không phải sửa lại UI. Lưu ý khác mock: tham số
 * "itemIdx" của mock (vị trí trong mảng) nay là `itemId` thật (id của ProductionInvoiceItem) —
 * mọi nơi gọi các hàm approve/reject/send-to-* phải truyền `item.id`, không phải index.
 * `stages` (FRAME/WEAVING/PACKAGING — lịch KHSX đặt riêng từng công đoạn/SKU, LenhSXPage "Sửa
 * thời hạn") lưu thật ở bảng `production_invoice_item_stages`, xem `updateProductionInvoiceItem`.
 * stageType đặt tên rõ nghĩa, KHÔNG trùng `MfgStage` (domain thực thi Phôi/Hàn/Sơn thật, chưa
 * tồn tại - không liên quan bảng này): `FRAME` = "Khung cơ khí" (mốc hoàn tất CẢ chuỗi
 * Phôi→Hàn→Sơn, không phải riêng công đoạn Hàn); `PACKAGING` = "Đóng gói" (đặt tên khác
 * `MfgStage.SON`=Sơn/painting thật để khỏi trùng nghĩa).
 */
import { http } from './core/http';

type StageType = 'FRAME' | 'WEAVING' | 'PACKAGING';

interface BeProductionInvoiceItem {
  id: number;
  productionInvoiceId: number;
  mfgProductId: number;
  factoryCode: string;
  productName: string;
  productVariantId: number | null;
  colorCode: string | null;
  quantity: number;
  materialDeadline: string | null;
  deliveryDeadline: string | null;
  stages: { stageType: StageType; deadline: string }[];
  prodApprovalStatus: 'WAITING_QLSX' | 'WAITING_BOSS' | 'APPROVED' | 'REJECTED' | null;
  requestedAt: string | null;
  requestedById: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  qlsxAt: string | null;
  qlsxById: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  rejectReason: string | null;
}

interface BeProductionInvoice {
  id: number;
  code: string;
  salesOrderId: number | null;
  salesOrderCode: string | null;
  status: 'PLANNING' | 'PRODUCING' | 'DONE' | 'CANCELLED';
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  items: BeProductionInvoiceItem[];
}

function toItem(it: BeProductionInvoiceItem) {
  return {
    id: it.id,
    quantity: it.quantity,
    productVariant: {
      colorCode: it.colorCode,
      mfgProduct: { name: it.productName, factoryCode: it.factoryCode },
    },
    materialDeadline: it.materialDeadline ?? undefined,
    deliveryDeadline: it.deliveryDeadline ?? undefined,
    status: undefined as string | undefined, // stage sản xuất/giao hàng — ngoài phạm vi domain này
    stages: it.stages.map((s) => ({ stageType: s.stageType, deadline: s.deadline })),
    prodApproval: it.prodApprovalStatus
      ? {
          status: it.prodApprovalStatus,
          requestedAt: it.requestedAt ?? undefined,
          requestedBy: it.requestedById ?? undefined,
          warehouseCode: it.warehouseCode ?? undefined,
          warehouseName: it.warehouseName ?? undefined,
          qlsxAt: it.qlsxAt ?? undefined,
          qlsxBy: it.qlsxById ?? undefined,
          decidedAt: it.decidedAt ?? undefined,
          decidedBy: it.decidedById ?? undefined,
          reason: it.rejectReason ?? undefined,
        }
      : undefined,
  };
}

function toPI(pi: BeProductionInvoice) {
  return {
    id: pi.id,
    code: pi.code,
    status: pi.status,
    exportOrderId: pi.salesOrderId ?? undefined,
    exportOrder: pi.salesOrderCode ? { poNumber: pi.salesOrderCode } : undefined,
    deadline: pi.deadline ?? pi.createdAt,
    items: pi.items.map(toItem),
    stages: [] as unknown[],
  };
}

export async function getProductionInvoices() {
  const res = await http.get<BeProductionInvoice[] | { data: BeProductionInvoice[] }>('/production-invoices?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toPI);
}

export async function getProductionInvoice(id: number | string) {
  return toPI(await http.get<BeProductionInvoice>(`/production-invoices/${id}`));
}

/** Cập nhật `deadline` chung của cả PO. Mốc riêng từng SKU (materialDeadline/deliveryDeadline/
 *  stages) đi qua `updateProductionInvoiceItem` — xem LenhSXPage "Sửa thời hạn". */
export async function updateProductionInvoice(id: number | string, data: Record<string, unknown>) {
  return toPI(
    await http.patch<BeProductionInvoice>(`/production-invoices/${id}`, {
      deadline: data.deadline,
    }),
  );
}

/** Lưu thật materialDeadline/deliveryDeadline/stages riêng cho 1 SKU trong PI (LenhSXPage
 *  "Sửa thời hạn") — itemId = ProductionInvoiceItem.id thật. */
export async function updateProductionInvoiceItem(
  piId: number | string,
  itemId: number | string,
  data: { materialDeadline?: string; deliveryDeadline?: string; stages?: { stageType: StageType; deadline: string }[] },
) {
  return toItem(
    await http.patch<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}`, {
      materialDeadline: data.materialDeadline,
      deliveryDeadline: data.deliveryDeadline,
      stages: data.stages,
    }),
  );
}

/** itemId = ProductionInvoiceItem.id thật (KHÔNG phải index trong mảng như mock cũ). */
export async function sendItemToQlsx(piId: number | string, itemId: number | string, _requestedBy?: string) {
  return toItem(await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/send-to-qlsx`));
}

export async function sendItemToBoss(
  piId: number | string,
  itemId: number | string,
  warehouse: { code: string; name: string },
  _sentBy?: string,
) {
  return toItem(
    await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/send-to-boss`, {
      warehouseCode: warehouse.code,
      warehouseName: warehouse.name,
    }),
  );
}

export async function approveItemByBoss(piId: number | string, itemId: number | string, _decidedBy?: string) {
  return toItem(await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/approve`));
}

export async function rejectProdItem(piId: number | string, itemId: number | string, reason: string, _decidedBy?: string) {
  return toItem(
    await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/reject`, { reason }),
  );
}

/** QLSX từ chối ngay ở bước chọn kho (chưa kịp gửi Sếp) - SKU quay lại cho KHSX sửa thời hạn,
 *  cùng hệ quả với `rejectProdItem` (Sếp từ chối), khác đường gọi vì BE tách quyền theo mfgRole. */
export async function rejectProdItemByQlsx(piId: number | string, itemId: number | string, reason: string, _decidedBy?: string) {
  return toItem(
    await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/reject-by-qlsx`, { reason }),
  );
}

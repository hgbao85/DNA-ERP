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
  id: string;
  productionInvoiceId: string;
  /** PO gốc của riêng SKU này - PI gộp chứa SKU của nhiều PO nên PI cha không cho biết được. */
  salesOrderId: string | null;
  salesOrderCode: string | null;
  mfgProductId: string;
  factoryCode: string;
  productName: string;
  productVariantId: string | null;
  colorCode: string | null;
  quantity: number;
  materialDeadline: string | null;
  deliveryDeadline: string | null;
  stages: { stageType: StageType; deadline: string }[];
  prodApprovalStatus: 'WAITING_QLSX' | 'WAITING_BOSS' | 'APPROVED' | 'REJECTED' | null;
  requestedAt: string | null;
  requestedById: string | null;
  warehouseCode: string | null;
  warehouseName: string | null;
  qlsxAt: string | null;
  qlsxById: string | null;
  decidedAt: string | null;
  decidedById: string | null;
  rejectReason: string | null;
  /** null = chưa từng tính (SKU chưa duyệt). Có giá trị CALCULATING = đang chờ solver, xem toItem(). */
  cuttingProposalStatus?: 'CALCULATING' | 'DRAFT' | 'FAILED' | 'APPROVED' | null;
  cuttingProposalRequestedAt?: string | null;
  /** null = chưa duyệt HOẶC đã APPROVED nhưng tạo lệnh sản xuất thất bại (SKU "kẹt", race hiếm -
   *  xem retryProductionOrder() bên dưới). Không suy được từ prodApprovalStatus vì cả 2 ca đều
   *  hiện "đã duyệt" như nhau. */
  productionOrderId?: string | null;
}

interface BeProductionInvoice {
  id: string;
  code: string;
  salesOrderId: string | null;
  salesOrderCode: string | null;
  status: 'PLANNING' | 'PRODUCING' | 'DONE' | 'CANCELLED';
  /** true = đợt gộp do KHSX tạo (nhiều SKU cắt chung), khác PI vỏ 1-1 Sales tự sinh theo mỗi đơn. */
  isMerged: boolean;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  items: BeProductionInvoiceItem[];
}

function toItem(it: BeProductionInvoiceItem) {
  return {
    id: it.id,
    salesOrderId: it.salesOrderId ?? undefined,
    salesOrderCode: it.salesOrderCode ?? undefined,
    quantity: it.quantity,
    productVariant: {
      colorCode: it.colorCode,
      mfgProduct: { name: it.productName, factoryCode: it.factoryCode },
    },
    materialDeadline: it.materialDeadline ?? undefined,
    deliveryDeadline: it.deliveryDeadline ?? undefined,
    status: undefined as string | undefined, // stage sản xuất/giao hàng — ngoài phạm vi domain này
    stages: it.stages.map((s) => ({ stageType: s.stageType, deadline: s.deadline })),
    cuttingProposalStatus: it.cuttingProposalStatus ?? null,
    cuttingProposalRequestedAt: it.cuttingProposalRequestedAt ?? null,
    productionOrderId: it.productionOrderId ?? null,
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
    isMerged: pi.isMerged,
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

/** Gửi CẢ phiếu (mọi SKU chưa gửi / bị QLSX trả lại) trong 1 lần — thay cho việc mở hộp thoại chọn
 *  lại từng SKU. `itemIds` bỏ trống = gửi hết; truyền vào khi người dùng bỏ tick vài SKU. BE luôn
 *  bỏ qua SKU không đủ điều kiện (kể cả có trong itemIds), ném 409 nếu không còn SKU nào gửi được. */
export async function sendPiToQlsx(piId: number | string, itemIds?: string[]) {
  return http.post<BeProductionInvoice>(
    `/production-invoices/${piId}/send-to-qlsx-batch`,
    itemIds?.length ? { itemIds } : {},
  );
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

/** Gửi CẢ phiếu lên Sếp — mọi SKU đang chờ QLSX, dùng CHUNG 1 kho thành phẩm. Ca hiếm cần kho
 *  khác nhau theo từng SKU thì vẫn dùng sendItemToBoss() lẻ như cũ. */
export async function sendPiToBoss(
  piId: number | string,
  warehouse: { code: string; name: string },
  itemIds?: string[],
) {
  return http.post<BeProductionInvoice>(`/production-invoices/${piId}/send-to-boss-batch`, {
    warehouseCode: warehouse.code,
    warehouseName: warehouse.name,
    ...(itemIds?.length ? { itemIds } : {}),
  });
}

export async function approveItemByBoss(piId: number | string, itemId: number | string, _decidedBy?: string) {
  return toItem(await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/approve`));
}

/** Vá SKU "kẹt" - đã APPROVED nhưng lệnh sản xuất tạo thất bại (race hiếm, item.productionOrderId
 *  = null dù prodApproval.status = APPROVED). Tạo lại ProductionOrder + trigger lại đề xuất cắt
 *  sắt/mua vật tư, xem ProductionInvoicesService.retryProductionOrder() (BE, đính chính 2026-08-29). */
export async function retryProductionOrder(piId: number | string, itemId: number | string) {
  return toItem(
    await http.post<BeProductionInvoiceItem>(
      `/production-invoices/${piId}/items/${itemId}/retry-production-order`,
    ),
  );
}

export async function rejectProdItem(piId: number | string, itemId: number | string, reason: string, _decidedBy?: string) {
  return toItem(
    await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/reject`, { reason }),
  );
}

/** QLSX từ chối ngay ở bước chọn kho (chưa kịp gửi Sếp) - SKU quay lại cho KHSX sửa thời hạn,
 *  cùng hệ quả với `rejectProdItem` (Sếp từ chối), khác đường gọi vì BE tách quyền theo mfgRole.
 *  @deprecated Không còn dùng trên UI (2026-08-24, "duyệt theo PI, không theo từng SKU") - giữ
 *  lại vì BE vẫn còn route, dùng rejectPiByQlsx() thay thế. */
export async function rejectProdItemByQlsx(piId: number | string, itemId: number | string, reason: string, _decidedBy?: string) {
  return toItem(
    await http.post<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}/reject-by-qlsx`, { reason }),
  );
}

/** QLSX từ chối CẢ PHIẾU (mọi SKU đang chờ mình xử lý) trong 1 lần - "duyệt theo PI, không theo
 *  từng SKU" (2026-08-24), cùng tinh thần sendPiToBoss() ở trên. */
export async function rejectPiByQlsx(piId: number | string, reason: string) {
  return http.post<BeProductionInvoice>(`/production-invoices/${piId}/reject-qlsx-batch`, { reason });
}

// ─── Đợt gộp (PI.isMerged): Sếp quyết CẢ CỤM, không quyết lẻ từng SKU ────────────
// Cả nhóm nằm chung một cây sắt nên duyệt/bác nửa nhóm là vô nghĩa - xem BE approveBatch/rejectBatch.

/** Duyệt cả đợt gộp. BE tự tạo lệnh SX cho từng SKU rồi chạy solver MỘT LẦN cho cả nhóm. */
export async function approveBatchByBoss(piId: number | string) {
  return toPI(await http.post<BeProductionInvoice>(`/production-invoices/${piId}/approve-batch`));
}

/** Từ chối cả đợt gộp: PI bị XOÁ, các SKU trả về đơn hàng gốc kèm lý do và quay lại màn Tối ưu cắt sắt. */
export async function rejectBatchByBoss(piId: number | string, reason: string) {
  return http.post<{ movedItemIds: string[] }>(`/production-invoices/${piId}/reject-batch`, {
    reason,
  });
}

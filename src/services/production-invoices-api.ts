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
import type { SolverMachine } from '../types/admin';
import type { MaterialChoice } from '../types/sku';

/** FRAME_PHOI/FRAME_HAN/FRAME_SON (2026-09-09): mốc kế hoạch RIÊNG cho Phôi/Hàn/Sơn - xem
 *  LenhSXPage "Sửa thời hạn". Mỗi giá trị enum chỉ có 1 `deadline` như FRAME/WEAVING/PACKAGING
 *  (2026-09-11 lần 2, đồng bộ lại - bỏ hẳn `startDate`/khái niệm "khoảng thời gian" đã thử trước
 *  đó, xem doc comment schema.prisma BE ProdItemStageType). */
type StageType = 'FRAME' | 'WEAVING' | 'PACKAGING' | 'FRAME_PHOI' | 'FRAME_HAN' | 'FRAME_SON';

interface BeProductionInvoiceItem {
  id: string;
  productionInvoiceId: string;
  /** PO gốc của riêng SKU này - PI gộp chứa SKU của nhiều PO nên PI cha không cho biết được. */
  salesOrderId: string | null;
  salesOrderCode: string | null;
  customerName: string | null;
  mfgProductId: string;
  factoryCode: string;
  productName: string;
  productVariantId: string | null;
  colorCode: string | null;
  /** Loại dây (mã SHT)/loại nệm Sales chọn cho dòng này - null khi SKU không có lựa chọn. */
  wireMaterial?: MaterialChoice | null;
  cushionMaterial?: MaterialChoice | null;
  quantity: number;
  materialDeadline: string | null;
  /** "Mua VT còn lại" (2026-10-27) - BE cũ chưa có cột thì thiếu hẳn field. */
  finishedMaterialDeadline?: string | null;
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
  /** QLSX kiểm soát qua nút Bắt đầu/Kết thúc ở "Bảng thống kê" (2026-08-31) - null cùng lúc với
   *  productionOrderId null. */
  floorStage?: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'FINISHED' | null;
  /** true = định mức đã ghim cho SKU này KHÁC bản ACTIVE hiện tại của sản phẩm - QLSX bấm "Nạp
   *  lại định mức" (resyncProductionOrderBom() ở production-batches-api.ts). Cùng idiom
   *  floorStage - null cùng lúc với productionOrderId null. */
  bomOutOfDate?: boolean | null;
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
  /** Thông số cắt KHSX đề nghị cho đợt này ở "Tối ưu cắt sắt" — Sếp thấy trên màn duyệt lệnh sản
   *  xuất và chấp thuận bằng chính nút Duyệt. null hết = không xin gì đặc biệt. */
  solverMaxWastePctOverride: number | null;
  solverAllowCustomLength: boolean | null;
  /** Máy cắt KHSX chọn cho đợt này ở "Tối ưu cắt sắt". null = theo mặc định của hệ thống. */
  solverMachine?: SolverMachine | null;
  solverOverrideReason: string | null;
  /** Bằng chứng chụp lúc KHSX xin — loại sắt vướng nhất, ước tính hao hụt, ngưỡng thường. Để Sếp
   *  thấy con số xin hợp lý hay thừa ngay trên màn duyệt (solver chưa chạy nên chưa có số thật). */
  solverOverrideEvidence: {
    materialCode: string;
    estimatedWastePct: number;
    normalThresholdPct: number;
    /** Cây mà estimatedWastePct được tính trên đó. Thiếu (bản ghi cũ) = cây chuẩn công ty. */
    stockLengthMm?: number | null;
    /** true = hao hụt THẬT của phương án đã tính (PI tạo từ phương án, 2026-10-24); thiếu/false = ước tính cận dưới. */
    fromProposal?: boolean;
  } | null;
  /** Phương án cắt neo PI (luồng "Solve trước → tạo PI", 2026-09-30): có sẵn từ lúc tạo PI nên
   *  QLSX/Sếp duyệt trên số thật. null = chưa có (PI theo luồng cũ, solver chạy sau khi Sếp duyệt). */
  cuttingPlan?: {
    proposalId: string;
    status: string;
    totalBars: number | null;
    wastePercentage: number | null;
    /** Có loại sắt vượt ngưỡng hao hụt - QLSX/Sếp phải thấy cảnh báo trước khi duyệt. */
    hasOverThreshold?: boolean;
    /** Máy cắt đã dùng tính phương án (đã quy đổi theo mặc định) - để Sếp thấy dù KHSX không chọn riêng. */
    machine?: SolverMachine | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  items: BeProductionInvoiceItem[];
}

function toItem(it: BeProductionInvoiceItem) {
  return {
    id: it.id,
    mfgProductId: it.mfgProductId,
    salesOrderId: it.salesOrderId ?? undefined,
    salesOrderCode: it.salesOrderCode ?? undefined,
    customerName: it.customerName ?? undefined,
    wireMaterial: it.wireMaterial ?? null,
    cushionMaterial: it.cushionMaterial ?? null,
    quantity: it.quantity,
    productVariant: {
      colorCode: it.colorCode,
      mfgProduct: { name: it.productName, factoryCode: it.factoryCode },
    },
    materialDeadline: it.materialDeadline ?? undefined,
    finishedMaterialDeadline: it.finishedMaterialDeadline ?? undefined,
    deliveryDeadline: it.deliveryDeadline ?? undefined,
    status: undefined as string | undefined, // stage sản xuất/giao hàng — ngoài phạm vi domain này
    stages: it.stages.map((s) => ({ stageType: s.stageType, deadline: s.deadline })),
    cuttingProposalStatus: it.cuttingProposalStatus ?? null,
    cuttingProposalRequestedAt: it.cuttingProposalRequestedAt ?? null,
    productionOrderId: it.productionOrderId ?? null,
    floorStage: it.floorStage ?? null,
    bomOutOfDate: it.bomOutOfDate ?? null,
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

/** "Hạn hoàn thành" của cả PI (2026-10-09) - MỘT nguồn cho mọi màn KHSX/QLSX/Sếp: hạn giao SỚM NHẤT
 *  trong các SKU (cùng ý BE "cả nhóm cắt cùng lúc nên theo SKU gấp nhất", và cột "Hạn giao (sớm
 *  nhất)" của QLSX). Trước đây danh sách đọc `pi.deadline ?? createdAt` (PI gộp "solve trước" tạo với
 *  deadline null -> hiện NGÀY TẠO) còn trang chi tiết tự tính hạn giao MUỘN NHẤT -> 2 chỗ 2 ngày.
 *  Chỉ rơi về `pi.deadline` (rồi createdAt) khi chưa SKU nào có hạn giao. */
function piDisplayDeadline(pi: BeProductionInvoice): string {
  const dls = pi.items.map((it) => it.deliveryDeadline).filter((d): d is string => !!d).sort()
  return dls[0] ?? pi.deadline ?? pi.createdAt
}

/** Ngày lịch (giờ máy) của 1 mốc ISO - so "khác ngày" theo lịch chứ không theo từng mili-giây. */
function localDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Hạn giao MUỘN NHẤT trong các SKU của PI (2026-10-24) - đi cặp với `piDisplayDeadline` (sớm nhất) để
 *  đợt gộp hiện KHOẢNG "12/11 → 14/11" thay vì một ngày che mất độ lệch giữa các SKU. null khi các SKU
 *  chỉ có <2 ngày giao khác nhau (không có khoảng nào để hiện). */
function piLatestDeliveryDeadline(pi: BeProductionInvoice): string | null {
  const dls = pi.items.map((it) => it.deliveryDeadline).filter((d): d is string => !!d).sort()
  if (dls.length < 2) return null
  const earliest = dls[0]
  const latest = dls[dls.length - 1]
  return localDayKey(earliest) === localDayKey(latest) ? null : latest
}

function toPI(pi: BeProductionInvoice) {
  return {
    id: pi.id,
    code: pi.code,
    status: pi.status,
    isMerged: pi.isMerged,
    exportOrderId: pi.salesOrderId ?? undefined,
    exportOrder: pi.salesOrderCode ? { poNumber: pi.salesOrderCode } : undefined,
    deadline: piDisplayDeadline(pi),
    /** Hạn giao MUỘN NHẤT của các SKU, null khi <2 ngày khác nhau - xem piLatestDeliveryDeadline. */
    deadlineLatest: piLatestDeliveryDeadline(pi),
    solverMaxWastePctOverride: pi.solverMaxWastePctOverride ?? null,
    solverAllowCustomLength: pi.solverAllowCustomLength ?? null,
    solverMachine: pi.solverMachine ?? null,
    solverOverrideReason: pi.solverOverrideReason ?? null,
    solverOverrideEvidence: pi.solverOverrideEvidence ?? null,
    cuttingPlan: pi.cuttingPlan ?? null,
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
  data: {
    materialDeadline?: string;
    finishedMaterialDeadline?: string;
    deliveryDeadline?: string;
    stages?: { stageType: StageType; deadline: string }[];
  },
) {
  return toItem(
    await http.patch<BeProductionInvoiceItem>(`/production-invoices/${piId}/items/${itemId}`, {
      materialDeadline: data.materialDeadline,
      finishedMaterialDeadline: data.finishedMaterialDeadline,
      deliveryDeadline: data.deliveryDeadline,
      stages: data.stages,
    }),
  );
}

/** Lưu hạn của cả PI + mốc của TẤT CẢ SKU trong MỘT giao dịch (LenhSXPage "Sửa thời hạn", 2026-10-24) -
 *  thay cho `updateProductionInvoice` + từng `updateProductionInvoiceItem` song song. Lý do: luật "mốc
 *  cần sắt của SKU trong đợt gộp nằm trong khung N ngày, chênh tối đa N-1" chỉ kiểm được trên TOÀN BỘ mốc sau khi sửa; lưu
 *  lẻ từng SKU thì trạng thái giữa chừng luôn vi phạm. Vi phạm -> BE trả 400 kèm câu tiếng Việt (nêu SKU
 *  sớm nhất/muộn nhất) và KHÔNG lưu gì; ném ApiError như mọi lời gọi khác, `.message` là câu đó. */
export async function updateProductionInvoiceItemsDeadlines(
  piId: number | string,
  body: {
    deadline?: string;
    items: {
      itemId: string;
      materialDeadline?: string;
      finishedMaterialDeadline?: string;
      deliveryDeadline?: string;
      stages?: { stageType: StageType; deadline: string }[];
    }[];
  },
) {
  return toPI(await http.patch<BeProductionInvoice>(`/production-invoices/${piId}/items-deadlines`, body));
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

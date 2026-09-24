/**
 * Adapter GỢI Ý GỘP ĐỢT CẮT: FE ⇄ BE thật (GET /cutting-batch-suggestions).
 *
 * Chỉ đọc - endpoint không ghi gì, không gọi solver, không đụng tồn kho. Tính lại mỗi lần gọi
 * (BE cố ý không cache) nên luôn phản ánh đúng các đơn Sales vừa tạo.
 */
import { http } from './core/http';

/**
 * Chiều dài cây sắt KHSX chọn cho riêng đợt này, theo TỪNG QUY CÁCH: `{ "<materialId>": <mm> }`.
 * Thiếu khoá nào thì loại sắt đó dùng chiều dài chuẩn của công ty (hiện 6000mm).
 */
export type StockLengthsByMaterial = Record<string, number>;

/**
 * Dựng query cho 2 endpoint GET: `"7:5850,6:6000"`.
 *
 * PHẢI dùng dạng chuỗi này, KHÔNG được để axios serialize object thành `[<id>]=<mm>`: `qs` bên
 * BE thấy khoá thuần số <= 20 thì hiểu là CHỈ SỐ MẢNG, rồi class-transformer nén mảng thưa nên
 * materialId bị xoá sạch trước khi tới code. Đo thật lúc live-test 2026-09-16: vật tư id 7 thì
 * lỗi 400, id 25 lại chạy - tức tính năng sống chết theo id vật tư to hay nhỏ. BE nay từ chối
 * thẳng dạng mảng kèm hướng dẫn, nên gửi sai sẽ thấy lỗi ngay chứ không âm thầm cắt nhầm cây.
 */
function toStockLengthsQuery(map?: StockLengthsByMaterial): string | undefined {
  const pairs = Object.entries(map ?? {}).map(([id, mm]) => `${id}:${mm}`);
  return pairs.length > 0 ? pairs.join(',') : undefined;
}

/**
 * Thông số cắt KHSX ĐỀ NGHỊ cho riêng một đợt, gửi kèm lúc tạo lệnh sản xuất. Sếp chấp thuận bằng
 * chính nút Duyệt lệnh sản xuất - không có cổng duyệt riêng.
 *
 * Bỏ trống hết = không xin gì đặc biệt, chạy ngưỡng thường + mặc định công ty.
 */
export interface SolverOverrideInput {
  /** Ngưỡng hao hụt đặc cách (%) cho đợt này. Chỉ NÂNG, không hạ ngưỡng của loại sắt nào. Dùng khi
   *  cây chuẩn không đạt ngưỡng thường mà đơn lại gấp (cây đặt riêng phải chờ NCC cán). */
  solverMaxWastePctOverride?: number;
  /** Cho solver đặt cây ngoài chiều dài chuẩn không. Đơn gấp thường để false. */
  solverAllowCustomLength?: boolean;
  /** BẮT BUỘC khi có solverMaxWastePctOverride — BE chặn nếu thiếu. Sếp đọc dòng này lúc duyệt. */
  solverOverrideReason?: string;
  /** Chiều dài cây chọn cho từng quy cách trong đợt này. Bỏ trống = cây chuẩn của công ty. */
  solverStockLengthsByMaterial?: StockLengthsByMaterial;
  /** Số giây solver được giải CHO MỖI LOẠI SẮT, riêng cho đợt này. Bỏ trống = mặc định công ty
   *  (SystemConfig.solverTimeLimitSeconds). Không cần lý do/duyệt - thuần ngân sách thời gian tính
   *  toán, không đổi kết quả cắt hay chi phí sắt. */
  solverTimeLimitSecondsOverride?: number;
}

/** Trạng thái duyệt sản xuất của SKU. null = Sales vừa tạo, KHSX chưa gửi QLSX. */
export type ProdApprovalStatus = 'WAITING_QLSX' | 'WAITING_BOSS' | 'APPROVED' | 'REJECTED';

export type CuttingBatchOutcome = 'FIXED_BY_MERGE' | 'UNFIXABLE_BY_MERGE';

export interface CuttingBatchOrder {
  productionInvoiceItemId: string;
  /** Mã đơn hàng khách (vd "PO-4") - đây là mã người dùng gọi là "PO". */
  salesOrderCode: string | null;
  /** null = chưa được KHSX gom vào PI nào (2026-08-20 - PI không còn tự sinh lúc Sales tạo PO). */
  productionInvoiceCode: string | null;
  mfgProductCode: string;
  mfgProductName: string | null;
  quantity: number;
  prodApprovalStatus: ProdApprovalStatus | null;
  deadline: string | null;
}

export interface CuttingBatchLevel {
  orderCount: number;
  orderLabels: string[];
  cutSizesMm: number[];
  stockLengthMm: number;
  /** GIỚI HẠN DƯỚI - hiển thị PHẢI kèm dấu "≥", không bao giờ trình bày như số sẽ đạt được. */
  minWastePct: number;
  minWastePerBarMm: number;
  /** Số cây khi cắt CHUNG cả nhóm. */
  minBars: number;
  /** Số cây nếu cắt RIÊNG từng đơn rồi cộng lại. */
  barsSeparate: number;
  /** barsSeparate − minBars. CÓ THỂ = 0 dù % giảm mạnh (số lượng nhỏ chưa đủ bớt trọn 1 cây). */
  barsSavedVsSeparate: number;
  /** Đơn hạn xa nhất phải cắt sớm bao nhiêu ngày. null = chỉ 1 đơn hoặc thiếu dữ liệu hạn. */
  daysCutEarly: number | null;
  meetsThreshold: boolean;
}

export interface CuttingBatchSuggestion {
  materialId: string;
  materialCode: string;
  materialName: string;
  thresholdPct: number;
  outcome: CuttingBatchOutcome;
  anchor: CuttingBatchOrder;
  orders: CuttingBatchOrder[];
  levels: CuttingBatchLevel[];
}

export async function getCuttingBatchSuggestions(): Promise<CuttingBatchSuggestion[]> {
  const res = await http.get<CuttingBatchSuggestion[] | { data: CuttingBatchSuggestion[] }>(
    '/cutting-batch-suggestions',
  );
  return Array.isArray(res) ? res : res.data;
}

// ── Bảng chọn của KHSX ────────────────────────────────────────────────────────

export interface CandidateMaterial {
  materialId: string;
  materialCode: string;
  materialName: string;
  /** Hao hụt khi SKU này cắt loại sắt đó MỘT MÌNH. Ý nghĩa phụ thuộc `verified`:
   *  - false: cận dưới LÝ TƯỞNG (giả định nguồn đoạn vô hạn) - hiển thị kèm dấu "≥".
   *  - true: số THẬT solver vừa xác minh cho đúng nhu cầu này - KHÔNG kèm "≥" nữa (2026-09-24). */
  standaloneWastePct: number;
  /** Chiều dài cây (mm) mà standaloneWastePct được tính TRÊN đó - đổi ô chọn chiều dài thì số
   *  này đổi theo. null = công ty khai nhiều cỡ chuẩn nên không có 1 cây duy nhất để nêu. Khi
   *  verified=true và vượt ngưỡng, đây là chiều dài mà solver tìm ra "tốt nhất có thể" - có thể
   *  KHÁC chiều dài KHSX đang chọn. */
  stockLengthMm: number | null;
  /** Số cây. verified=false: cận dưới (số nhỏ khiến standaloneWastePct lệch xa thực tế NHẤT -
   *  dùng để cảnh báo "cận dưới không đáng tin", xem isLowConfidence() ở GomDotCatPage.tsx).
   *  verified=true: số cây THẬT. */
  standaloneMinBars: number;
  thresholdPct: number;
  /** verified=false: standaloneWastePct > thresholdPct (so trực tiếp). verified=true với
   *  verifiedLengthSource='scan': KHÔNG suy được từ 2 số này - đọc verifiedLengthSource để biết lý
   *  do (có thể standaloneWastePct < thresholdPct mà overThreshold vẫn true, xem field dưới). */
  overThreshold: boolean;
  /** true = 2 field standaloneWastePct/standaloneMinBars ở trên là SỐ THẬT (BE vừa gọi solver xác
   *  minh riêng loại sắt này, không phải cận dưới ước tính) - xem changelog 2026-09-24 mục 19. */
  verified: boolean;
  /** CHỈ có ý nghĩa khi verified=true. "fixed" = cắt được ở đúng chiều dài đang chọn, mọi cây đều
   *  đạt ngưỡng - standaloneWastePct so trực tiếp với thresholdPct là đúng nghĩa. "scan" = KHÔNG
   *  cắt được ở chiều dài đó với luật "mọi cây đều ≤ ngưỡng" (sẽ cần đặt cây riêng khi solve thật)
   *  - standaloneWastePct lúc này là số TỐT NHẤT CÓ THỂ SAU KHI đã nới lỏng luật đó để tìm, có thể
   *  THẤP HƠN thresholdPct dù overThreshold=true (lý do đỏ là "không đạt luật mỗi cây", không phải
   *  "% > ngưỡng" - đã gây hiểu lầm thật lúc live-test, xem changelog mục 19.7). */
  verifiedLengthSource: 'fixed' | 'scan' | null;
  /** Mã SKU của các đơn KHÁC cũng dùng loại sắt này = danh sách "gộp được với ai". */
  mergeableWithSkus: string[];
}

export interface CuttingBatchCandidate {
  productionInvoiceItemId: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  quantity: number;
  salesOrderCode: string | null;
  /** null = chưa được KHSX gom vào PI nào (2026-08-20 - PI không còn tự sinh lúc Sales tạo PO). */
  productionInvoiceCode: string | null;
  deadline: string | null;
  prodApprovalStatus: ProdApprovalStatus | null;
  /** Lý do bị từ chối lần gần nhất - SKU quay lại bảng này sau khi Sếp bác một đợt gộp. */
  rejectReason: string | null;
  materials: CandidateMaterial[];
  /** false = sản phẩm chưa có định mức ACTIVE nên không tính được gì cho SKU này. */
  hasActiveBom: boolean;
}

export interface CuttingBatchCandidateList {
  items: CuttingBatchCandidate[];
  /** Tổ hợp hệ thống tự đề xuất - tick sẵn, KHSX vẫn sửa được. */
  recommendedItemIds: string[];
  /** Ngân sách thời gian tối đa cho CẢ đợt tính (giây). Dùng để tính "tối đa bao nhiêu phút/loại"
   *  rồi chặn ngay tại ô "Thời gian chạy tối đa" - xem GomDotCatPage (2026-09-23). */
  solverTimeoutSeconds: number;
  /** Mặc định công ty khi để trống ô "Thời gian chạy tối đa" (giây/loại sắt). */
  defaultTimeLimitSeconds: number;
}

export interface CuttingBatchPreviewLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  thresholdPct: number;
  /** Chiều dài cây (mm) dòng này được tính trên đó - xem CandidateMaterial.stockLengthMm. */
  stockLengthMm: number | null;
  contributingSkus: string[];
  cutSizesMm: number[];
  minWastePct: number;
  minBars: number;
  barsSeparate: number;
  barsSavedVsSeparate: number;
  meetsThreshold: boolean;
  daysCutEarly: number | null;
}

export interface CuttingBatchPreview {
  lines: CuttingBatchPreviewLine[];
  /** Tổng số cây bớt được trên MỌI loại sắt - con số trả lời "gộp có đáng không". */
  totalBarsSaved: number;
  daysCutEarly: number | null;
}

/**
 * Bảng ứng viên. `stockLengths` đổi thì MỌI con số trong bảng đổi theo - không chỉ % mà cả việc
 * loại sắt nào bị coi là vượt ngưỡng và tổ hợp hệ thống tick sẵn.
 */
export async function getCuttingBatchCandidates(
  stockLengths?: StockLengthsByMaterial,
): Promise<CuttingBatchCandidateList> {
  const q = toStockLengthsQuery(stockLengths);
  return http.get<CuttingBatchCandidateList>(
    q ? `/cutting-batch-candidates?stockLengthsByMaterial=${encodeURIComponent(q)}` : '/cutting-batch-candidates',
  );
}

/** Tính thử theo tổ hợp đang tick. POST vì danh sách id có thể dài - vẫn là thao tác CHỈ ĐỌC. */
export async function previewCuttingBatch(
  productionInvoiceItemIds: string[],
  stockLengths?: StockLengthsByMaterial,
): Promise<CuttingBatchPreview> {
  // POST nên gửi thẳng object: body là JSON, không đi qua bộ parse query nên không dính bẫy
  // mảng đã mô tả ở toStockLengthsQuery().
  return http.post<CuttingBatchPreview>('/cutting-batch-preview', {
    productionInvoiceItemIds,
    ...(stockLengths && Object.keys(stockLengths).length > 0
      ? { stockLengthsByMaterial: stockLengths }
      : {}),
  });
}

/**
 * CHỐT nhóm: gộp các SKU đã tick thành 1 lệnh sản xuất (PI) để cắt chung một đợt. Khác 2 hàm trên
 * - đây là thao tác GHI: tạo PI mới và chuyển các SKU sang đó.
 *
 * KHÔNG chạy solver ở bước này. Phương án cắt chỉ tính khi Sếp duyệt cả cụm, đúng luồng duyệt sẵn
 * có (yêu cầu Sếp 2026-08-14) - gộp xong PI đi tiếp qua màn "Lệnh sản xuất mới" như bình thường.
 */
export async function mergeCuttingBatch(
  productionInvoiceItemIds: string[],
  solver?: SolverOverrideInput,
): Promise<{ id: string; code: string }> {
  return http.post<{ id: string; code: string }>('/production-invoices/merge', {
    productionInvoiceItemIds,
    ...solver,
  });
}

/**
 * "Tạo lệnh sản xuất riêng cho SKU này" - đúng 1 SKU, không gộp gì cả. Trước đây (< 2026-08-20) đây là no-op vì PI
 * đã tự sinh sẵn 1-1 lúc Sales tạo PO; giờ PI chỉ sinh khi KHSX chủ động, nên nút này phải THẬT SỰ
 * tạo 1 PI thường cho đúng SKU đó (ProductionInvoicesService.claimSolo()).
 */
export async function claimSoloCuttingBatch(
  productionInvoiceItemId: string,
  solver?: SolverOverrideInput,
): Promise<{ id: string; code: string }> {
  return http.post<{ id: string; code: string }>(
    `/production-invoices/items/${productionInvoiceItemId}/claim-solo`,
    { ...solver },
  );
}

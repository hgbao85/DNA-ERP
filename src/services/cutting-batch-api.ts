/**
 * Adapter GỢI Ý GỘP ĐỢT CẮT: FE ⇄ BE thật (GET /cutting-batch-suggestions).
 *
 * Chỉ đọc - endpoint không ghi gì, không gọi solver, không đụng tồn kho. Tính lại mỗi lần gọi
 * (BE cố ý không cache) nên luôn phản ánh đúng các đơn Sales vừa tạo.
 */
import type { MaterialChoice } from '../types/sku';
import { http } from './core/http';
import type { SolverMachine } from '../types/admin';
import type { CuttingBundleSummary, PatternBundles } from './cutting-proposals-api';

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
  /** Máy cắt cho đợt này: 'laser' = MC Laser (từng cây), 'tu_dong' = MC Tự động (theo bó). Bỏ trống/null =
   *  theo mặc định của hệ thống (SystemConfig.solverMachine). Đứng độc lập với chế độ cắt - áp cho cả hai chế độ. */
  solverMachine?: SolverMachine | null;
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

export async function getCuttingBatchSuggestions(solverMachine?: SolverMachine | null): Promise<CuttingBatchSuggestion[]> {
  const res = await http.get<CuttingBatchSuggestion[] | { data: CuttingBatchSuggestion[] }>(
    solverMachine ? `/cutting-batch-suggestions?solverMachine=${solverMachine}` : '/cutting-batch-suggestions',
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
  /** Loại dây (mã SHT)/loại nệm Sales chọn cho dòng này - CHỈ để phân biệt 2 dòng cùng SKU khác dây
   *  (dây/nệm không ảnh hưởng cắt sắt nên vẫn gộp chung được). */
  wireMaterial?: MaterialChoice | null;
  cushionMaterial?: MaterialChoice | null;
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
  /** Tổ hợp hệ thống tự đề xuất - tick sẵn, KHSX vẫn sửa được. Từ 2026-10-24 = đúng 1 SKU (đơn có mốc cần sắt sớm nhất đang có
   *  chip đỏ); trang tự thêm các đơn gợi ý gộp của getCuttingBatchFixOptions cho đợt đó. */
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
  solverMachine?: SolverMachine | null,
  /** deepVerify = lượt KIỂM BÙ chạy nền (2026-10-24): BE xác minh bằng bộ giải cả các chip lượt nhanh chưa kịp - lâu hơn (tới ~90 s). */
  opts?: { deepVerify?: boolean },
): Promise<CuttingBatchCandidateList> {
  const q = toStockLengthsQuery(stockLengths);
  // Máy KHSX chọn cho đợt: số ước tính + số xác minh phải tính theo đúng máy đó. "Theo mặc định" (null) thì không gửi.
  const params = [
    q ? `stockLengthsByMaterial=${encodeURIComponent(q)}` : null,
    solverMachine ? `solverMachine=${solverMachine}` : null,
    opts?.deepVerify ? 'deepVerify=true' : null,
  ].filter(Boolean);
  return http.get<CuttingBatchCandidateList>(
    params.length > 0 ? `/cutting-batch-candidates?${params.join('&')}` : '/cutting-batch-candidates',
    // Lượt kiểm bù chạy lâu hơn trần 20 s chung của http client (BE ngân sách 120 s) - không nới thì axios tự huỷ giữa chừng.
    opts?.deepVerify ? { timeout: DEEP_VERIFY_TIMEOUT_MS } : undefined,
  );
}

/** Trần chờ lượt kiểm bù chip (BE EXACT_CHECK_DEEP_BATCH_BUDGET_MS = 120 s + dư cho bài đang chạy dở). */
const DEEP_VERIFY_TIMEOUT_MS = 150_000;

/** Tính thử theo tổ hợp đang tick. POST vì danh sách id có thể dài - vẫn là thao tác CHỈ ĐỌC. */
export async function previewCuttingBatch(
  productionInvoiceItemIds: string[],
  stockLengths?: StockLengthsByMaterial,
  solverMachine?: SolverMachine | null,
): Promise<CuttingBatchPreview> {
  // POST nên gửi thẳng object: body là JSON, không đi qua bộ parse query nên không dính bẫy
  // mảng đã mô tả ở toStockLengthsQuery().
  return http.post<CuttingBatchPreview>('/cutting-batch-preview', {
    productionInvoiceItemIds,
    ...(stockLengths && Object.keys(stockLengths).length > 0
      ? { stockLengthsByMaterial: stockLengths }
      : {}),
    ...(solverMachine ? { solverMachine } : {}),
  });
}

/**
 * TẠO lệnh sản xuất (PI) từ phương án cắt ĐÃ TÍNH cho đúng tổ hợp SKU này: gộp các SKU thành 1 PI
 * để cắt chung một đợt. Khác 2 hàm đọc ở trên - đây là thao tác GHI: tạo PI mới và chuyển các SKU
 * sang đó.
 *
 * Luồng "Solve trước → tạo PI" (2026-09-30): cần `cuttingProposalId` của lượt tính đã xong, dùng
 * được và chưa lỗi thời (BE trả 409 kèm lý do nếu không). Thông số cắt KHÔNG gửi lại ở đây - đã
 * dùng lúc tính (requestCuttingBatchSolve). Sau đó PI đi tiếp QLSX → Sếp duyệt ĐÚNG phương án này,
 * solver không chạy lần nữa.
 */
export async function mergeCuttingBatch(
  productionInvoiceItemIds: string[],
  cuttingProposalId: string,
): Promise<{ id: string; code: string }> {
  return http.post<{ id: string; code: string }>('/production-invoices/merge', {
    productionInvoiceItemIds,
    cuttingProposalId,
  });
}

/**
 * "Tạo lệnh sản xuất riêng cho SKU này" - đúng 1 SKU, không gộp gì cả: tạo 1 PI thường từ phương
 * án đã tính riêng cho SKU đó (ProductionInvoicesService.claimSolo()).
 */
export async function claimSoloCuttingBatch(
  productionInvoiceItemId: string,
  cuttingProposalId: string,
): Promise<{ id: string; code: string }> {
  return http.post<{ id: string; code: string }>(
    `/production-invoices/items/${productionInvoiceItemId}/claim-solo`,
    { cuttingProposalId },
  );
}

// ── Solve trước → tạo lệnh sản xuất (2026-09-30) ─────────────────────────────

/** Trạng thái RÚT GỌN của 1 lượt tính (BE dẫn xuất, xem CuttingProposalDisplayStatus). */
export type CuttingSolveDisplayStatus = 'CALCULATING' | 'OK' | 'NEEDS_ACTION' | 'SUPERSEDED'

/** 1 SKU trong ảnh chụp đầu vào của lượt tính (BOM + số lượng TẠI THỜI ĐIỂM bấm Tính). */
export interface CuttingSolveItem {
  productionInvoiceItemId: string;
  mfgProductCode: string;
  mfgProductName: string | null;
  salesOrderCode: string | null;
  quantity: number;
}

/** 1 kiểu cắt: các đoạn trên MỘT cây và số cây cắt theo kiểu đó. */
export interface CuttingSolvePattern {
  id: string;
  patternIndex: number;
  barCount: number;
  wastePerBarMm: number | null;
  segments: { segmentSpecId: string; cutLengthMm: number; countPerBar: number }[];
  /** Cách cắt theo bó (MC Tự động) - xem PatternBundles. null/thiếu = cắt từng cây. */
  bundles?: PatternBundles | null;
}

/** 1 cỡ đoạn của loại sắt: cần bao nhiêu, phương án cắt ra bao nhiêu, và là mảnh gì. */
export interface CuttingSolvePieceSummary {
  size: number;
  demand: number;
  produced: number;
  names: string[];
}

/** 1 loại sắt trong kết quả tính. */
export interface CuttingSolveLine {
  materialId: string;
  materialCode: string;
  materialName: string;
  unit: string;
  feasible: boolean;
  bestStockLengthMm: number | null;
  /** "fixed" = cây chuẩn; "scan" = cây ĐẶT RIÊNG (phải chờ NCC cán). */
  lengthSource: 'fixed' | 'scan' | null;
  totalBars: number | null;
  wastePercentage: number | null;
  /** Ngưỡng đã áp khi tính (đã gồm đặc cách của đợt). */
  maxWastePctThreshold: number | null;
  overThreshold: boolean | null;
  /** Mức hao hụt MẶC ĐỊNH của công ty lúc xem (khác `maxWastePctThreshold` - có thể là trần 100% của chế độ đơn gấp). */
  normalWastePctThreshold?: number;
  /** Hao hụt thật đã VƯỢT mức mặc định (chỉ lọt vì chế độ "Chấp nhận hao hụt cao hơn"). */
  usedWasteOverride?: boolean;
  timedOut: boolean | null;
  solveSeconds: number | null;
  /** Câu tiếng Việt BE dựng sẵn - null khi dòng không cần xử lý. */
  displayReason: string | null;
  /** Các đoạn cần cắt của loại sắt này (null/thiếu với phương án tính từ trước khi có field này). */
  pieceSummary?: CuttingSolvePieceSummary[] | null;
  /** Cách cắt từng cây. */
  patterns?: CuttingSolvePattern[];
  /** Máy cắt đã dùng tính dòng này. null/thiếu = lượt tính cũ. */
  machine?: SolverMachine | null;
  /** Chỉ có khi machine='tu_dong': tóm tắt số bó / cây cắt tay / lần cắt. */
  bundleSummary?: CuttingBundleSummary | null;
}

export interface CuttingBatchSolve {
  id: string;
  status: 'CALCULATING' | 'DRAFT' | 'APPROVED' | 'SUPERSEDED' | 'FAILED';
  displayStatus: CuttingSolveDisplayStatus;
  displayReason: string | null;
  totalBarsAll: number | null;
  wastePercentage: number | null;
  totalSolveSeconds: number | null;
  errorMessage: string | null;
  requestedAt: string;
  completedAt: string | null;
  items?: CuttingSolveItem[];
  lines?: CuttingSolveLine[];
  /** Có khi đang tính: các loại sắt SẼ được giải. */
  pendingMaterials?: { materialId: string; materialCode: string; materialName: string }[] | null;
  solverOptions?: SolverOverrideInput | null;
  /** Chỉ có ở lượt DRAFT: đã đủ điều kiện tạo lệnh sản xuất chưa, hoặc vì sao chưa. */
  invoiceReadiness?: { ready: boolean; reason: string | null; warning?: string | null } | null;
}

/**
 * KHSX bấm "Tính phương án cắt": chạy solver cho đúng tổ hợp SKU đang tick TRƯỚC khi có lệnh sản
 * xuất nào. Trả ngay lượt tính ở trạng thái đang tính - kết quả về sau (poll getCuttingBatchSolves).
 * Chỉ tính, KHÔNG tự duyệt, không đụng kho/mua.
 */
export async function requestCuttingBatchSolve(
  productionInvoiceItemIds: string[],
  solver?: SolverOverrideInput,
): Promise<CuttingBatchSolve> {
  return http.post<CuttingBatchSolve>('/cutting-batch-solve', {
    productionInvoiceItemIds,
    ...solver,
  });
}

/** Các lượt tính chưa được dùng để tạo lệnh sản xuất (mới nhất trước) - tiến độ + kết quả. */
export async function getCuttingBatchSolves(): Promise<CuttingBatchSolve[]> {
  return http.get<CuttingBatchSolve[]>('/cutting-batch-solves');
}

/** Xoá 1 lượt tính chưa dùng khỏi "Kết quả đã tính" (BE từ chối nếu đang tính / đã gắn lệnh sản xuất). */
export async function discardCuttingBatchSolve(id: string): Promise<void> {
  await http.del(`/cutting-batch-solves/${id}`)
}

// ── Ngưỡng hao hụt mặc định (2026-09-30) ─────────────────────────────────────

export interface CuttingDefaults {
  /** Ngưỡng hao hụt mặc định (%) áp cho loại sắt CHƯA có ngưỡng riêng (Admin > Vật tư). */
  solverMaxWastePercentage: number;
  /** Số trước lần đổi vừa rồi (null khi chỉ đọc). */
  previous: number | null;
  updatedAt: string;
  /** Máy cắt mặc định (SystemConfig.solverMachine) - KHSX không có quyền đọc /system-config nên cần BE trả kèm ở đây
   *  để ô chọn máy ghi được "Theo mặc định (MC …)". Thiếu = chưa biết, ô chỉ ghi "Theo mặc định". */
  solverMachine?: SolverMachine;
  /** Thông số máy cắt hiện tại (2026-10-24) - KHSX CHỈ XEM ở khối "Thông số máy cắt" (đóng sẵn); Admin sửa ở Cấu hình hệ thống.
   *  Cùng tên cột SystemConfig. Thiếu (BE cũ) = không hiện khối đó. */
  solverStockLengths?: number[];
  solverMaxSurplus?: number;
  solverTrimStartMm?: number;
  solverBladeWidthMm?: number;
  solverMctdTrimStartMm?: number;
  solverMctdBladeWidthMm?: number;
  solverBundleFactors?: number[];
  solverMaxManualCuts?: number;
  solverMaxSizesPerPattern?: number;
  /** Luật gộp (Sếp Nhân 2026-10-24): mốc cần sắt các SKU trong 1 đợt nằm trong khung N ngày TÍNH CẢ NGÀY ĐẦU (chênh ≤ N−1). */
  solverMergeWindowDays?: number;
  /** Luật gộp: tối đa M SKU mỗi đợt / lệnh gộp (mặc định 2). */
  solverMergeMaxSkus?: number;
}

export async function getCuttingDefaults(): Promise<CuttingDefaults> {
  return http.get<CuttingDefaults>('/system-config/cutting-defaults');
}

/**
 * KHSX đổi ngưỡng hao hụt mặc định cho cắt sắt. BE ghi lịch sử (ai đổi, từ bao nhiêu sang bao nhiêu)
 * và báo Sếp + QLSX; không cần duyệt. Chỉ áp cho lượt tính TỪ SAU (lượt đã tính giữ nguyên).
 */
export async function updateMaxWastePercentage(
  solverMaxWastePercentage: number,
  reason?: string,
): Promise<CuttingDefaults> {
  return http.put<CuttingDefaults>('/system-config/cutting-defaults/max-waste', {
    solverMaxWastePercentage,
    ...(reason && reason.trim() !== '' ? { reason: reason.trim() } : {}),
  });
}

// ── Khối "Đợt đang chọn" (2026-10-24) ─────────────────────────────────────────

/** 1 kết quả bộ giải gọn cho 1 cách xử lý. */
export interface CuttingBatchFixResult {
  wastePct: number;
  bars: number;
  lengthMm: number;
}

/** Gợi ý gộp thêm đơn cho 1 loại sắt vượt ngưỡng ở cây chuẩn (ít hao hụt nhất trong luật gộp). */
export interface CuttingBatchFixAdd {
  itemIds: string[];
  wastePct: number;
  bars: number;
  meetsThreshold: boolean;
  spanDaysAfter: number | null;
}

export interface CuttingBatchFixMaterial {
  materialId: string;
  materialCode: string;
  thresholdPct: number;
  stockLengthMm: number | null;
  status: 'ok' | 'over' | 'unknown';
  wastePct: number | null;
  bars: number | null;
  verifiedLengthSource: 'fixed' | 'scan' | null;
  itemIds: string[];
  addSuggestion: CuttingBatchFixAdd | null;
  addReason: string | null;
  /** không gộp: chế độ Bình thường tự đặt cây riêng */
  customLength: CuttingBatchFixResult | null;
  /** đơn gấp: vẫn mua cây chuẩn, không trần hao hụt */
  urgent: CuttingBatchFixResult | null;
}

export interface CuttingBatchFixOptions {
  windowDays: number;
  maxSkus: number;
  count: number;
  spanDays: number | null;
  ruleOk: boolean;
  ruleReason: string | null;
  materials: CuttingBatchFixMaterial[];
  addAllItemIds: string[] | null;
  addAllReason: string | null;
  incomplete: boolean;
}

/** BE ngân sách 60 s + dư cho bài đang chạy dở (http chung chỉ chờ 20 s). */
const FIX_OPTIONS_TIMEOUT_MS = 90_000;

/**
 * Khối "Đợt đang chọn": từng loại sắt của tổ hợp đang tick ở cây chuẩn (bộ giải thật) + cách xử lý khi vượt ngưỡng (gộp thêm đơn trong
 * luật gộp / đặt cây riêng / đơn gấp). CHỈ ĐỌC dù là POST.
 */
export async function getCuttingBatchFixOptions(
  productionInvoiceItemIds: string[],
  stockLengths?: StockLengthsByMaterial,
  solverMachine?: SolverMachine | null,
): Promise<CuttingBatchFixOptions> {
  return http.post<CuttingBatchFixOptions>(
    '/cutting-batch-fix-options',
    {
      productionInvoiceItemIds,
      ...(stockLengths && Object.keys(stockLengths).length > 0 ? { stockLengthsByMaterial: stockLengths } : {}),
      ...(solverMachine ? { solverMachine } : {}),
    },
    { timeout: FIX_OPTIONS_TIMEOUT_MS },
  );
}

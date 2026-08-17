/** Mảnh và chi tiết giờ là 2 nhánh độc lập, tiến song song (xem Sku.manhForwardedAt/
 *  detailForwardedAt) - status chỉ còn 3 giá trị pipeline thật sự dùng, không còn mã hoá "đang ở
 *  giai đoạn nào" theo thứ tự tuyến tính như trước (WAITING_PARTS/APPROVED_PARTS/WAITING_DETAIL/
 *  APPROVED_DETAIL đã gộp hết vào IN_PROGRESS). 'DRAFT' giữ lại trong union dù BE không bao giờ
 *  set (mirror đúng ghi chú schema.prisma) - nhiều trang kho (KhoChuyenKiemPage, XuatKhoPage...)
 *  đang lọc `status !== 'DRAFT'` như 1 lá chắn phòng thủ, không thuộc phạm vi đổi ở đây. REJECTED
 *  KHÔNG phải giá trị của field này - đó là giá trị của QuotaReviewStatus.status (quyết định
 *  duyệt/từ chối từng nhánh, xem bên dưới). */
export type SkuStatus = 'DRAFT' | 'IN_PROGRESS' | 'WAITING_BOSS_APPROVAL' | 'APPROVED';

export interface SatItem {
  id?: number;
  name: string;
  specifications?: string | null;
  thickness?: number | null;
  chieuDai?: string | null;
  unit?: string | null;
  quantity?: number | null;
  createdAt?: string | null;
}

export interface DaySonItem {
  id?: number;
  /** Việc 2: id thật của Material đứng sau dòng này (BE quan hệ thật, không còn JSON tự do). */
  materialId?: string;
  name: string;
  specifications?: string | null;
  kg?: number | null;
  unit?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
}

export interface VatTuPhuKienItem {
  id?: number;
  materialId?: string;
  name: string;
  specifications?: string | null;
  unit?: string | null;
  quantity?: number | null;
  imageUrl?: string | null;
  createdAt?: string | null;
}

export interface BaoBiDongGoiItem {
  id?: number;
  materialId?: string;
  name: string;
  specifications?: string | null;
  unit?: string | null;
  quantity?: number | null;
  imageUrl?: string | null;
  createdAt?: string | null;
}

export interface MaterialType {
  sat: SatItem[];
  daySon: DaySonItem[];
  vatTuPhuKien: VatTuPhuKienItem[];
  baoBiDongGoi: BaoBiDongGoiItem[];
}

/** 5 nhóm vật tư có thể xuất hiện bên trong 1 mảnh — Sắt (phân cấp: có segmentSpecId, chiều
 *  dài cắt) và Dây/Đinh/Tán rút/Nút nhựa (phẳng: chỉ materialId + qty, không
 *  có khái niệm cắt). Trước đây Dây/Đinh là 2 danh sách phẳng RIÊNG NGOÀI mảnh, do acc khác
 *  (SPEC_WIRE_PAINT) nhập — nay gộp làm children của từng mảnh, do acc Sắt nhập chung 1 lần. */
export type ManhChildGroup = 'sat' | 'day' | 'dinh' | 'tanRut' | 'nutNhua';

/** 7 công đoạn phôi chi tiết có thể áp dụng cho 1 thanh sắt (group='sat') - đa chọn, vd 1 thanh
 *  vừa tán vừa dập. Khớp enum ProcessStep ở BE (schema.prisma). */
export type ProcessStep = 'CAT' | 'UON' | 'DAP' | 'DUC_LO' | 'TAN' | 'TOP_DAU' | 'XE';

/** Ai nhập 1 nhóm định mức (chi tiết hoặc mảnh) và khi nào — phục vụ luồng account chuyên trách nhập liệu. */
export interface QuotaEntryMeta {
  enteredBy: string;
  enteredAt: string;
}

/** Kết quả KHSX duyệt/từ chối 1 nhóm định mức chi tiết — để account chuyên trách biết cần nhập lại. */
export interface QuotaReviewStatus {
  status: 'APPROVED' | 'REJECTED';
  reason?: string;
  reviewedAt: string;
}

/** 1 dòng vật tư thuộc 1 trong 5 nhóm của 1 mảnh — nhập sau bước "Tạo mảnh". `length` chỉ có
 *  ý nghĩa khi `group==='sat'` (đoạn cắt); 4 nhóm còn lại chỉ dùng `materialId` + `qty`. */
export interface ManhChildRow {
  id: number;
  group: ManhChildGroup;
  /** Việc 2: id thật của SegmentSpec (group='sat', Material nhóm Sắt + chiều dài cắt) đứng
   *  sau dòng này; các nhóm còn lại không có SegmentSpec (đi qua PieceMaterialItem ở BE). */
  segmentSpecId?: string;
  materialId?: string;
  name: string;
  specs?: string | null;
  /** Chỉ dùng khi group='sat'. */
  length?: string | null;
  qty?: string | null;
  /** Chỉ dùng khi group='sat'. */
  processSteps?: ProcessStep[];
  note?: string | null;
  unit?: string | null;
}

/** 1 mảnh phôi (vd "Mảnh tựa", "Chân ghế") gồm vật tư con thuộc 5 nhóm (Sắt/Dây/Đinh/Tán
 *  rút/Nút nhựa) — do account Sắt nhập theo 2 bước: tạo mảnh -> nhập vật tư. `needsHan`/
 *  `needsSon` áp dụng cho CẢ mảnh (không phải từng thanh sắt riêng lẻ). */
export interface ManhRow {
  id: number;
  /** Việc 2: id thật của Piece đứng sau mảnh này. */
  pieceId?: string;
  name: string;
  /** Số lượng mảnh này trên 1 SKU (vd 1 SKU cần 2 "Mảnh tay") */
  qtyPerSku?: string | null;
  needsHan?: boolean;
  needsSon?: boolean;
  children: ManhChildRow[];
}

export interface Sku {
  /** bigint-as-string thật từ BE — KHÔNG ép Number(). Khác id lồng trong manhData/quotaManagement
   *  (ManhRow.id, DaySonItem.id...) — BE tự ép Number() cho các id đó (an toàn, không phải PK cần
   *  tra chéo qua nhiều bảng), xem skus.service.ts toMaterialLine/toPiece. */
  id: string;
  /** SKU độc lập với Sales Order — null khi SKU chưa (hoặc không bao giờ) gắn đơn hàng nào. */
  exportOrderId: string | null;
  mfgProductId: string;
  status: SkuStatus;
  /** KHSX đã "chốt xong" nhánh mảnh/chi tiết chưa - null = chưa. 2 nhánh độc lập, tiến song song;
   *  khi CẢ HAI khác null thì status tự chuyển WAITING_BOSS_APPROVAL (xem SKUDetail.tsx). */
  manhForwardedAt?: string | null;
  detailForwardedAt?: string | null;
  /** Lý do Sếp từ chối ở lần gần nhất — null nếu chưa từng bị từ chối hoặc đã duyệt xong sau đó. */
  bossRejectReason?: string | null;
  note?: string | null;
  customerName?: string | null;
  /** Mã lệnh sản xuất (PI) — 1 SKU trong 1 PO chỉ có đúng 1 PI, luôn trỏ tới ProductionInvoice
   *  cùng exportOrderId+mfgProductId (xem skus.service.ts create) để "Bảng thống kê"
   *  hiện đúng dữ liệu của SKU đó. */
  piCode: string;
  productionInvoiceId?: string;
  /** Sku tạo tự động khi PM xác nhận sản xuất 1 SKU trong PI (LenhSXPage) — chỉ phục vụ
   *  "Lệnh kiểm tra vật tư" (prodmgr@demo.com), không phải SKU do KHSX tạo nên phải ẩn khỏi
   *  "Danh sách SKU" / "Duyệt SKU". */
  origin?: 'PRODUCTION_CONFIRM';
  createdAt: string;
  proposedAt?: string | null;
  exportOrder?: { id: string; poNumber: string; deliveryDate?: string };
  mfgProduct?: { id: string; factoryCode: string; name: string };
  createdBy?: { id: string; name: string };
  quotaManagement?: {
    id: string;
    materialType: MaterialType;
    /** Ai/khi nào nhập định mức chi tiết (nhập 1 lần cho cả 3 nhóm Sơn/Phụ kiện/Bao bì). */
    entryMeta?: QuotaEntryMeta;
    /** KHSX duyệt/từ chối định mức chi tiết — 1 quyết định duy nhất cho cả 3 nhóm. */
    reviewStatus?: QuotaReviewStatus;
  };
  /** Định mức mảnh — nhánh ĐỘC LẬP với định mức chi tiết (xem quotaManagement), không còn bắt
   *  buộc theo thứ tự nào. Danh sách mảnh, mỗi mảnh gồm children thuộc 5 nhóm vật tư (Sắt/Dây/
   *  Đinh/Tán rút/Nút nhựa), do 1 acc Sắt nhập chung 1 lần và gửi duyệt 1 lần. */
  manhData?: {
    pieces: ManhRow[];
  };
  /** Ai/khi nào nhập định mức mảnh (nhập 1 lần cho cả 5 nhóm). */
  manhEntryMeta?: QuotaEntryMeta;
  /** KHSX duyệt/từ chối định mức mảnh — tách biệt khỏi status vì status không còn phân biệt được
   *  "đang ở nhánh mảnh" hay "đang ở nhánh chi tiết" (2 nhánh độc lập, xem manhForwardedAt). */
  manhReviewStatus?: QuotaReviewStatus;
}

export interface CreateSkuPayload {
  /** Tuỳ chọn — SKU có thể tạo mà không gắn Sales Order nào. */
  exportOrderId?: string;
  mfgProductId: string;
  note?: string;
  customerName?: string;
  origin?: 'PRODUCTION_CONFIRM';
  /** Khi đã biết chắc PI nào ứng với SKU này (vd LenhSXPage duyệt xong 1 SKU), truyền thẳng id để
   *  tái dùng đúng PI đó thay vì service phải dò theo exportOrderId+SKU. */
  productionInvoiceId?: string;
}

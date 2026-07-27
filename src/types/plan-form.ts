export type PlanFormStatus = 'DRAFT' | 'WAITING_DETAIL' | 'WAITING_PARTS' | 'APPROVED_DETAIL' | 'APPROVED_PARTS' | 'WAITING_QLSX_APPROVAL' | 'WAITING_BOSS_APPROVAL' | 'APPROVED' | 'REJECTED';

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
  name: string;
  specifications?: string | null;
  kg?: number | null;
  unit?: string | null;
  imageUrl?: string | null;
  createdAt?: string | null;
}

export interface VatTuPhuKienItem {
  id?: number;
  name: string;
  specifications?: string | null;
  unit?: string | null;
  quantity?: number | null;
  imageUrl?: string | null;
  createdAt?: string | null;
}

export interface BaoBiDongGoiItem {
  id?: number;
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

/** 3 nhóm thuộc "định mức mảnh" — Sắt (phân cấp mảnh -> loại sắt con), Dây và Đinh (2 danh sách
 *  phẳng riêng, cùng shape DaySonItem nhưng khác đơn vị: Dây tính kg, Đinh tính cây). Dây/Đinh
 *  tách ra từ nhóm "Dây/Sơn/Đinh" chi tiết cũ. Nhập trước định mức chi tiết trong flow hiện tại. */
export type ManhGroup = 'sat' | 'day' | 'dinh';

/** Ai nhập 1 nhóm định mức (chi tiết hoặc mảnh) và khi nào — phục vụ luồng 4 account chuyên trách nhập liệu. */
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

/** 1 loại sắt thuộc 1 mảnh — nhập sau bước "Tạo mảnh". */
export interface ManhChildRow {
  id: number;
  name: string;
  specs?: string | null;
  length?: string | null;
  qty?: string | null;
}

/** 1 mảnh phôi (vd "Mảnh tựa", "Chân ghế") gồm nhiều loại sắt con — do account Sắt nhập theo 2 bước: tạo mảnh -> nhập sắt. */
export interface ManhRow {
  id: number;
  name: string;
  /** Số lượng mảnh này trên 1 SKU (vd 1 SKU cần 2 "Mảnh tay") */
  qtyPerSku?: string | null;
  children: ManhChildRow[];
}

export interface PlanForm {
  id: number;
  exportOrderId: number;
  mfgProductId: number;
  status: PlanFormStatus;
  note?: string | null;
  customerName?: string | null;
  /** Mã lệnh sản xuất (PI) — 1 SKU trong 1 PO chỉ có đúng 1 PI, luôn trỏ tới ProductionInvoice
   *  cùng exportOrderId+mfgProductId (xem plan-form.service.ts createForm) để "Bảng thống kê"
   *  hiện đúng dữ liệu của SKU đó. */
  piCode: string;
  productionInvoiceId?: number;
  /** PlanForm tạo tự động khi PM xác nhận sản xuất 1 SKU trong PI (LenhSXPage) — chỉ phục vụ
   *  "Lệnh kiểm tra vật tư" (prodmgr@demo.com), không phải SKU do KHSX tạo nên phải ẩn khỏi
   *  "Danh sách SKU" / "Duyệt SKU". */
  origin?: 'PRODUCTION_CONFIRM';
  createdAt: string;
  proposedAt?: string | null;
  exportOrder?: { id: number; poNumber: string; deliveryDate?: string };
  mfgProduct?: { id: number; factoryCode: string; name: string };
  createdBy?: { id: number; name: string };
  quotaManagement?: {
    id: number;
    materialType: MaterialType;
    /** Ai/khi nào nhập từng nhóm định mức chi tiết (sat/daySon/vatTuPhuKien/baoBiDongGoi) */
    entryMeta?: Partial<Record<keyof MaterialType, QuotaEntryMeta>>;
    /** KHSX duyệt/từ chối từng nhóm — account chuyên trách xem để biết cần sửa lại nhóm nào */
    reviewStatus?: Partial<Record<keyof MaterialType, QuotaReviewStatus>>;
  };
  /** Định mức mảnh — nhập TRƯỚC định mức chi tiết (xem quotaManagement). 3 nhóm độc lập: Sắt
   *  (phân cấp mảnh -> loại sắt con, do account Sắt nhập) và Dây/Đinh (2 danh sách phẳng riêng,
   *  cùng do account Dây/Sơn nhập, chỉ khác đơn vị: Dây kg, Đinh cây). */
  manhData?: {
    sat: ManhRow[];
    day: DaySonItem[];
    dinh: DaySonItem[];
  };
  /** Ai/khi nào nhập từng nhóm định mức mảnh (sat/day/dinh) */
  manhEntryMeta?: Partial<Record<ManhGroup, QuotaEntryMeta>>;
  /** KHSX duyệt/từ chối từng nhóm định mức mảnh — tách biệt khỏi status vì APPROVED_PARTS còn được
   *  set ngay khi account chuyên trách nhập xong (trước khi KHSX kịp xem), nên không thể dùng status
   *  để suy ra KHSX đã duyệt hay chưa. */
  manhReviewStatus?: Partial<Record<ManhGroup, QuotaReviewStatus>>;
  /** QLSX duyệt cục bộ ở bước WAITING_QLSX_APPROVAL — tách biệt khỏi status vì QLSX cần duyệt xong
   *  rồi mới bấm "Gửi sếp duyệt" để thực sự chuyển status sang WAITING_BOSS_APPROVAL (2 bước, giống
   *  cơ chế manhReviewStatus). */
  qlsxReviewStatus?: QuotaReviewStatus;
}

export interface CreatePlanFormPayload {
  exportOrderId: number;
  mfgProductId: number;
  note?: string;
  customerName?: string;
  origin?: 'PRODUCTION_CONFIRM';
  /** Khi đã biết chắc PI nào ứng với SKU này (vd LenhSXPage duyệt xong 1 SKU), truyền thẳng id để
   *  tái dùng đúng PI đó thay vì service phải dò theo exportOrderId+SKU. */
  productionInvoiceId?: number;
}

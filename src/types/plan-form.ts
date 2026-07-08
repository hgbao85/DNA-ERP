export type PlanFormStatus = 'DRAFT' | 'WAITING_DETAIL' | 'WAITING_PARTS' | 'APPROVED_DETAIL' | 'APPROVED_PARTS' | 'WAITING_BOSS_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface SatItem {
  id?: number;
  name: string;
  specifications?: string | null;
  thickness?: number | null;
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
  createdAt?: string | null;
}

export interface VatTuPhuKienItem {
  id?: number;
  name: string;
  specifications?: string | null;
  unit?: string | null;
  quantity?: number | null;
  createdAt?: string | null;
}

export interface BaoBiDongGoiItem {
  id?: number;
  name: string;
  specifications?: string | null;
  unit?: string | null;
  quantity?: number | null;
  createdAt?: string | null;
}

export interface MaterialType {
  sat: SatItem[];
  daySon: DaySonItem[];
  vatTuPhuKien: VatTuPhuKienItem[];
  baoBiDongGoi: BaoBiDongGoiItem[];
}

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
  children: ManhChildRow[];
}

export interface PlanForm {
  id: number;
  exportOrderId: number;
  mfgProductId: number;
  status: PlanFormStatus;
  note?: string | null;
  customerName?: string | null;
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
  manhItems?: ManhRow[];
  manhEntryMeta?: QuotaEntryMeta;
}

export interface CreatePlanFormPayload {
  exportOrderId: number;
  mfgProductId: number;
  note?: string;
  customerName?: string;
}

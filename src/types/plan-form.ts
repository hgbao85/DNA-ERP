export type PlanFormStatus = 'DRAFT' | 'WAITING_DETAIL' | 'WAITING_PARTS' | 'APPROVED_DETAIL' | 'APPROVED_PARTS' | 'APPROVED' | 'REJECTED';

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
  };
}

export interface CreatePlanFormPayload {
  exportOrderId: number;
  mfgProductId: number;
  note?: string;
  customerName?: string;
  materialType: {
    sat: { type: string; specifications?: string; thickness?: number };
    daySon: { kg?: number; specifications?: string; imageUrl?: string };
    vatTuPhuKien: { unit: string };
    baoBiDongGoi: { unit: string };
  };
}

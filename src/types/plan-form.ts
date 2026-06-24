export type PlanFormStatus = 'DRAFT' | 'PROPOSED' | 'APPROVED' | 'REJECTED';

export interface SatMaterial {
  id?: number;
  type: string;
  specifications?: string | null;
  thickness?: number | null;
}

export interface DaySonMaterial {
  id?: number;
  kg?: number | null;
  imageUrl?: string | null;
  specifications?: string | null;
}

export interface VatTuPhuKienMaterial {
  id?: number;
  unit: string;
}

export interface BaoBiDongGoiMaterial {
  id?: number;
  unit: string;
}

export interface MaterialType {
  sat: SatMaterial | null;
  daySon: DaySonMaterial | null;
  vatTuPhuKien: VatTuPhuKienMaterial | null;
  baoBiDongGoi: BaoBiDongGoiMaterial | null;
}

export interface PlanForm {
  id: number;
  exportOrderId: number;
  mfgProductId: number;
  status: PlanFormStatus;
  note?: string | null;
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
  materialType: {
    sat: { type: string; specifications?: string; thickness?: number };
    daySon: { kg?: number; specifications?: string; imageUrl?: string };
    vatTuPhuKien: { unit: string };
    baoBiDongGoi: { unit: string };
  };
}

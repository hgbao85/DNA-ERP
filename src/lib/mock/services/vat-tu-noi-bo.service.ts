/**
 * Mock API "Kho xuất vật tư nội bộ → Tổ Hàn/Sơn xác nhận đã nhận" — vật tư TIÊU HAO
 * (khí CO₂, dây hàn / bột sơn, dung môi…), KHÁC WIP (đoạn/khung). Đơn giản: KHÔNG KCS.
 *   - Phân phối nội bộ (kho):      xuatVatTu()        → tạo đợt CHO_NHAN.
 *   - Xác nhận sản lượng (tổ):     xacNhanNhanVatTu() → DA_NHAN + mốc thời gian (log history).
 * Persist localStorage như các service mock khác. Sau này analys: Σ soLuongNhan theo vật tư.
 */
import { mockDelay } from '../core/delay';

export type VatTuStage = 'HAN' | 'SON';

export interface VatTuDinhMuc {
  id: string; stage: VatTuStage; poNumber: string; sku: string;
  tenVatTu: string; dvt: string; can: number;
}
export interface VatTuIssue {
  id: string; stage: VatTuStage; poNumber: string; sku: string;
  tenVatTu: string; dvt: string; soLuong: number;
  xuatAt: string; status: 'CHO_NHAN' | 'DA_NHAN';
  nhanAt?: string; soLuongNhan?: number;
}

const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

const LS_ISSUES = 'vat_tu_noi_bo_issues_v2';
function loadJSON<T>(key: string, fb: () => T): T {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r) as T; } catch { /* SSR / quota */ }
  return fb();
}
function saveJSON(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
    window.dispatchEvent(new Event('mock-data-changed')); // báo realtime cùng tab
  } catch { /* SSR / quota */ }
}

// Định mức vật tư tiêu hao theo PO/tổ (tĩnh — demo).
const DINH_MUC: VatTuDinhMuc[] = [
  // HÀN
  { id: 'dm-h-co2-1', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55',  tenVatTu: 'Khí CO₂ (bình 25kg)', dvt: 'bình', can: 8 },
  { id: 'dm-h-day-1', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55',  tenVatTu: 'Dây hàn CO₂ Ø1.0',    dvt: 'kg',   can: 120 },
  { id: 'dm-h-co2-2', stage: 'HAN', poNumber: 'PO-2026-002', sku: 'GHE-IEA3', tenVatTu: 'Khí CO₂ (bình 25kg)', dvt: 'bình', can: 4 },
  { id: 'dm-h-day-2', stage: 'HAN', poNumber: 'PO-2026-002', sku: 'GHE-IEA3', tenVatTu: 'Dây hàn CO₂ Ø1.0',    dvt: 'kg',   can: 50 },
  // SƠN
  { id: 'dm-s-bot-1', stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55',  tenVatTu: 'Bột sơn đen tĩnh điện', dvt: 'kg',   can: 60 },
  { id: 'dm-s-dm-1',  stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55',  tenVatTu: 'Dung môi pha sơn',      dvt: 'lít',  can: 20 },
  { id: 'dm-s-keo-1', stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55',  tenVatTu: 'Băng keo che sơn',      dvt: 'cuộn', can: 15 },
  { id: 'dm-s-bot-2', stage: 'SON', poNumber: 'PO-2026-002', sku: 'GHE-IEA3', tenVatTu: 'Bột sơn xám tĩnh điện', dvt: 'kg',   can: 25 },
];

function seed(): VatTuIssue[] {
  return [
    // HÀN — có đợt đã nhận (history) + đợt chờ tổ xác nhận
    { id: 'vi-h1', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', tenVatTu: 'Khí CO₂ (bình 25kg)', dvt: 'bình', soLuong: 5,  xuatAt: '2026-07-09 08:20', status: 'DA_NHAN', nhanAt: '2026-07-09 08:45', soLuongNhan: 5 },
    { id: 'vi-h2', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', tenVatTu: 'Dây hàn CO₂ Ø1.0',    dvt: 'kg',   soLuong: 80, xuatAt: '2026-07-09 08:20', status: 'DA_NHAN', nhanAt: '2026-07-09 08:50', soLuongNhan: 80 },
    { id: 'vi-h3', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', tenVatTu: 'Khí CO₂ (bình 25kg)',  dvt: 'bình', soLuong: 3,  xuatAt: '2026-07-09 10:15', status: 'CHO_NHAN' },
    // SƠN
    { id: 'vi-s1', stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55', tenVatTu: 'Bột sơn đen tĩnh điện', dvt: 'kg',   soLuong: 30, xuatAt: '2026-07-09 09:10', status: 'DA_NHAN', nhanAt: '2026-07-09 09:30', soLuongNhan: 30 },
    { id: 'vi-s2', stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55', tenVatTu: 'Băng keo che sơn',      dvt: 'cuộn', soLuong: 5,  xuatAt: '2026-07-09 09:10', status: 'DA_NHAN', nhanAt: '2026-07-09 09:32', soLuongNhan: 5 },
    { id: 'vi-s3', stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55', tenVatTu: 'Dung môi pha sơn',      dvt: 'lít',  soLuong: 8,  xuatAt: '2026-07-09 10:40', status: 'CHO_NHAN' },
  ];
}

let issues: VatTuIssue[] = loadJSON(LS_ISSUES, seed);
const persist = () => saveJSON(LS_ISSUES, issues);

export async function getDinhMucVatTu(stage: VatTuStage): Promise<VatTuDinhMuc[]> {
  await mockDelay();
  return DINH_MUC.filter(d => d.stage === stage).map(d => ({ ...d }));
}
export async function getVatTuIssues(stage: VatTuStage): Promise<VatTuIssue[]> {
  await mockDelay();
  return issues.filter(i => i.stage === stage).map(i => ({ ...i }));
}

export interface XuatVatTuInput { stage: VatTuStage; poNumber: string; sku: string; tenVatTu: string; dvt: string; soLuong: number; }
// Kho xuất 1 đợt vật tư → CHỜ tổ nhận.
export async function xuatVatTu(i: XuatVatTuInput) {
  await mockDelay();
  const soLuong = Math.floor(i.soLuong);
  if (soLuong <= 0) return null;
  const b: VatTuIssue = { id: `vi${Date.now()}`, ...i, soLuong, xuatAt: now(), status: 'CHO_NHAN' };
  issues.push(b); persist();
  return { ...b };
}
// Tổ xác nhận đã nhận 1 đợt (soLuongNhan mặc định = soLuong xuất) → DA_NHAN + mốc thời gian.
export async function xacNhanNhanVatTu(id: string, soLuongNhan?: number) {
  await mockDelay();
  const it = issues.find(x => x.id === id);
  if (it && it.status === 'CHO_NHAN') {
    it.status = 'DA_NHAN';
    it.nhanAt = now();
    it.soLuongNhan = soLuongNhan != null ? Math.max(0, Math.floor(soLuongNhan)) : it.soLuong;
    persist();
  }
  return { id, status: it?.status };
}

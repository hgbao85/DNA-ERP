/**
 * Mock API "Kho xuất sắt → Phôi nhận sắt" — ĐÓNG VAI BE.
 * Nhận pattern (kiểu cắt) từ hệ thống cắt sắt, tự quy đổi ra đoạn rồi trả FE.
 * FE chỉ render, không tính lại. Xem docs/quy-doi-doan-phoi.md.
 */
import { mockDelay } from '../core/delay';
import {
  quyDoiDoan, tongCay, tongHaoHutMm,
  type CutPattern, type DoanQuyDoi,
} from '../../quy-doi-sat';

export type { CutPattern, DoanQuyDoi } from '../../quy-doi-sat';

export type SatIssueStatus = 'CHO_NHAN' | 'DA_NHAN' | 'DA_CAT';

/** Một đợt kho xuất 1 loại sắt cho 1 PO (bản gốc từ cắt sắt). */
export interface SatIssue {
  id: string;
  poNumber: string;
  sku: string;
  lineId: number;          // khớp ProcLine.id của plan 3 tầng — đợt rơi đúng dòng vật tư
  loaiSat: string;
  quyCach: string;
  barLen: number;          // chiều dài nguyên cây (mm)
  bundles: CutPattern[];   // các bó cây theo kiểu cắt (cắt sắt tính sẵn)
  dotThoiGian: string;     // giờ kho xuất đợt
  nguoiXuat: string;
  status: SatIssueStatus;
  soCayThuc?: number;      // số cây thực cắt được (khi Phôi báo sai lệch)
}

/** Bản trả cho FE — đã quy đổi sẵn (BE làm). */
export interface SatIssueView extends SatIssue {
  soCay: number;           // tổng cây kho xuất
  hhTongMm: number;        // tổng hao hụt (mm)
  doanQuyDoi: DoanQuyDoi[]; // cây → đoạn (BE cộng sẵn)
}

// ── Kiểu cắt (khớp output "Đề xuất thanh sắt") ──────────────────────
// 25×50: 3 kiểu (minh hoạ cùng số cây ra đoạn khác nhau). 18×18 / 20×40: 1 kiểu.
const P25_A = (soCay: number): CutPattern => ({ segments: { 930: 4, 765: 1, 695: 1, 200: 4 }, soCay, hhPerCay: 20 });
const P25_B = (soCay: number): CutPattern => ({ segments: { 930: 1, 765: 4, 695: 2, 200: 3 }, soCay, hhPerCay: 20 });
const P25_C = (soCay: number): CutPattern => ({ segments: { 695: 6, 200: 9 }, soCay, hhPerCay: 30 });
const P18 = (soCay: number): CutPattern => ({ segments: { 745: 8 }, soCay, hhPerCay: 40 });
const P20 = (soCay: number): CutPattern => ({ segments: { 1180: 5 }, soCay, hhPerCay: 100 });

const KHO = 'Thủ kho — Lê C';

// ── State mock (in-module) ─────────────────────────────────────────
// lineId khớp ProcLine.id trong plan 3 tầng (xem LenhSanXuatPhoi.seed):
//   111 Sắt Vuông 18×18 (Mảnh Tựa) · 112 Sắt Hộp 20×40 (Tựa) · 113 Sắt Hộp 25×50 (Tựa)
//   121 Sắt Hộp 25×50 (Mảnh Tay)  · 122 Sắt Vuông 18×18 (Tay)
let issues: SatIssue[] = seed();

function seed(): SatIssue[] {
  const J55 = { poNumber: 'PO-2026-001', sku: 'GHE-J55', barLen: 6000, nguoiXuat: KHO };
  return [
    // ── Đã cắt xong hôm nay (đợt 08:15) — lịch sử ──
    { ...J55, id: 's1', lineId: 111, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18',
      bundles: [P18(30)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 30 },
    { ...J55, id: 's2', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(10), P25_B(10)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 19 },

    // ── Đã nhận, chờ cắt (đợt 10:40) — hiện ở tab ② màn vật tư ──
    { ...J55, id: 's3', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(8), P25_B(7)], dotThoiGian: '2026-07-09 10:40', status: 'DA_NHAN' },
    { ...J55, id: 's4', lineId: 112, loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40',
      bundles: [P20(10)], dotThoiGian: '2026-07-09 10:40', status: 'DA_NHAN' },
    { ...J55, id: 's5', lineId: 121, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(10)], dotThoiGian: '2026-07-09 10:40', status: 'DA_NHAN' },

    // ── Đợt mới nhất (13:20) — vừa nhận, đang chờ cắt ──
    { ...J55, id: 's6', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(6), P25_B(6), P25_C(6)], dotThoiGian: '2026-07-09 13:20', status: 'DA_NHAN' },
    { ...J55, id: 's7', lineId: 111, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18',
      bundles: [P18(20)], dotThoiGian: '2026-07-09 13:20', status: 'DA_NHAN' },
  ];
}

const enrich = (i: SatIssue): SatIssueView => ({
  ...structuredClone(i),
  soCay: tongCay(i.bundles),
  hhTongMm: tongHaoHutMm(i.bundles),
  doanQuyDoi: quyDoiDoan(i.bundles),
});

// ── API công khai ──────────────────────────────────────────────────
export async function getDotXuatSat(poNumber?: string): Promise<SatIssueView[]> {
  await mockDelay();
  const src = poNumber ? issues.filter((i) => i.poNumber === poNumber) : issues;
  return src.map(enrich);
}

export async function xacNhanCatXong(id: string, soCayThuc?: number) {
  await mockDelay();
  const it = issues.find((x) => x.id === id);
  if (it && it.status === 'DA_NHAN') {
    it.status = 'DA_CAT';
    if (soCayThuc != null) it.soCayThuc = soCayThuc;
  }
  return { id, status: it?.status };
}

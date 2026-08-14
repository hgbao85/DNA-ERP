/**
 * Mock "Kho xuất sắt → Phôi nhận sắt" — CHỈ còn phần đọc tồn/đợt xuất sắt cũ (getDotXuatSat,
 * dùng bởi sanxuat/core.tsx; getDoanTonKho, dùng bởi KhoPhoiPage.tsx để tra "tồn đoạn sẵn sàng
 * cho Hàn"). Toàn bộ nghiệp vụ xuất/nhận/KCS/kế hoạch xuất sắt đã cutover sang steel-issues-api.ts
 * thật (XuatSatPage/LenhSanXuatPhoi/KcsPhoiPage/XacNhanSanLuongPage) — các hàm mock tương ứng
 * (xuatSatChoPhoi/huyXuatDot/capLaiSatChoPhoi/xacNhanCatXong/kcsDuyetPhoi/getKeHoachXuatSat/
 * getSanLuongChoKcs/getKcsIssues/getDeXuatCapLaiSat/syncDinhMucSatVaoKeHoach) đã xoá vì không còn
 * trang nào gọi. `issues` dưới đây vì vậy chỉ còn là dữ liệu seed tĩnh (không còn hàm nào ghi mới).
 * Xem docs/quy-doi-doan-phoi.md.
 */
import { mockDelay } from '../core/delay';
import {
  quyDoiDoan, tongCay, tongHaoHutMm,
  type CutPattern, type DoanQuyDoi,
} from '../../quy-doi-sat';

export type { CutPattern, DoanQuyDoi } from '../../quy-doi-sat';

export type SatIssueStatus = 'CHO_NHAN' | 'DA_NHAN' | 'CHO_KCS' | 'DA_CAT';

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
  soCayThuc?: number;      // DA_NHAN/CHO_KCS: số cây Phôi báo cắt được. DA_CAT: số cây KCS ĐẠT.
  hoanThanhAt?: string;    // thời điểm Phôi xác nhận cắt xong (chuyển sang CHO_KCS)
  // ── KCS duyệt ──
  kcsFailedQty?: number;   // số cây KCS chấm KHÔNG đạt (= sửa được + phế)
  kcsScrapQty?: number;    // trong đó phế (đề xuất cấp lại sắt); sửa được = kcsFailedQty − kcsScrapQty
  kcsReason?: string;
  kcsPhotoUrl?: string;
  kcsAt?: string;          // thời điểm KCS duyệt (chuyển sang DA_CAT)
  reworkOf?: string;       // id đợt gốc — nếu đây là đợt tạo lại do KCS bắt làm lại
  capLaiOf?: string;       // id đề xuất cấp lại — nếu đây là đợt kho cấp bù sắt phế
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
// Cây 5850mm (5m) — dùng cho một số đợt để minh hoạ 6m/5m lẫn lộn.
const P18b = (soCay: number): CutPattern => ({ segments: { 575: 10 }, soCay, hhPerCay: 100 });
const P20b = (soCay: number): CutPattern => ({ segments: { 1150: 5 }, soCay, hhPerCay: 100 });

const KHO = 'Thủ kho — Lê C';

// ── State mock (persist localStorage — sống qua logout/login & reload) ──────
// lineId khớp ProcLine.id trong plan 3 tầng (xem LenhSanXuatPhoi.seed):
//   111 Sắt Vuông 18×18 (Mảnh Tựa) · 112 Sắt Hộp 20×40 (Tựa) · 113 Sắt Hộp 25×50 (Tựa)
//   121 Sắt Hộp 25×50 (Mảnh Tay)  · 122 Sắt Vuông 18×18 (Tay)
// Đổi *_v* khi sửa seed để ép nạp lại (tránh dính data cũ trong localStorage).
const LS_ISSUES = 'phoi_sat_issues_v2';

function loadJSON<T>(key: string, fallback: () => T): T {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* SSR / quota */ }
  return fallback();
}

const issues: SatIssue[] = loadJSON(LS_ISSUES, seed);

function seed(): SatIssue[] {
  const J55 = { poNumber: 'PO-2026-001', sku: 'GHE-J55', barLen: 6000, nguoiXuat: KHO };
  const J40 = { poNumber: 'PO-2026-000', sku: 'GHE-J40', barLen: 6000, nguoiXuat: KHO };
  return [
    // ── PO-2026-000 · đã xuất ĐỦ (minh hoạ trạng thái "Đã xong") ──
    { ...J40, id: 'p0a', lineId: 11, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18',
      bundles: [P18(30)], dotThoiGian: '2026-07-08 08:00', status: 'DA_CAT', soCayThuc: 30, hoanThanhAt: '2026-07-08 10:30' },
    { ...J40, id: 'p0b', lineId: 12, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(20)], dotThoiGian: '2026-07-08 08:00', status: 'DA_CAT', soCayThuc: 20, hoanThanhAt: '2026-07-08 11:15' },

    // ── PO-2026-001 · đợt 08:15 (đã cắt xong, KCS ĐẠT) ──
    // Số cây cấp ĐỦ nuôi phần đã hàn + còn lại của Hàn (xem san-luong.service HAN):
    //   18×18 P18(250) → 745: 2000   ·   20×40 P20b(100) → 1150: 500
    //   25×50 P25_A(100)+P25_B(100)+P25_C(50) → 930:500 · 765:500 · 695:600 · 200:1150
    { ...J55, id: 's1', lineId: 111, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18',
      bundles: [P18(250)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 250, hoanThanhAt: '2026-07-09 11:20' },
    { ...J55, id: 's2', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(100), P25_B(100), P25_C(50)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 250, hoanThanhAt: '2026-07-09 12:05' },
    { ...J55, id: 's8', lineId: 112, loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40', barLen: 5850,
      bundles: [P20b(100)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 100, hoanThanhAt: '2026-07-09 10:40' },

    // ── PO-2026-001 · đợt 10:40 (đã nhận, đang cắt) ──
    { ...J55, id: 's3', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(8), P25_B(7)], dotThoiGian: '2026-07-09 10:40', status: 'DA_NHAN' },
    { ...J55, id: 's4', lineId: 112, loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40',
      bundles: [P20(10)], dotThoiGian: '2026-07-09 10:40', status: 'DA_NHAN' },
    { ...J55, id: 's5', lineId: 121, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(10)], dotThoiGian: '2026-07-09 10:40', status: 'DA_NHAN' },

    // ── PO-2026-001 · đợt 13:20 (vừa nhận) — có cây 5m ──
    { ...J55, id: 's6', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(6), P25_B(6), P25_C(6)], dotThoiGian: '2026-07-09 13:20', status: 'DA_NHAN' },
    { ...J55, id: 's7', lineId: 111, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', barLen: 5850,
      bundles: [P18b(20)], dotThoiGian: '2026-07-09 13:20', status: 'DA_NHAN' },

    // ── PO-2026-001 · Phôi đã báo cắt xong, ĐANG CHỜ KCS duyệt ──
    { ...J55, id: 's9', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(9), P25_B(6)], dotThoiGian: '2026-07-09 09:30', status: 'CHO_KCS', soCayThuc: 15, hoanThanhAt: '2026-07-09 11:00' },
    { ...J55, id: 's10', lineId: 121, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(12)], dotThoiGian: '2026-07-09 09:45', status: 'CHO_KCS', soCayThuc: 12, hoanThanhAt: '2026-07-09 11:10' },
    // Kho chỉ xuất PO tiếp theo khi PO hiện tại xong (tuần tự) → chưa có PO-2026-002.
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

// Tồn ĐOẠN sẵn sàng cho Hàn = đoạn từ các đợt Phôi ĐÃ KCS ĐẠT (DA_CAT), quy đổi
// cây→đoạn (quyDoiDoan) rồi nhân tỷ lệ KCS đạt. Khóa theo (PO, loại sắt, quy cách, chiều dài).
export interface DoanTon { poNumber: string; loaiSat: string; quyCach: string; len: number; soDoan: number }
export async function getDoanTonKho(poNumber?: string): Promise<DoanTon[]> {
  await mockDelay();
  const acc = new Map<string, DoanTon>();
  for (const i of issues) {
    if (i.status !== 'DA_CAT') continue;               // chỉ tính đợt KCS đã duyệt PASS
    if (poNumber && i.poNumber !== poNumber) continue;
    const total = tongCay(i.bundles);
    const ratio = total > 0 ? (i.soCayThuc ?? total) / total : 0; // phần KCS đạt / tổng cắt
    for (const d of quyDoiDoan(i.bundles)) {
      const soDoan = Math.floor(d.count * ratio);
      if (soDoan <= 0) continue;
      const key = `${i.poNumber}|${i.loaiSat}|${i.quyCach}|${d.len}`;
      const ex = acc.get(key);
      if (ex) ex.soDoan += soDoan;
      else acc.set(key, { poNumber: i.poNumber, loaiSat: i.loaiSat, quyCach: i.quyCach, len: d.len, soDoan });
    }
  }
  return [...acc.values()];
}

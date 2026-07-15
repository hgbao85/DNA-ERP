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
const LS_ISSUES = 'phoi_sat_issues_v1';
const LS_CAPLAI = 'phoi_sat_caplai_v1';

function loadJSON<T>(key: string, fallback: () => T): T {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* SSR / quota */ }
  return fallback();
}
function saveJSON(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* SSR / quota */ }
}

let issues: SatIssue[] = loadJSON(LS_ISSUES, seed);
const persistIssues = () => saveJSON(LS_ISSUES, issues);

function seed(): SatIssue[] {
  const J55 = { poNumber: 'PO-2026-001', sku: 'GHE-J55', barLen: 6000, nguoiXuat: KHO };
  const J40 = { poNumber: 'PO-2026-000', sku: 'GHE-J40', barLen: 6000, nguoiXuat: KHO };
  return [
    // ── PO-2026-000 · đã xuất ĐỦ (minh hoạ trạng thái "Đã xong") ──
    { ...J40, id: 'p0a', lineId: 11, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18',
      bundles: [P18(30)], dotThoiGian: '2026-07-08 08:00', status: 'DA_CAT', soCayThuc: 30, hoanThanhAt: '2026-07-08 10:30' },
    { ...J40, id: 'p0b', lineId: 12, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(20)], dotThoiGian: '2026-07-08 08:00', status: 'DA_CAT', soCayThuc: 20, hoanThanhAt: '2026-07-08 11:15' },

    // ── PO-2026-001 · đợt 08:15 (đã cắt xong) — có cả cây 6m và 5m ──
    { ...J55, id: 's1', lineId: 111, loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18',
      bundles: [P18(30)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 30, hoanThanhAt: '2026-07-09 11:20' },
    { ...J55, id: 's2', lineId: 113, loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50',
      bundles: [P25_A(10), P25_B(10)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 19, hoanThanhAt: '2026-07-09 12:05' },
    { ...J55, id: 's8', lineId: 112, loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40', barLen: 5850,
      bundles: [P20b(12)], dotThoiGian: '2026-07-09 08:15', status: 'DA_CAT', soCayThuc: 12, hoanThanhAt: '2026-07-09 10:40' },

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

// Phôi xác nhận cắt xong 1 đợt → KHÔNG tính "đã cắt" ngay mà chuyển sang CHỜ KCS.
export async function xacNhanCatXong(id: string, soCayThuc?: number) {
  await mockDelay();
  const it = issues.find((x) => x.id === id);
  if (it && it.status === 'DA_NHAN') {
    it.status = 'CHO_KCS';
    if (soCayThuc != null) it.soCayThuc = soCayThuc;
    it.hoanThanhAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    persistIssues();
  }
  return { id, status: it?.status };
}

// ── KCS công đoạn Phôi ──────────────────────────────────────────────
export interface KcsPhoiPayload {
  failedQty: number;            // số cây không đạt (phần còn lại tự tính đạt)
  scrapQty?: number;            // trong đó phế (cấp lại sắt); sửa được = failedQty − scrapQty
  reason?: string;
  photoUrl?: string;
}

// Danh sách "đề xuất cấp lại sắt" (phế do KCS) — kho đọc để cấp bù.
export interface CapLaiSatItem {
  id: string; poNumber: string; sku: string; lineId: number;
  loaiSat: string; quyCach: string; soCay: number; reason?: string; at: string;
}
const capLaiSat: CapLaiSatItem[] = loadJSON(LS_CAPLAI, () => [] as CapLaiSatItem[]);
const persistCapLai = () => saveJSON(LS_CAPLAI, capLaiSat);

export async function getSanLuongChoKcs(): Promise<SatIssueView[]> {
  await mockDelay();
  return issues.filter((i) => i.status === 'CHO_KCS').map(enrich);
}

// Các lô liên quan KCS (đang chờ + đã duyệt) — để màn KCS hiện cả "đã duyệt" & "lỗi".
export async function getKcsIssues(): Promise<SatIssueView[]> {
  await mockDelay();
  return issues.filter((i) => i.status === 'CHO_KCS' || i.status === 'DA_CAT').map(enrich);
}

export async function getDeXuatCapLaiSat(): Promise<CapLaiSatItem[]> {
  await mockDelay();
  return capLaiSat.map((x) => ({ ...x }));
}

// KCS duyệt 1 đợt CHỜ KCS → DA_CAT (chỉ phần ĐẠT được tính done + chảy xuống Hàn).
//  - Sửa được (REWORK): phần không đạt tạo lại 1 đợt DA_NHAN để Phôi xử lý & báo lại.
//  - Phế (SCRAP): phần không đạt ghi vào "đề xuất cấp lại sắt" cho kho cấp bù.
export async function kcsDuyetPhoi(id: string, p: KcsPhoiPayload) {
  await mockDelay();
  const it = issues.find((x) => x.id === id);
  if (!it || it.status !== 'CHO_KCS') return { ok: false as const };

  const baoCat = it.soCayThuc ?? tongCay(it.bundles);
  const failed = Math.max(0, Math.min(baoCat, Math.floor(p.failedQty || 0)));
  const scrap = Math.max(0, Math.min(failed, Math.floor(p.scrapQty || 0)));
  const rework = failed - scrap;         // sửa được = phần fail không phế
  const passed = baoCat - failed;

  it.status = 'DA_CAT';
  it.soCayThuc = passed;                 // done chỉ tính phần KCS đạt
  it.kcsFailedQty = failed;
  it.kcsScrapQty = scrap;
  it.kcsReason = p.reason;
  it.kcsPhotoUrl = p.photoUrl;
  it.kcsAt = now();

  if (rework > 0) {
    // sửa được: tạo lại đợt DA_NHAN để Phôi xử lý & báo lại
    const b0 = it.bundles[0];
    issues.push({
      poNumber: it.poNumber, sku: it.sku, lineId: it.lineId,
      loaiSat: it.loaiSat, quyCach: it.quyCach, barLen: it.barLen,
      bundles: [{ segments: b0?.segments ?? {}, soCay: rework, hhPerCay: b0?.hhPerCay ?? 0 }],
      id: 'rw' + Date.now(), dotThoiGian: now(), nguoiXuat: KHO,
      status: 'DA_NHAN', reworkOf: it.id,
    });
  }
  if (scrap > 0) {
    // phế: đề xuất kho cấp lại sắt
    capLaiSat.push({
      id: 'cl' + Date.now(), poNumber: it.poNumber, sku: it.sku, lineId: it.lineId,
      loaiSat: it.loaiSat, quyCach: it.quyCach, soCay: scrap, reason: p.reason, at: now(),
    });
    persistCapLai();
  }
  persistIssues();
  return { ok: true as const, passed, failed, rework, scrap };
}

// ── Kế hoạch xuất sắt (kho sắt) — cắt sắt tính sẵn cần xuất bao nhiêu cây mỗi loại ──
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

export interface KeHoachSatItem {
  id: string;
  poNumber: string;
  sku: string;
  lineId: number;                    // khớp ProcLine.id — đợt xuất rơi đúng dòng bên Phôi
  ngayLenh: string;                  // ngày ra lệnh SX — dùng xếp thứ tự tuần tự
  manhTen: string;                   // mảnh cấu thành — để tính đồng bộ trong 1 mảnh
  loaiSat: string;
  quyCach: string;
  barLen: number;
  planCay: number;                   // tổng cây cần xuất (cắt sắt tính)
  seg: Record<number, number>;       // đoạn/cây của kiểu cắt đại diện
  hhPerCay: number;
}
export interface KeHoachSatView extends KeHoachSatItem {
  daXuat: number;                    // Σ cây đã xuất (mọi đợt của line)
  daCat: number;                     // Σ cây đã cắt xong (đã KCS duyệt)
  conXuat: number;                   // planCay − daXuat
}

const S25 = { 930: 4, 765: 1, 695: 1, 200: 4 };  // kiểu cắt đại diện 25×50
// Thứ tự PO trong mảng = thứ tự thực hiện (tuần tự). Kho chỉ thao tác PO "đang thực
// hiện" — PO trước đã xuất đủ (Đã xong), PO sau bị khóa (Chờ) tới khi PO này xong.
const catPlan: KeHoachSatItem[] = [
  // ── PO-2026-000 · GHE-J40 — đã xuất đủ (Đã xong) ──
  { id: 'kh-011', poNumber: 'PO-2026-000', sku: 'GHE-J40', lineId: 11, ngayLenh: '2026-07-08', manhTen: 'Mảnh Tựa', loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', barLen: 6000, planCay: 30, seg: { 745: 8 }, hhPerCay: 40 },
  { id: 'kh-012', poNumber: 'PO-2026-000', sku: 'GHE-J40', lineId: 12, ngayLenh: '2026-07-08', manhTen: 'Mảnh Chân', loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', barLen: 6000, planCay: 20, seg: S25, hhPerCay: 20 },

  // ── PO-2026-001 · GHE-J55 — đang thực hiện ──
  { id: 'kh-111', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 111, ngayLenh: '2026-07-09', manhTen: 'Mảnh Tựa', loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', barLen: 6000, planCay: 84, seg: { 745: 8 }, hhPerCay: 40 },
  { id: 'kh-112', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 112, ngayLenh: '2026-07-09', manhTen: 'Mảnh Tựa', loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40', barLen: 6000, planCay: 56, seg: { 1180: 5 }, hhPerCay: 100 },
  { id: 'kh-113', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 113, ngayLenh: '2026-07-09', manhTen: 'Mảnh Tựa', loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', barLen: 6000, planCay: 84, seg: S25, hhPerCay: 20 },
  { id: 'kh-121', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 121, ngayLenh: '2026-07-09', manhTen: 'Mảnh Tay', loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', barLen: 6000, planCay: 42, seg: S25, hhPerCay: 20 },
  { id: 'kh-122', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 122, ngayLenh: '2026-07-09', manhTen: 'Mảnh Tay', loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', barLen: 6000, planCay: 42, seg: { 745: 8 }, hhPerCay: 40 },

  // ── PO-2026-002 · GHE-K10 — chờ (khóa tới khi PO-001 xong) ──
  { id: 'kh-211', poNumber: 'PO-2026-002', sku: 'GHE-K10', lineId: 211, ngayLenh: '2026-07-11', manhTen: 'Mảnh Tựa', loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', barLen: 6000, planCay: 60, seg: S25, hhPerCay: 20 },
  { id: 'kh-212', poNumber: 'PO-2026-002', sku: 'GHE-K10', lineId: 212, ngayLenh: '2026-07-11', manhTen: 'Mảnh Chân', loaiSat: 'Sắt Vuông 6 zem', quyCach: '18×18', barLen: 6000, planCay: 48, seg: { 745: 8 }, hhPerCay: 40 },
  { id: 'kh-213', poNumber: 'PO-2026-002', sku: 'GHE-K10', lineId: 213, ngayLenh: '2026-07-11', manhTen: 'Mảnh Chân', loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40', barLen: 6000, planCay: 36, seg: { 1180: 5 }, hhPerCay: 100 },

  // ── PO-2026-003 · BAN-B20 — chờ ──
  { id: 'kh-311', poNumber: 'PO-2026-003', sku: 'BAN-B20', lineId: 311, ngayLenh: '2026-07-14', manhTen: 'Mảnh Mặt', loaiSat: 'Sắt Hộp 6 zem', quyCach: '25×50', barLen: 6000, planCay: 40, seg: S25, hhPerCay: 20 },
  { id: 'kh-312', poNumber: 'PO-2026-003', sku: 'BAN-B20', lineId: 312, ngayLenh: '2026-07-14', manhTen: 'Mảnh Chân', loaiSat: 'Sắt Hộp 8 zem', quyCach: '20×40', barLen: 6000, planCay: 32, seg: { 1180: 5 }, hhPerCay: 100 },
];

const daXuatOf = (lineId: number) =>
  issues.filter((i) => i.lineId === lineId).reduce((s, i) => s + tongCay(i.bundles), 0);
// "Phôi đã cắt" = cây đã cắt vật lý (đã báo sản lượng), gồm cả đang chờ KCS + đã KCS đạt.
const daCatOf = (lineId: number) =>
  issues
    .filter((i) => i.lineId === lineId && (i.status === 'CHO_KCS' || i.status === 'DA_CAT'))
    .reduce((s, i) => s + (i.soCayThuc ?? tongCay(i.bundles)) + (i.kcsFailedQty ?? 0), 0);

export async function getKeHoachXuatSat(poNumber?: string): Promise<KeHoachSatView[]> {
  await mockDelay();
  const src = poNumber ? catPlan.filter((p) => p.poNumber === poNumber) : catPlan;
  return src.map((p) => {
    const daXuat = daXuatOf(p.lineId);
    return { ...p, daXuat, daCat: daCatOf(p.lineId), conXuat: Math.max(0, p.planCay - daXuat) };
  });
}

// Kho xuất sắt cho Phôi → tạo đợt DA_NHAN (hiện ngay bên Phôi qua getDotXuatSat).
export async function xuatSatChoPhoi(planId: string, soCay: number) {
  await mockDelay();
  const p = catPlan.find((x) => x.id === planId);
  if (!p || soCay <= 0) return null;
  const issue: SatIssue = {
    id: 'x' + Date.now(),
    poNumber: p.poNumber, sku: p.sku, lineId: p.lineId,
    loaiSat: p.loaiSat, quyCach: p.quyCach, barLen: p.barLen,
    bundles: [{ segments: p.seg, soCay, hhPerCay: p.hhPerCay }],
    dotThoiGian: now(), nguoiXuat: KHO, status: 'DA_NHAN',
  };
  issues.push(issue);
  persistIssues();
  return enrich(issue);
}

// Hoàn tác 1 đợt vừa xuất (chỉ khi Phôi CHƯA cắt — còn DA_NHAN). Dùng cho nút Undo.
export async function huyXuatDot(issueId: string) {
  await mockDelay();
  const i = issues.findIndex((x) => x.id === issueId && x.status === 'DA_NHAN');
  if (i < 0) return { ok: false };
  issues.splice(i, 1);
  persistIssues();
  return { ok: true };
}

// Kho cấp bù sắt cho phần PHẾ (KCS đề xuất cấp lại) → tạo đợt DA_NHAN cho Phôi cắt lại,
// đồng thời xoá đề xuất khỏi hàng chờ. Khép vòng: KCS phế → kho cấp → Phôi cắt lại → KCS.
export async function capLaiSatChoPhoi(capLaiId: string, soCay?: number) {
  await mockDelay();
  const idx = capLaiSat.findIndex((x) => x.id === capLaiId);
  if (idx < 0) return null;
  const c = capLaiSat[idx];
  const n = soCay != null ? Math.max(1, Math.floor(soCay)) : c.soCay;
  const plan = catPlan.find((p) => p.lineId === c.lineId); // lấy kiểu cắt đại diện của dòng
  const issue: SatIssue = {
    id: 'cl-iss-' + Date.now(),
    poNumber: c.poNumber, sku: c.sku, lineId: c.lineId,
    loaiSat: c.loaiSat, quyCach: c.quyCach, barLen: plan?.barLen ?? 6000,
    bundles: [{ segments: plan?.seg ?? S25, soCay: n, hhPerCay: plan?.hhPerCay ?? 20 }],
    dotThoiGian: now(), nguoiXuat: KHO, status: 'DA_NHAN', capLaiOf: c.id,
  };
  issues.push(issue);
  capLaiSat.splice(idx, 1);
  persistIssues(); persistCapLai();
  return enrich(issue);
}

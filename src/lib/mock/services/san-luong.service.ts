/**
 * Mock "Báo sản lượng Hàn/Sơn → KCS duyệt" — CHỈ còn phần đọc (getSanLuongByStage), dùng bởi
 * KhoPhoiPage.tsx để tra "đã hàn" (tồn Khung hàn chờ đan). Nghiệp vụ báo sản lượng/KCS duyệt thật
 * đã cutover sang production-batches-api.ts (KcsStagePage.tsx/sanxuat/core.tsx::TwoTierScreen) —
 * các hàm mock tương ứng (baoSanLuong/kcsDuyetStage/getSanLuongChoKcsStage/getDeXuatCapLaiStage)
 * đã xoá vì không còn trang nào gọi. `batches` dưới đây vì vậy chỉ còn là dữ liệu seed tĩnh.
 * Persist localStorage để sống qua logout/login & reload (giống phoi-sat.service).
 */
import { mockDelay } from '../core/delay';

export type SanLuongStage = 'HAN' | 'SON';
export type SlStatus = 'CHO_KCS' | 'DA_CAT';

export interface SanLuongBatch {
  id: string;
  stage: SanLuongStage;
  poNumber: string;
  sku: string;
  lineId: number;        // khớp ProcLine.id trong seed Lệnh SX Hàn/Sơn
  itemName: string;
  spec: string;
  qty: number;           // CHO_KCS: SL công nhân báo. DA_CAT: SL KCS ĐẠT.
  reportedAt: string;
  status: SlStatus;
  kcsFailedQty?: number;   // không đạt (= sửa được + phế)
  kcsScrapQty?: number;    // trong đó phế (cấp lại); sửa được = kcsFailedQty − kcsScrapQty
  kcsReason?: string;
  kcsAt?: string;
  reworkOf?: string;
}

// ── Persist localStorage (đổi *_v* khi sửa seed để ép nạp lại) ──────
const LS_BATCHES = 'san_luong_hs_v3';
function loadJSON<T>(key: string, fb: () => T): T {
  try { const r = localStorage.getItem(key); if (r) return JSON.parse(r) as T; } catch { /* SSR / quota */ }
  return fb();
}

function seed(): SanLuongBatch[] {
  return [
    // ── HÀN · PO-2026-001 — "đã hàn" (KCS ĐẠT) là nguồn DUY NHẤT tính done + trừ đoạn.
    //   Số đã hàn khớp đúng đoạn Phôi KCS-đạt cấp (xem phoi-sat.service · issues s1/s2/s8):
    //   khung tựa 500 (930×1, 1150×1, 745×2)  ·  chân ghế 240+10 (765×2, 745×2)  ·  giằng 290+10 (695×2)
    { id: 'h-tua-1', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 111, itemName: 'Ráp khung tựa', spec: 'J55-TUA', qty: 500, reportedAt: '2026-07-09 08:40', status: 'DA_CAT', kcsFailedQty: 0, kcsScrapQty: 0, kcsAt: '2026-07-09 09:10' },
    { id: 'h-chan-1', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 121, itemName: 'Ráp chân ghế', spec: 'J55-CHAN', qty: 240, reportedAt: '2026-07-09 09:00', status: 'DA_CAT', kcsFailedQty: 0, kcsScrapQty: 0, kcsAt: '2026-07-09 09:30' },
    { id: 'h-chan-2', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 121, itemName: 'Ráp chân ghế', spec: 'J55-CHAN', qty: 10, reportedAt: '2026-07-09 09:20', status: 'CHO_KCS' },
    { id: 'h-giang-1', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 131, itemName: 'Hàn giằng ngang', spec: 'J55-GIANG', qty: 290, reportedAt: '2026-07-09 09:05', status: 'DA_CAT', kcsFailedQty: 0, kcsScrapQty: 0, kcsAt: '2026-07-09 09:35' },
    { id: 'h-giang-2', stage: 'HAN', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 131, itemName: 'Hàn giằng ngang', spec: 'J55-GIANG', qty: 10, reportedAt: '2026-07-09 09:35', status: 'CHO_KCS' },
    // ── SƠN · đã sơn xong 1 lô mảnh (khung tựa), đang chờ KCS ──
    { id: 's-1', stage: 'SON', poNumber: 'PO-2026-001', sku: 'GHE-J55', lineId: 111, itemName: 'Khung tựa', spec: 'J55-TUA · sơn đen', qty: 15, reportedAt: '2026-07-09 10:05', status: 'CHO_KCS' },
  ];
}

const batches: SanLuongBatch[] = loadJSON(LS_BATCHES, seed);

// ── API ─────────────────────────────────────────────────────────────
export async function getSanLuongByStage(stage: SanLuongStage): Promise<SanLuongBatch[]> {
  await mockDelay();
  return batches.filter((b) => b.stage === stage).map((b) => ({ ...b }));
}

/**
 * Mock API "Báo sản lượng Hàn/Sơn → KCS duyệt" — ĐÓNG VAI BE, dùng chung giữa:
 *  - Lệnh SX Hàn/Sơn: công nhân báo sản lượng → tạo lô CHO_KCS (CHƯA tính done).
 *  - KCS Hàn/Sơn: duyệt → DA_CAT; chỉ phần ĐẠT mới tính "đã hàn/đã sơn" (done).
 *  - Kho đầu ra (Khung hàn / Mảnh chờ đan) đọc DA_CAT — nối sau.
 * Persist localStorage để sống qua logout/login & reload (giống phoi-sat.service).
 * Xem docs/kcs — cùng khuôn với công đoạn Phôi.
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

export interface SlCapLaiItem {
  id: string; stage: SanLuongStage; poNumber: string; sku: string;
  lineId: number; itemName: string; qty: number; reason?: string; at: string;
}

const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');

// ── Persist localStorage (đổi *_v* khi sửa seed để ép nạp lại) ──────
const LS_BATCHES = 'san_luong_hs_v3';
const LS_CAPLAI = 'san_luong_hs_caplai_v3';
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

let batches: SanLuongBatch[] = loadJSON(LS_BATCHES, seed);
const persist = () => saveJSON(LS_BATCHES, batches);
const capLai: SlCapLaiItem[] = loadJSON(LS_CAPLAI, () => [] as SlCapLaiItem[]);
const persistCapLai = () => saveJSON(LS_CAPLAI, capLai);

// ── API ─────────────────────────────────────────────────────────────
export async function getSanLuongByStage(stage: SanLuongStage): Promise<SanLuongBatch[]> {
  await mockDelay();
  return batches.filter((b) => b.stage === stage).map((b) => ({ ...b }));
}

export async function getSanLuongChoKcsStage(stage: SanLuongStage): Promise<SanLuongBatch[]> {
  await mockDelay();
  return batches.filter((b) => b.stage === stage && b.status === 'CHO_KCS').map((b) => ({ ...b }));
}

export interface BaoSanLuongInput { poNumber: string; sku: string; lineId: number; itemName: string; spec: string; qty: number; }

// Công nhân báo sản lượng → tạo lô CHỜ KCS (chưa tính done).
export async function baoSanLuong(stage: SanLuongStage, i: BaoSanLuongInput) {
  await mockDelay();
  const qty = Math.floor(i.qty);
  if (qty <= 0) return null;
  const b: SanLuongBatch = {
    id: `${stage.toLowerCase()}${Date.now()}`,
    stage, poNumber: i.poNumber, sku: i.sku, lineId: i.lineId,
    itemName: i.itemName, spec: i.spec, qty, reportedAt: now(), status: 'CHO_KCS',
  };
  batches.push(b); persist();
  return { ...b };
}

export interface SlKcsPayload { failedQty: number; scrapQty?: number; reason?: string; }

// KCS duyệt 1 lô CHỜ KCS → DA_CAT (chỉ phần ĐẠT tính done + chảy xuống công đoạn sau).
//  - Sửa được (REWORK): phần fail KHÔNG tính done → tự hiện lại ở "còn lại", công nhân
//    sửa rồi báo lại (không cần lô mới).
//  - Phế (SCRAP): ghi "đề xuất cấp lại" bán thành phẩm từ công đoạn trước.
export async function kcsDuyetStage(stage: SanLuongStage, id: string, p: SlKcsPayload) {
  await mockDelay();
  const b = batches.find((x) => x.id === id && x.stage === stage);
  if (!b || b.status !== 'CHO_KCS') return { ok: false as const };

  const failed = Math.max(0, Math.min(b.qty, Math.floor(p.failedQty || 0)));
  const scrap = Math.max(0, Math.min(failed, Math.floor(p.scrapQty || 0)));
  const rework = failed - scrap;  // sửa được: không tính done → tự hiện lại ở "còn lại"
  const passed = b.qty - failed;
  b.status = 'DA_CAT';
  b.qty = passed;                 // done chỉ tính phần đạt
  b.kcsFailedQty = failed;
  b.kcsScrapQty = scrap;
  b.kcsReason = p.reason;
  b.kcsAt = now();

  if (scrap > 0) {
    capLai.push({
      id: 'cl' + Date.now(), stage, poNumber: b.poNumber, sku: b.sku,
      lineId: b.lineId, itemName: b.itemName, qty: scrap, reason: p.reason, at: now(),
    });
    persistCapLai();
  }
  persist();
  return { ok: true as const, passed, failed, rework, scrap };
}

export async function getDeXuatCapLaiStage(stage: SanLuongStage): Promise<SlCapLaiItem[]> {
  await mockDelay();
  return capLai.filter((x) => x.stage === stage).map((x) => ({ ...x }));
}

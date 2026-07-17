/**
 * Mock "Lệnh sản xuất — Phôi" (PO → Mảnh → Vật tư) — state module-level, persist
 * localStorage để sống qua logout/login & reload (giống phoi-sat.service), và để
 * KHSX "Bắt đầu sản xuất" (KiemTraVatTuPage) đẩy PO mới vào ngay cả khi màn Phôi
 * chưa mở lần nào trong phiên này (xem InspectionContext.startProduction).
 */
import { ISO, minsAgo, type ProcRow } from '../../../components/sanxuat/core';
import type { DinhMucSatSyncItem } from './phoi-sat.service';

const LS_PHOI_ROWS = 'phoi_lenh_sx_rows_v1';

function loadJSON<T>(key: string, fallback: () => T): T {
  try { const raw = localStorage.getItem(key); if (raw) return JSON.parse(raw) as T; } catch { /* SSR / quota */ }
  return fallback();
}
function saveJSON(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* SSR / quota */ }
}

function seedPhoiRows(): ProcRow[] {
  return [
    // PO-TEST-001 đặt lên ĐẦU hàng đợi (thứ tự mảng = thứ tự "tuần tự" mở PO, xem
    // core.tsx seqUnlocked) để test ngay, khỏi chờ PO-2026-001..003 xuất/cắt đủ 100%.
    // lineId (9220-9225) khớp đúng phoi-sat.service (Xuất sắt cho Phôi) — nếu SKU này sau
    // đó thật sự đi qua "Bắt đầu sản xuất", syncDinhMucSatVaoLenhPhoi sẽ thấy PO đã có và
    // bỏ qua, không tạo trùng.
    {
      id: 10, poNumber: 'PO-TEST-001', sku: 'TEST-01', productName: 'Ghế Test Đầy Đủ',
      soLuong: 100, deadline: '2026-12-31T00:00:00.000Z', arrangedAt: '2026-07-16T08:00:00.000Z',
      manhs: [
        { id: 100, tenManh: 'Mảnh Tựa', perSku: 1, lines: [
          { id: 9220, itemName: 'Ống sắt 25×25', spec: 'cây', needQty: 20, doneQty: 0, perManh: 1, lastInputAt: null },
          { id: 9221, itemName: 'Ống sắt Ø16',   spec: 'cây', needQty: 20, doneQty: 0, perManh: 1, lastInputAt: null },
        ]},
        { id: 101, tenManh: 'Mảnh Mê', perSku: 1, lines: [
          { id: 9222, itemName: 'Ống sắt 25×50', spec: 'cây', needQty: 15, doneQty: 0, perManh: 1, lastInputAt: null },
          { id: 9223, itemName: 'Ống sắt 20×40', spec: 'cây', needQty: 15, doneQty: 0, perManh: 1, lastInputAt: null },
        ]},
        { id: 102, tenManh: 'Mảnh Tay Trái', perSku: 1, lines: [
          { id: 9224, itemName: 'Ống sắt Ø16', spec: 'cây', needQty: 10, doneQty: 0, perManh: 1, lastInputAt: null },
        ]},
        { id: 103, tenManh: 'Mảnh Tay Phải', perSku: 1, lines: [
          { id: 9225, itemName: 'Ống sắt Ø16', spec: 'cây', needQty: 10, doneQty: 0, perManh: 1, lastInputAt: null },
        ]},
      ],
    },
    {
      id: 1, poNumber: 'PO-2026-001', sku: 'GHE-J55', productName: 'Ghế J55 (khung 40×40)',
      soLuong: 500, deadline: ISO(5), arrangedAt: minsAgo(190),
      manhs: [
        {
          id: 11, tenManh: 'Mảnh Tựa', perSku: 1, lines: [
            { id: 111, itemName: 'Sắt Vuông 6 zem', spec: '18×18', needQty: 1000, doneQty: 180, perManh: 2, lastInputAt: minsAgo(95) },
            { id: 112, itemName: 'Sắt Hộp 8 zem', spec: '20×40', needQty: 500, doneQty: 95, perManh: 1, lastInputAt: minsAgo(50) },
            { id: 113, itemName: 'Sắt Hộp 6 zem', spec: '25×50', needQty: 500, doneQty: 90, perManh: 1, lastInputAt: minsAgo(30) },
          ],
        },
        {
          id: 12, tenManh: 'Mảnh Tay', perSku: 2, lines: [
            { id: 121, itemName: 'Sắt Hộp 6 zem', spec: '25×50', needQty: 2000, doneQty: 400, perManh: 2, lastInputAt: minsAgo(40) },
            { id: 122, itemName: 'Sắt Vuông 6 zem', spec: '18×18', needQty: 1000, doneQty: 200, perManh: 1, lastInputAt: minsAgo(20) },
          ],
        },
        {
          id: 13, tenManh: 'Mảnh Mê', perSku: 1, lines: [
            { id: 131, itemName: 'Sắt Hộp 8 zem', spec: '20×40', needQty: 500, doneQty: 20, perManh: 1, lastInputAt: minsAgo(25) },
            { id: 132, itemName: 'Sắt dẹt', spec: '20×3', needQty: 500, doneQty: 0, perManh: 1, lastInputAt: null },
          ],
        },
      ],
    },
    {
      id: 2, poNumber: 'PO-2026-002', sku: 'GHE-IEA3', productName: 'Ghế IEA-3 (khung 30×30)',
      soLuong: 200, deadline: ISO(8), arrangedAt: minsAgo(30),
      manhs: [
        { id: 21, tenManh: 'Mảnh Khung', lines: [{ id: 211, itemName: 'Sắt Vuông 6 zem', spec: '30×30', needQty: 80, doneQty: 0, lastInputAt: null }] },
        { id: 22, tenManh: 'Mảnh Chân', lines: [{ id: 221, itemName: 'Ống sắt tròn', spec: 'Φ16', needQty: 40, doneQty: 0, lastInputAt: null }] },
      ],
    },
    {
      id: 3, poNumber: 'PO-2026-003', sku: 'BAN-TB45', productName: 'Bàn TB-45 (vuông)',
      soLuong: 120, deadline: ISO(3), arrangedAt: null,
      manhs: [
        { id: 31, tenManh: 'Mảnh Mặt bàn', lines: [{ id: 311, itemName: 'Sắt Vuông 6 zem', spec: '50×50', needQty: 60, doneQty: 0, lastInputAt: null }] },
      ],
    },
  ];
}

const phoiRows: ProcRow[] = loadJSON(LS_PHOI_ROWS, seedPhoiRows);
const persistPhoiRows = () => saveJSON(LS_PHOI_ROWS, phoiRows);

export function getPhoiRows(): ProcRow[] {
  return phoiRows;
}

// LenhSanXuatPhoi.tsx gọi mỗi khi setRows đổi (bắt đầu/kết thúc ca, xác nhận cắt...)
// để tiến độ sống qua reload, giống cách phoi-sat.service persist `issues`.
export function setPhoiRows(next: ProcRow[]) {
  phoiRows.splice(0, phoiRows.length, ...next);
  persistPhoiRows();
}

// KHSX bấm "Bắt đầu sản xuất" → tạo 1 PO mới trong "Lệnh sản xuất Phôi" gồm các dòng
// vật tư sắt của định mức. Có định mức mảnh thật (item.manhTen, xem InspectionContext.
// startProduction) thì tách đúng thành nhiều mảnh (Mảnh Tựa, Mảnh Mê...), giống các PO có
// sẵn (vd PO-2026-002 gồm "Mảnh Tựa"/"Mảnh Chân"); không có thì gom vào 1 mảnh mặc định.
// lineId phải khớp với dòng tương ứng bên kế hoạch xuất sắt (syncDinhMucSatVaoKeHoach
// trong phoi-sat.service) để Phôi xác nhận cắt xong sau này cộng đúng doneQty của dòng.
export function syncDinhMucSatVaoLenhPhoi(params: {
  poNumber: string; sku: string; productName?: string; deadline?: string; items: DinhMucSatSyncItem[];
}) {
  if (phoiRows.some((r) => r.poNumber === params.poNumber)) return; // đã sync trước đó
  const items = params.items.filter((it) => it.required > 0);
  if (items.length === 0) return;

  const nextRowId = Math.max(0, ...phoiRows.map((r) => r.id)) + 1;
  let nextManhId = Math.max(0, ...phoiRows.flatMap((r) => r.manhs?.map((m) => m.id) ?? [])) + 1;

  const groups = new Map<string, DinhMucSatSyncItem[]>();
  for (const it of items) {
    const key = it.manhTen ?? 'Vật tư sắt định mức';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  }
  const manhs = [...groups.entries()].map(([tenManh, groupItems]) => ({
    id: nextManhId++, tenManh, perSku: 1,
    lines: groupItems.map((it) => ({
      id: it.lineId, itemName: it.name, spec: it.unit ?? '', needQty: Math.ceil(it.required), doneQty: 0, perManh: 1, lastInputAt: null,
    })),
  }));

  const newRow: ProcRow = {
    id: nextRowId, poNumber: params.poNumber, sku: params.sku,
    productName: params.productName ?? params.sku,
    soLuong: 0,
    deadline: params.deadline ?? new Date().toISOString(),
    arrangedAt: new Date().toISOString(),
    manhs,
  };
  phoiRows.push(newRow);
  persistPhoiRows();
}

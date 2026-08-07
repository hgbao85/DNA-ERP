import type { ManhOrder } from '../../../types/manh';
import type { AuditLogEntry, Notification } from '../../../types/admin';
import { seedWeavingByPoint } from './seed-mfg-ops';

// ══════════════════════════════════════════════════════════════════════════════
// MANUFACTURING DATA: PRODUCTION, MATERIALS, SUPPLIERS
// ══════════════════════════════════════════════════════════════════════════════

export const seedMfgWarehouses = [
  { id: 5, name: 'Kho thành phẩm', code: 'thanh-pham',    note: 'Bao bì đóng gói & thành phẩm hoàn chỉnh — cuối chuỗi chuyển kho nội bộ', isActive: true },
  { id: 6, name: 'Kho Vật tư thành phẩm', code: 'vat-tu-tp',     note: 'Sơn, dây, vật tư tiêu hao sản xuất', isActive: true },
  { id: 7, name: 'Kho Phôi Sơn Hàn',      code: 'phoi-son-han', note: 'Phôi kim loại, sơn, vật tư hàn — đầu chuỗi chuyển kho nội bộ', isActive: true },
];

export const seedMfgWarehouseItems = [
  { id: 4, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton JSE-55', unit: 'cái', quantity: 600, material: null },
  { id: 5, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Bao nylon 68×105', unit: 'cái', quantity: 1200, material: null },
  { id: 6, warehouseId: 5, materialId: null, classification: 'Thành phẩm', name: 'Mặt ghế J55 (đan xong)', unit: 'cái', quantity: 200, material: null },
  // Kho Vật tư thành phẩm (id:6) — sơn + dây tiêu hao
  { id: 19, warehouseId: 6, materialId: null, name: 'Sơn tĩnh điện đen RAL9005',  unit: 'kg',  quantity: 85,  material: null },
  { id: 20, warehouseId: 6, materialId: null, name: 'Sơn tĩnh điện xám RAL7035',  unit: 'kg',  quantity: 42,  material: null },
  { id: 21, warehouseId: 6, materialId: null, name: 'Sơn lót epoxy chống gỉ',      unit: 'kg',  quantity: 30,  material: null },
  { id: 22, warehouseId: 6, materialId: 2,    name: 'Dây PE Ø3mm đen',             unit: 'kg',  quantity: 160, material: { id: 2, code: 'DAY-PE3', name: 'Dây PE Ø3mm', unit: 'kg' } },
  { id: 23, warehouseId: 6, materialId: 4,    name: 'Dây PE Ø4mm xanh lá',         unit: 'kg',  quantity: 95,  material: { id: 4, code: 'DAY-PE4', name: 'Dây PE Ø4mm', unit: 'kg' } },
  { id: 24, warehouseId: 6, materialId: null, name: 'Dung môi sơn',                 unit: 'lít', quantity: 20,  material: null },
  { id: 25, warehouseId: 6, materialId: null, name: 'Primer kết dính',              unit: 'lít', quantity: 15,  material: null },
  // ── Kho Sắt (id:2) — vật tư khớp định mức SKU ──────────────────
  { id: 26, warehouseId: 2, materialId: null, name: 'Sắt hộp 25×25',       unit: 'cây', quantity: 80,  material: null },
  { id: 27, warehouseId: 2, materialId: null, name: 'Sắt vuông 20×20',      unit: 'cây', quantity: 80,  material: null },
  { id: 28, warehouseId: 2, materialId: null, name: 'Sắt tấm 3mm',          unit: 'tấm', quantity: 40,  material: null },
  { id: 29, warehouseId: 2, materialId: null, name: 'Ống sắt tròn Φ16',     unit: 'cây', quantity: 90,  material: null },
  { id: 30, warehouseId: 2, materialId: null, name: 'Sắt dẹt 20×3',         unit: 'cây', quantity: 60,  material: null },
  { id: 31, warehouseId: 2, materialId: null, name: 'Ống sắt hộp 20×40',    unit: 'cây', quantity: 100, material: null },
  { id: 32, warehouseId: 2, materialId: null, name: 'Sắt tấm 2mm',          unit: 'tấm', quantity: 10,  material: null },
  { id: 33, warehouseId: 2, materialId: null, name: 'Ống sắt hộp 25×25',    unit: 'cây', quantity: 150, material: null },
  { id: 34, warehouseId: 2, materialId: null, name: 'Sắt chữ L 25×25',      unit: 'cây', quantity: 70,  material: null },
  { id: 35, warehouseId: 2, materialId: null, name: 'Sắt tấm đục lỗ',       unit: 'tấm', quantity: 20,  material: null },
  { id: 36, warehouseId: 2, materialId: null, name: 'Ống sắt tròn Φ19',     unit: 'cây', quantity: 80,  material: null },
  { id: 37, warehouseId: 2, materialId: null, name: 'Sắt dẹt 25×3',         unit: 'cây', quantity: 50,  material: null },
  { id: 38, warehouseId: 2, materialId: null, name: 'Ống sắt tròn Φ12',     unit: 'cây', quantity: 45,  material: null },
  { id: 39, warehouseId: 2, materialId: null, name: 'Ống sắt tròn Φ22',     unit: 'cây', quantity: 65,  material: null },
  { id: 40, warehouseId: 2, materialId: null, name: 'Sắt hộp 20×20',        unit: 'cây', quantity: 55,  material: null },
  // ── Kho Vật tư thành phẩm (id:6) — dây/sơn khớp định mức ───────────
  { id: 41, warehouseId: 6, materialId: null, name: 'Dây PE đen',            unit: 'cuộn', quantity: 30,  material: null },
  { id: 42, warehouseId: 6, materialId: null, name: 'Sơn tĩnh điện đen',     unit: 'kg',   quantity: 60,  material: null },
  { id: 43, warehouseId: 6, materialId: null, name: 'Dây nhựa xanh lá',      unit: 'cuộn', quantity: 20,  material: null },
  { id: 44, warehouseId: 6, materialId: null, name: 'Dây màu đỏ',            unit: 'cuộn', quantity: 15,  material: null },
  { id: 45, warehouseId: 6, materialId: null, name: 'Sơn xám RAL7035',       unit: 'kg',   quantity: 0,   material: null },
  { id: 46, warehouseId: 6, materialId: null, name: 'Dây PE xám GSS',        unit: 'cuộn', quantity: 25,  material: null },
  { id: 47, warehouseId: 6, materialId: null, name: 'Sơn lót epoxy',         unit: 'kg',   quantity: 25,  material: null },
  { id: 48, warehouseId: 6, materialId: null, name: 'Sơn phủ xám nhạt',      unit: 'kg',   quantity: 20,  material: null },
  { id: 49, warehouseId: 6, materialId: null, name: 'Dây PE xám tro',        unit: 'cuộn', quantity: 20,  material: null },
  { id: 50, warehouseId: 6, materialId: null, name: 'Dây nhựa trắng kem',    unit: 'cuộn', quantity: 25,  material: null },
  { id: 51, warehouseId: 6, materialId: null, name: 'Dây màu be',            unit: 'cuộn', quantity: 15,  material: null },
  { id: 52, warehouseId: 6, materialId: null, name: 'Sơn trắng sữa',         unit: 'kg',   quantity: 20,  material: null },
  { id: 53, warehouseId: 6, materialId: null, name: 'Dây PE đen IKEA',       unit: 'cuộn', quantity: 30,  material: null },
  { id: 54, warehouseId: 6, materialId: null, name: 'Dây màu xám đậm',       unit: 'cuộn', quantity: 15,  material: null },
  { id: 55, warehouseId: 6, materialId: null, name: 'Sơn đen bóng',          unit: 'kg',   quantity: 25,  material: null },
  // ── Kho phụ kiện (id:1) — khớp định mức ─────────────────────────────
  { id: 56, warehouseId: 1, materialId: null, name: 'Ốc vít M6×20',          unit: 'cái',   quantity: 500,  material: null },
  { id: 57, warehouseId: 1, materialId: null, name: 'Nắp nhựa đầu ống',      unit: 'cái',   quantity: 200,  material: null },
  { id: 58, warehouseId: 1, materialId: null, name: 'Đệm cao su',             unit: 'cái',   quantity: 150,  material: null },
  { id: 59, warehouseId: 1, materialId: null, name: 'Ốc vít M5×15',          unit: 'cái',   quantity: 400,  material: null },
  { id: 60, warehouseId: 1, materialId: null, name: 'Nắp đầu ống tròn',      unit: 'cái',   quantity: 3,    material: null },
  { id: 61, warehouseId: 1, materialId: null, name: 'Ốc vít M6×25',          unit: 'cái',   quantity: 300,  material: null },
  { id: 62, warehouseId: 1, materialId: null, name: 'Tán đinh rivets 4×8',   unit: 'cái',   quantity: 50,   material: null },
  { id: 63, warehouseId: 1, materialId: null, name: 'Nắp nhựa 40mm',         unit: 'cái',   quantity: 100,  material: null },
  { id: 64, warehouseId: 1, materialId: null, name: 'Chốt khóa nhựa',        unit: 'cái',   quantity: 80,   material: null },
  { id: 65, warehouseId: 1, materialId: null, name: 'Đệm vải nỉ',            unit: 'miếng', quantity: 120,  material: null },
  { id: 66, warehouseId: 1, materialId: null, name: 'Bulong M8×30',           unit: 'bộ',    quantity: 60,   material: null },
  { id: 67, warehouseId: 1, materialId: null, name: 'Ốc vít M5×12',          unit: 'cái',   quantity: 400,  material: null },
  { id: 68, warehouseId: 1, materialId: null, name: 'Nắp ống tròn Φ19',      unit: 'cái',   quantity: 100,  material: null },
  { id: 69, warehouseId: 1, materialId: null, name: 'Đệm cao su chân ghế',   unit: 'cái',   quantity: 60,   material: null },
  { id: 70, warehouseId: 1, materialId: null, name: 'Ốc vít M6×16',          unit: 'cái',   quantity: 300,  material: null },
  { id: 71, warehouseId: 1, materialId: null, name: 'Nắp ống tròn Φ22',      unit: 'cái',   quantity: 80,   material: null },
  { id: 72, warehouseId: 1, materialId: null, name: 'Chân nhựa chống trượt', unit: 'cái',   quantity: 60,   material: null },
  { id: 73, warehouseId: 1, materialId: null, name: 'Vít tự khoan 4×16',     unit: 'cái',   quantity: 200,  material: null },
  // ── Kho Bao bì/Thành phẩm (id:5) — khớp định mức ────────────────────
  { id: 74, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton 5 lớp',    unit: 'thùng', quantity: 150,  material: null },
  { id: 75, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Xốp PE bảo vệ',         unit: 'm²',    quantity: 80,   material: null },
  { id: 76, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Dây đai nhựa',          unit: 'm',     quantity: 200,  material: null },
  { id: 77, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton 3 lớp',    unit: 'thùng', quantity: 80,   material: null },
  { id: 78, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Xốp chèn góc',          unit: 'bộ',    quantity: 2,    material: null },
  { id: 79, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton sóng kép', unit: 'thùng', quantity: 80,   material: null },
  { id: 80, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Băng keo OPP',          unit: 'cuộn',  quantity: 120,  material: null },
  { id: 81, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton IKEA',     unit: 'thùng', quantity: 60,   material: null },
  { id: 82, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Xốp PE 8mm',            unit: 'm²',    quantity: 50,   material: null },
  { id: 83, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Túi PE bịt đầu',        unit: 'túi',   quantity: 100,  material: null },
  { id: 84, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton IKEA kép', unit: 'thùng', quantity: 40,   material: null },
  { id: 85, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Xốp PE cuộn',           unit: 'm',     quantity: 80,   material: null },
  { id: 86, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Nhãn dán IKEA',         unit: 'tờ',    quantity: 500,  material: null },
  { id: 87, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Túi nilon bọc ngoài',   unit: 'túi',   quantity: 150,  material: null },
  { id: 88, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Xốp EPE góc',           unit: 'miếng', quantity: 120,  material: null },
  { id: 89, warehouseId: 5, materialId: null, classification: 'Thành phẩm', name: 'Ghế IEA-3 (đóng gói hoàn chỉnh)', unit: 'bộ', quantity: 85, material: null },
  { id: 90, warehouseId: 5, materialId: null, classification: 'Thành phẩm', name: 'Khung ghế J55 (chưa đan)', unit: 'cái', quantity: 140, material: null },
  // ── Kho Phôi Sơn Hàn (id:7) — đầu chuỗi chuyển kho nội bộ ───────────
  { id: 91, warehouseId: 7, materialId: null, name: 'Thép ống D25×1.5',   unit: 'm',   quantity: 1200, material: null },
  { id: 92, warehouseId: 7, materialId: null, name: 'Thép tấm dày 1.5mm', unit: 'm²',  quantity: 420,  material: null },
  { id: 93, warehouseId: 7, materialId: null, name: 'Sơn tĩnh điện đen',  unit: 'kg',  quantity: 380,  material: null },
  { id: 94, warehouseId: 7, materialId: null, name: 'Que hàn điện 3.2mm', unit: 'hộp', quantity: 95,   material: null },
  // ── Khung (mảnh) — chặng phôi sơn hàn → vật tư TP vẫn là chuyển kho vật lý thật (mfgWarehouseItems,
  // manhStatus chỉ có ý nghĩa ở đây). Từ vật tư TP trở đi (xuất đan/nhập đan), việc theo dõi số lượng
  // chuyển hẳn sang bảng manhOrders (theo PO/mảnh, xem seedManhOrders) — không còn dùng tồn kho rời
  // rạc kiểu "Khung ... " ở vật tư TP/thành phẩm nữa để tránh 2 nguồn số liệu lệch nhau.
  // Khung PI-2026-001 (Ghế J55) vừa sơn xong tại kho Phôi Sơn Hàn, sẵn sàng xuất nội bộ (luôn chưa đan ở đây).
  { id: 95, warehouseId: 7, materialId: null, name: 'Khung JSE-55 — PI-2026-001', unit: 'cái', quantity: 80, material: null, manhStatus: 'chua-dan' },
  // Vật tư thành phẩm (tem nhãn) sẵn sàng để test "Lệnh SX (PO)" xuất nội bộ sang kho thành phẩm.
  { id: 97, warehouseId: 6, materialId: null, name: 'Tem nhãn sản phẩm — PI-2026-002', unit: 'tờ', quantity: 500, material: null },
];

// ── Mảnh theo PO — theo dõi xuất đan (vật tư TP → điểm đan) / nhập đan (điểm đan → kho thành phẩm) ──
// PO là cấp LỚN NHẤT — 1 PO có thể có nhiều SKU (PO-2026-001 có 2 SKU dưới đây: JSE-55 và IEA-3),
// mỗi SKU ứng với 1 mã PI RIÊNG của nó (không dùng chung PI giữa các SKU cùng 1 PO). Mỗi SKU có
// nhiều dòng mảnh. Mỗi dòng mảnh có tonThuc (tồn thực tại vật tư TP, giảm dần khi xuất) và 1 danh
// sách allocations theo từng điểm đan (weavingPointId khớp seedWeavingPoints: 1=Điểm đan A/Anh Tuấn,
// 2=Điểm đan B/Chị Hà, 3=Điểm đan C/Anh Long) — "Mảnh tựa lưng A" cố tình seed 2 điểm đan khác nhau
// để demo rõ trường hợp 1 mảnh nhiều điểm đan.
export const seedManhOrders: ManhOrder[] = [
  {
    id: 1, poCode: 'PO-2026-001',
    skus: [
      {
        id: 1, piCode: 'PI-2026-001-A', skuCode: 'JSE-55', skuName: 'Ghế J55', quantity: 50,
        lines: [
          {
            id: 1, name: 'Mảnh tựa lưng A', unit: 'cái', totalQty: 50, tonThuc: 15,
            allocations: [
              { id: 1, weavingPointId: 1, xuatQty: 20, nhapQty: 20 },
              { id: 2, weavingPointId: 2, xuatQty: 10, nhapQty: 0 },
            ],
          },
          {
            id: 2, name: 'Mảnh ngồi chính', unit: 'cái', totalQty: 50, tonThuc: 0,
            allocations: [{ id: 3, weavingPointId: 1, xuatQty: 50, nhapQty: 40 }],
          },
          {
            id: 3, name: 'Mảnh tay vịn', unit: 'cái', totalQty: 50, tonThuc: 35,
            allocations: [],
          },
        ],
      },
      {
        id: 2, piCode: 'PI-2026-001-B', skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3', quantity: 20,
        lines: [
          {
            id: 5, name: 'Mảnh lưng ghế', unit: 'cái', totalQty: 20, tonThuc: 10,
            allocations: [{ id: 5, weavingPointId: 1, xuatQty: 5, nhapQty: 0 }],
          },
          {
            id: 6, name: 'Mảnh chỗ ngồi', unit: 'cái', totalQty: 20, tonThuc: 20,
            allocations: [],
          },
        ],
      },
    ],
  },
  {
    id: 2, poCode: 'PO-2026-002',
    skus: [
      {
        id: 3, piCode: 'PI-2026-002-A', skuCode: 'JSE-55', skuName: 'Ghế J55', quantity: 40,
        lines: [
          {
            id: 4, name: 'Mảnh chân ghế', unit: 'cái', totalQty: 40, tonThuc: 0,
            allocations: [{ id: 4, weavingPointId: 3, xuatQty: 40, nhapQty: 40 }],
          },
        ],
      },
    ],
  },
];

export const seedExportPurposes = [
  { id: 1, label: 'Xuất sản xuất' },
  { id: 2, label: 'Xuất mẫu' },
];

export const seedNotifications: Notification[] = [];

export function createInitialMockState() {
  return {
    mfgWarehouses: structuredClone(seedMfgWarehouses),
    mfgWarehouseItems: structuredClone(seedMfgWarehouseItems),
    weavingByPoint: structuredClone(seedWeavingByPoint),
    exportPurposes: structuredClone(seedExportPurposes),
    manhOrders: structuredClone(seedManhOrders),
    auditLogs: [] as AuditLogEntry[],
    notifications: structuredClone(seedNotifications),
  };
}

export type MockState = ReturnType<typeof createInitialMockState>;

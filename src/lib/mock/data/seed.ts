import type { ManhOrder } from '../../../types/manh';
import type { AuditLogEntry, SystemConfig, Notification } from '../../../types/admin';
import {
  seedPhoiExecutions,
  seedStageExec,
  seedWeavingFinishedFrames,
  seedWeavingManhSummary,
  seedWeavingByPoint,
  seedWeavingAllocation,
  seedWeavingReceivePending,
  seedWeavingByWarehouse,
  seedChuyenKiem,
  seedPacking,
  seedPackagingBOM,
  seedPackagingByPI,
  seedPiMaterialChecks,
  seedMfgWarehouseTxns,
  seedLaborCost,
} from './seed-mfg-ops';

const ISO = (d: string) => new Date(d).toISOString();

// ══════════════════════════════════════════════════════════════════════════════
// MANUFACTURING DATA: PRODUCTION, MATERIALS, SUPPLIERS
// ══════════════════════════════════════════════════════════════════════════════

export const seedProductionInvoices = [
  // Đang sản xuất — lọc ra ở PIListPage (status PRODUCING), dùng để test các API khác
  {
    id: 1, code: 'PI-2026-001', deadline: ISO('2026-08-01'),
    status: 'PRODUCING', exportOrderId: 1,
    exportOrder: { poNumber: 'PO-MY-001', contractFileUrl: null },
    items: [{
      quantity: 500, materialDeadline: ISO('2026-06-15'),
      stages: [
        { stageType: 'HAN', progressPercent: 60, status: 'IN_PROGRESS', deadline: ISO('2026-06-20') },
        { stageType: 'SON', progressPercent: 0,  status: 'PENDING',     deadline: ISO('2026-07-01') },
      ],
      productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  // 1 SKU — đủ stages tường minh
  {
    id: 2, code: 'PI-2026-002', deadline: ISO('2026-09-01'),
    status: 'PLANNING', exportOrderId: 2,
    exportOrder: { poNumber: 'PO-GP-002', contractFileUrl: null },
    items: [{
      quantity: 300, materialDeadline: ISO('2026-07-01'),
      stages: [
        { stageType: 'HAN',     deadline: ISO('2026-07-28') },
        { stageType: 'WEAVING', deadline: ISO('2026-08-15') },
        { stageType: 'SON',     deadline: ISO('2026-08-25') },
      ],
      productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế đan IEA-3', factoryCode: 'IEA-3' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  // 1 SKU — chỉ có HAN + SON (không có WEAVING), ngày ước tính sẽ hiện nhạt
  {
    id: 3, code: 'PI-2026-003', deadline: ISO('2026-09-15'),
    status: 'PLANNING', exportOrderId: 2,
    exportOrder: { poNumber: 'PO-GP-002', contractFileUrl: null },
    items: [{
      quantity: 200, materialDeadline: ISO('2026-07-10'),
      stages: [
        { stageType: 'HAN', deadline: ISO('2026-08-01') },
        { stageType: 'SON', deadline: ISO('2026-09-05') },
      ],
      productVariant: { colorCode: 'GRAY', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  // 1 SKU — không set gì cả, tất cả hiện ước tính (nhạt)
  {
    id: 4, code: 'PI-2026-004', deadline: ISO('2026-10-30'),
    status: 'PLANNING', exportOrderId: 3,
    exportOrder: { poNumber: 'PO-IK-003', contractFileUrl: null },
    items: [{
      quantity: 800,
      stages: [],
      productVariant: { colorCode: 'GRAY', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  // PO-EU-005 có 3 SKU — mỗi SKU 1 PI riêng (1 SKU chỉ có đúng 1 PI, không gộp chung 1 PI như trước).
  {
    id: 5, code: 'PI-2026-005', deadline: ISO('2026-09-30'),
    status: 'PLANNING', exportOrderId: 4,
    exportOrder: { poNumber: 'PO-EU-005', contractFileUrl: null },
    items: [{
      quantity: 400, materialDeadline: ISO('2026-07-10'),
      stages: [
        { stageType: 'HAN',     deadline: ISO('2026-07-28') },
        { stageType: 'WEAVING', deadline: ISO('2026-08-20') },
        { stageType: 'SON',     deadline: ISO('2026-09-10') },
      ],
      productVariant: { colorCode: 'BEIGE', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  {
    id: 6, code: 'PI-2026-006', deadline: ISO('2026-09-30'),
    status: 'PLANNING', exportOrderId: 4,
    exportOrder: { poNumber: 'PO-EU-005', contractFileUrl: null },
    items: [{
      quantity: 250, materialDeadline: ISO('2026-07-20'),
      stages: [
        { stageType: 'HAN',     deadline: ISO('2026-08-10') },
        { stageType: 'WEAVING', deadline: ISO('2026-09-01') },
        { stageType: 'SON',     deadline: ISO('2026-09-22') },
      ],
      productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế đan IEA-3', factoryCode: 'IEA-3' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  {
    id: 7, code: 'PI-2026-007', deadline: ISO('2026-09-30'),
    status: 'PLANNING', exportOrderId: 4,
    exportOrder: { poNumber: 'PO-EU-005', contractFileUrl: null },
    items: [{
      quantity: 150, materialDeadline: ISO('2026-06-30'),
      stages: [
        { stageType: 'HAN', deadline: ISO('2026-07-20') },
        { stageType: 'SON', deadline: ISO('2026-08-25') },
      ],
      productVariant: { colorCode: 'WHITE', mfgProduct: { name: 'Bàn đan T-08', factoryCode: 'TBL-08' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  // id 8-11: PI ứng với các SKU do KHSX quản lý — mỗi PlanForm 1 SKU 1 PI riêng, để "Bảng thống
  // kê" hiện đúng dữ liệu theo từng SKU.
  {
    id: 8, code: 'PI-2026-008', deadline: ISO('2026-10-15'),
    status: 'PRODUCING', exportOrderId: 1,
    exportOrder: { poNumber: 'PO-MY-001', contractFileUrl: null },
    items: [{
      quantity: 150,
      stages: [{ stageType: 'HAN', progressPercent: 40, status: 'IN_PROGRESS', deadline: ISO('2026-08-01') }],
      productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế đan IEA-3', factoryCode: 'IEA-3' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  {
    id: 9, code: 'PI-2026-009', deadline: ISO('2026-12-20'),
    status: 'PLANNING', exportOrderId: 3,
    exportOrder: { poNumber: 'PO-IK-003', contractFileUrl: null },
    items: [{
      quantity: 200,
      stages: [],
      productVariant: { colorCode: 'GRAY', mfgProduct: { name: 'Ghế đan IEA-3', factoryCode: 'IEA-3' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  {
    id: 10, code: 'PI-2026-010', deadline: ISO('2026-09-20'),
    status: 'PRODUCING', exportOrderId: 9,
    exportOrder: { poNumber: 'PO-MY-009', contractFileUrl: null },
    items: [{
      quantity: 300,
      stages: [
        { stageType: 'PHOI', progressPercent: 100, status: 'DONE' },
        { stageType: 'HAN',  progressPercent: 100, status: 'DONE' },
        { stageType: 'SON',  progressPercent: 100, status: 'DONE' },
      ],
      productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế J60', factoryCode: 'JSE-60' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  {
    id: 11, code: 'PI-2026-011', deadline: ISO('2026-09-25'),
    status: 'PRODUCING', exportOrderId: 10,
    exportOrder: { poNumber: 'PO-IK-010', contractFileUrl: null },
    items: [{
      quantity: 250,
      stages: [
        { stageType: 'PHOI', progressPercent: 100, status: 'DONE' },
        { stageType: 'HAN',  progressPercent: 100, status: 'DONE' },
        { stageType: 'SON',  progressPercent: 100, status: 'DONE' },
      ],
      productVariant: { colorCode: 'GRAY', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
    }],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  // id 12: PI đứng sau PlanForm TEST-01 (id 11, đã APPROVED) — chưa có đơn Sales nào dùng SKU
  // này nên PI còn ở PLANNING, sẵn sàng để test luồng Sales tạo đơn hàng từ đầu.
  {
    id: 12, code: 'PI-2026-012', deadline: ISO('2026-12-15'),
    status: 'PLANNING', exportOrderId: 100,
    exportOrder: { poNumber: 'PO-TEST-001', contractFileUrl: null },
    items: [{
      quantity: 100, materialDeadline: ISO('2026-10-01'),
      stages: [
        { stageType: 'HAN', deadline: ISO('2026-10-20') },
        { stageType: 'SON', deadline: ISO('2026-11-05') },
      ],
      productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế Test Đầy Đủ', factoryCode: 'TEST-01' } },
    }],
    createdBy: { name: 'QA Tester' },
  },
];

export const seedPlanningPIs = [
  {
    id: 2, code: 'PI-2026-002', poNumber: 'PO-GP-002', deadline: ISO('2026-09-01'), materialDeadline: ISO('2026-07-01'),
    status: 'PLANNING', exportCustomerName: 'GOPLUS USA',
    products: [{ name: 'Ghế đan IEA-3', factoryCode: 'IEA-3', colorCode: 'BLACK', quantity: 300 }],
    lmh: { id: 1, code: 'LMH-2026-001', status: 'QUOTING', hasComputed: true, missingCount: 3, totalBuyQty: 1200 },
    activeProposal: null,
  },
  {
    id: 3, code: 'PI-2026-003', poNumber: 'PO-GP-002', deadline: ISO('2026-09-15'), materialDeadline: ISO('2026-06-20'),
    status: 'PLANNING', exportCustomerName: 'GOPLUS USA',
    products: [{ name: 'Ghế J55', factoryCode: 'JSE-55', colorCode: 'GRAY', quantity: 200 }],
    lmh: { id: 2, code: 'LMH-2026-004', status: 'ORDERED', hasComputed: true, missingCount: 0, totalBuyQty: 2500 },
    activeProposal: null,
  },
  {
    id: 4, code: 'PI-2026-004', poNumber: 'PO-IK-003', deadline: ISO('2026-10-30'), materialDeadline: ISO('2026-08-15'),
    status: 'PLANNING', exportCustomerName: 'IKEA Supplier',
    products: [{ name: 'Ghế J55', factoryCode: 'JSE-55', colorCode: 'GRAY', quantity: 800 }],
    lmh: { id: 3, code: 'LMH-2026-005', status: 'DRAFT', hasComputed: false, missingCount: 2, totalBuyQty: 0 },
    activeProposal: null,
  },
];

export const seedMaterialGroups = [
  { id: 1, name: 'Sắt ống' },
  { id: 2, name: 'Dây đan' },
  { id: 3, name: 'Phụ kiện' },
  { id: 4, name: 'Sơn' },
  { id: 5, name: 'Bao bì' },
];

export const seedMaterials = [
  { id: 1, code: 'SAT-25', name: 'Ống sắt 25×25', unit: 'cm', materialGroupId: 1, khoUnitFactor: 600 },
  { id: 2, code: 'DAY-PE3', name: 'Dây PE Ø3mm', unit: 'kg', materialGroupId: 2, khoUnitFactor: 1 },
  { id: 3, code: 'SAT-20', name: 'Ống sắt 20×40', unit: 'cm', materialGroupId: 1, khoUnitFactor: 500 },
  { id: 4, code: 'DAY-PE4', name: 'Dây PE Ø4mm', unit: 'kg', materialGroupId: 2, khoUnitFactor: 1 },
  { id: 5, code: 'SON-TRANG', name: 'Sơn trắng tĩnh điện', unit: 'kg', materialGroupId: 4, khoUnitFactor: 1 },
  { id: 6, code: 'SON-DEN', name: 'Sơn đen tĩnh điện', unit: 'kg', materialGroupId: 4, khoUnitFactor: 1 },
  { id: 7, code: 'TAN-M6', name: 'Tán M6×12', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  { id: 8, code: 'SAT-50X25', name: 'Ống sắt 25×50', unit: 'cm', materialGroupId: 1, khoUnitFactor: 600 },
  { id: 9, code: 'CHOT-10', name: 'Chốt 10mm', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  { id: 10, code: 'PAT-V100', name: 'Pát V 100', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  { id: 11, code: 'O-TRON-LO-DU', name: 'Ô tròn lỗ dù', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  { id: 12, code: 'SAT-30X30', name: 'Ống sắt 30×30', unit: 'cm', materialGroupId: 1, khoUnitFactor: 600 },
  { id: 13, code: 'SAT-16', name: 'Ống sắt Ø16', unit: 'cm', materialGroupId: 1, khoUnitFactor: 600 },
  { id: 14, code: 'DAY-NHUA-DAN', name: 'Dây nhựa đan', unit: 'kg', materialGroupId: 2, khoUnitFactor: 1 },
  { id: 15, code: 'DAY-PE-XAM', name: 'Dây PE xám', unit: 'kg', materialGroupId: 2, khoUnitFactor: 1 },
  { id: 16, code: 'PAT-KINH', name: 'Pát kính', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  { id: 17, code: 'PAT-1-4', name: 'Pát 1-4', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  // For inspection proposals
  { id: 18, code: 'THEP-ONG-D25', name: 'Thép ống D25×1.5', unit: 'kg', materialGroupId: 1, khoUnitFactor: 1 },
  { id: 19, code: 'SON-TD-DEN', name: 'Sơn tĩnh điện đen', unit: 'kg', materialGroupId: 4, khoUnitFactor: 1 },
  { id: 20, code: 'DAY-PE-2MM', name: 'Dây đan PE 2mm', unit: 'm', materialGroupId: 2, khoUnitFactor: 1 },
  { id: 21, code: 'CARTON-5L', name: 'Bao bì carton 5 lớp', unit: 'cái', materialGroupId: 5, khoUnitFactor: 1 },
  { id: 22, code: 'THEP-TAM-2MM', name: 'Thép tấm 2mm', unit: 'kg', materialGroupId: 1, khoUnitFactor: 1 },
  { id: 23, code: 'SON-LOT-EPOXY', name: 'Sơn lót epoxy', unit: 'kg', materialGroupId: 4, khoUnitFactor: 1 },
  { id: 24, code: 'VIT-TK-M5', name: 'Vít tự khoan M5', unit: 'cái', materialGroupId: 3, khoUnitFactor: 1 },
  { id: 25, code: 'TUI-PE-DG', name: 'Túi PE đóng gói', unit: 'cái', materialGroupId: 5, khoUnitFactor: 1 },
];

export const seedMfgWarehouses = [
  { id: 5, name: 'Kho Bao bì/Thành phẩm', code: 'thanh-pham',    note: 'Bao bì đóng gói & thành phẩm hoàn chỉnh — cuối chuỗi chuyển kho nội bộ', isActive: true },
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
  // ── Kho Sắt (id:2) — vật tư khớp định mức planForm ──────────────────
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

export const seedSuppliers = [
  { id: 1,  name: 'Cty Thép Miền Nam',     phone: '0281234567', isActive: true },
  { id: 2,  name: 'Công ty Dây nhựa TM',   phone: '0282345678', isActive: true },
  { id: 3,  name: 'Sơn Thắng Phát',        phone: '0283456789', isActive: true },
  { id: 4,  name: 'Minh Thành Steel',      phone: '0284001001', isActive: true },
  { id: 5,  name: 'An Phát',               phone: '0284002002', isActive: true },
  { id: 6,  name: 'Long Sơn',              phone: '0284003003', isActive: true },
  { id: 7,  name: 'Việt Thắng',            phone: '0284004004', isActive: true },
  { id: 8,  name: 'Đại Hưng',             phone: '0284005005', isActive: true },
  { id: 9,  name: 'Tiến Thịnh',            phone: '0284006006', isActive: true },
  { id: 10, name: 'Bao bì Việt',           phone: '0284007007', isActive: true },
  { id: 11, name: 'Tiến Long',             phone: '0284008008', isActive: true },
  { id: 12, name: 'Hoàng Gia Steel',       phone: '0284009009', isActive: true },
  { id: 13, name: 'Nam Phương Chemicals',  phone: '0284010010', isActive: true },
];

export const seedMaterialSuppliers = [
  { id: 1, materialId: 1, supplierId: 1, price: 85000, material: { id: 1, code: 'SAT-25', name: 'Ống sắt 25×25' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 2, materialId: 2, supplierId: 2, price: 45000, material: { id: 2, code: 'DAY-PE3', name: 'Dây PE Ø3mm' }, supplier: { id: 2, name: 'Công ty Dây nhựa TM' } },
  { id: 3, materialId: 3, supplierId: 1, price: 95000, material: { id: 3, code: 'SAT-20', name: 'Ống sắt 20×40' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 4, materialId: 5, supplierId: 3, price: 125000, material: { id: 5, code: 'SON-TRANG', name: 'Sơn trắng tĩnh điện' }, supplier: { id: 3, name: 'Sơn Thắng Phát' } },
  { id: 5, materialId: 8, supplierId: 1, price: 90000, material: { id: 8, code: 'SAT-50X25', name: 'Ống sắt 25×50' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 6, materialId: 12, supplierId: 1, price: 98000, material: { id: 12, code: 'SAT-30X30', name: 'Ống sắt 30×30' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 7, materialId: 13, supplierId: 1, price: 86000, material: { id: 13, code: 'SAT-16', name: 'Ống sắt Ø16' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 8, materialId: 14, supplierId: 2, price: 42000, material: { id: 14, code: 'DAY-NHUA-DAN', name: 'Dây nhựa đan' }, supplier: { id: 2, name: 'Công ty Dây nhựa TM' } },
  { id: 9, materialId: 15, supplierId: 2, price: 47000, material: { id: 15, code: 'DAY-PE-XAM', name: 'Dây PE xám' }, supplier: { id: 2, name: 'Công ty Dây nhựa TM' } },
  { id: 10, materialId: 9, supplierId: 1, price: 7000, material: { id: 9, code: 'CHOT-10', name: 'Chốt 10mm' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 11, materialId: 10, supplierId: 1, price: 9500, material: { id: 10, code: 'PAT-V100', name: 'Pát V 100' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 12, materialId: 11, supplierId: 1, price: 9800, material: { id: 11, code: 'O-TRON-LO-DU', name: 'Ô tròn lỗ dù' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 13, materialId: 16, supplierId: 1, price: 9200, material: { id: 16, code: 'PAT-KINH', name: 'Pát kính' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
  { id: 14, materialId: 17, supplierId: 1,  price: 9100,  leadTimeDays: 2,  material: { id: 17, code: 'PAT-1-4',       name: 'Pát 1-4'             }, supplier: { id: 1,  name: 'Cty Thép Miền Nam'   } },
  // Thép ống D25×1.5 (materialId 18)
  { id: 15, materialId: 18, supplierId: 4,  price: 45000, leadTimeDays: 5,  material: { id: 18, code: 'THEP-ONG-D25',  name: 'Thép ống D25×1.5'    }, supplier: { id: 4,  name: 'Minh Thành Steel'    } },
  { id: 16, materialId: 18, supplierId: 5,  price: 43500, leadTimeDays: 7,  material: { id: 18, code: 'THEP-ONG-D25',  name: 'Thép ống D25×1.5'    }, supplier: { id: 5,  name: 'An Phát'             } },
  { id: 17, materialId: 18, supplierId: 6,  price: 46000, leadTimeDays: 4,  material: { id: 18, code: 'THEP-ONG-D25',  name: 'Thép ống D25×1.5'    }, supplier: { id: 6,  name: 'Long Sơn'            } },
  // Sơn tĩnh điện đen (materialId 19)
  { id: 18, materialId: 19, supplierId: 7,  price: 82000, leadTimeDays: 6,  material: { id: 19, code: 'SON-TD-DEN',    name: 'Sơn tĩnh điện đen'   }, supplier: { id: 7,  name: 'Việt Thắng'         } },
  { id: 19, materialId: 19, supplierId: 8,  price: 85000, leadTimeDays: 5,  material: { id: 19, code: 'SON-TD-DEN',    name: 'Sơn tĩnh điện đen'   }, supplier: { id: 8,  name: 'Đại Hưng'           } },
  { id: 20, materialId: 19, supplierId: 13, price: 80500, leadTimeDays: 8,  material: { id: 19, code: 'SON-TD-DEN',    name: 'Sơn tĩnh điện đen'   }, supplier: { id: 13, name: 'Nam Phương Chemicals'} },
  // Dây đan PE 2mm (materialId 20)
  { id: 21, materialId: 20, supplierId: 9,  price: 11500, leadTimeDays: 4,  material: { id: 20, code: 'DAY-PE-2MM',    name: 'Dây đan PE 2mm'      }, supplier: { id: 9,  name: 'Tiến Thịnh'         } },
  { id: 22, materialId: 20, supplierId: 5,  price: 11800, leadTimeDays: 5,  material: { id: 20, code: 'DAY-PE-2MM',    name: 'Dây đan PE 2mm'      }, supplier: { id: 5,  name: 'An Phát'             } },
  // Bao bì carton 5 lớp (materialId 21)
  { id: 23, materialId: 21, supplierId: 10, price: 18000, leadTimeDays: 3,  material: { id: 21, code: 'CARTON-5L',     name: 'Bao bì carton 5 lớp' }, supplier: { id: 10, name: 'Bao bì Việt'         } },
  { id: 24, materialId: 21, supplierId: 11, price: 17500, leadTimeDays: 4,  material: { id: 21, code: 'CARTON-5L',     name: 'Bao bì carton 5 lớp' }, supplier: { id: 11, name: 'Tiến Long'           } },
  // Thép tấm 2mm (materialId 22)
  { id: 25, materialId: 22, supplierId: 4,  price: 52000, leadTimeDays: 5,  material: { id: 22, code: 'THEP-TAM-2MM',  name: 'Thép tấm 2mm'        }, supplier: { id: 4,  name: 'Minh Thành Steel'    } },
  { id: 26, materialId: 22, supplierId: 12, price: 50500, leadTimeDays: 6,  material: { id: 22, code: 'THEP-TAM-2MM',  name: 'Thép tấm 2mm'        }, supplier: { id: 12, name: 'Hoàng Gia Steel'      } },
  { id: 27, materialId: 22, supplierId: 1,  price: 54000, leadTimeDays: 3,  material: { id: 22, code: 'THEP-TAM-2MM',  name: 'Thép tấm 2mm'        }, supplier: { id: 1,  name: 'Cty Thép Miền Nam'   } },
  // Sơn lót epoxy (materialId 23)
  { id: 28, materialId: 23, supplierId: 7,  price: 95000, leadTimeDays: 7,  material: { id: 23, code: 'SON-LOT-EPOXY', name: 'Sơn lót epoxy'       }, supplier: { id: 7,  name: 'Việt Thắng'         } },
  { id: 29, materialId: 23, supplierId: 13, price: 91000, leadTimeDays: 8,  material: { id: 23, code: 'SON-LOT-EPOXY', name: 'Sơn lót epoxy'       }, supplier: { id: 13, name: 'Nam Phương Chemicals'} },
  { id: 30, materialId: 23, supplierId: 3,  price: 98000, leadTimeDays: 5,  material: { id: 23, code: 'SON-LOT-EPOXY', name: 'Sơn lót epoxy'       }, supplier: { id: 3,  name: 'Sơn Thắng Phát'     } },
  // Vít tự khoan M5 (materialId 24)
  { id: 31, materialId: 24, supplierId: 5,  price: 320,   leadTimeDays: 3,  material: { id: 24, code: 'VIT-TK-M5',    name: 'Vít tự khoan M5'     }, supplier: { id: 5,  name: 'An Phát'             } },
  { id: 32, materialId: 24, supplierId: 9,  price: 350,   leadTimeDays: 2,  material: { id: 24, code: 'VIT-TK-M5',    name: 'Vít tự khoan M5'     }, supplier: { id: 9,  name: 'Tiến Thịnh'         } },
  // Túi PE đóng gói (materialId 25)
  { id: 33, materialId: 25, supplierId: 10, price: 1200,  leadTimeDays: 3,  material: { id: 25, code: 'TUI-PE-DG',    name: 'Túi PE đóng gói'     }, supplier: { id: 10, name: 'Bao bì Việt'         } },
  { id: 34, materialId: 25, supplierId: 11, price: 1100,  leadTimeDays: 4,  material: { id: 25, code: 'TUI-PE-DG',    name: 'Túi PE đóng gói'     }, supplier: { id: 11, name: 'Tiến Long'           } },
  { id: 35, materialId: 25, supplierId: 5,  price: 1250,  leadTimeDays: 2,  material: { id: 25, code: 'TUI-PE-DG',    name: 'Túi PE đóng gói'     }, supplier: { id: 5,  name: 'An Phát'             } },
];

// Spec Entry Proposals - Đề xuất nhập định mức từ kế hoạch SX
export const seedSpecEntryProposals = [
  {
    id: 1,
    code: 'DEF-2026-001',
    piId: 2,
    piCode: 'PI-2026-002',
    exportOrderId: 2,
    poNumber: 'PO-GP-002',
    mfgProductId: 2,
    productName: 'Ghế đan IEA-3',
    status: 'PROPOSED',
    createdAt: ISO('2026-06-15'),
    tasks: [
      { id: 1, specRole: 'SPEC_STEEL', status: 'PENDING', type: 'Ống sắt tròn', specifications: 'Φ16×1.0mm', thickness: 1.0 },
      { id: 2, specRole: 'SPEC_WIRE_PAINT', status: 'PENDING', unit: 'kg', imageUrl: '', specifications: 'Dây nhựa xanh + sơn xám' },
      { id: 3, specRole: 'SPEC_ACCESSORY', status: 'PENDING', unit: 'cái' },
      { id: 4, specRole: 'SPEC_PACKAGING', status: 'PENDING', unit: 'thùng' },
    ],
  },
  {
    id: 2,
    code: 'DEF-2026-002',
    piId: 3,
    piCode: 'PI-2026-003',
    exportOrderId: 2,
    poNumber: 'PO-GP-002',
    mfgProductId: 1,
    productName: 'Ghế J55',
    status: 'APPROVED',
    createdAt: ISO('2026-06-10'),
    tasks: [
      { id: 5, specRole: 'SPEC_STEEL', status: 'COMPLETED', type: 'Ống sắt vuông', specifications: '25×25×1.2mm', thickness: 1.2 },
      { id: 6, specRole: 'SPEC_WIRE_PAINT', status: 'COMPLETED', unit: 'kg', imageUrl: '', specifications: 'Dây PE xám GSS' },
      { id: 7, specRole: 'SPEC_ACCESSORY', status: 'IN_PROGRESS', unit: 'bộ' },
      { id: 8, specRole: 'SPEC_PACKAGING', status: 'PENDING', unit: 'thùng' },
    ],
  },
];

export const seedExportPurposes = [
  { id: 1, label: 'Xuất sản xuất' },
  { id: 2, label: 'Xuất mẫu' },
];

export const seedDefectReasons = [
  { id: 1, label: 'Cong méo', stageType: 'HAN' },
  { id: 2, label: 'Sơn bong', stageType: 'SON' },
  { id: 3, label: 'Hàn xấu', stageType: 'HAN' },
  { id: 4, label: 'Màu sắc không đều', stageType: 'SON' },
];

export const seedWeavingPoints = [
  { id: 1, code: 'DD-A', name: 'Điểm đan A', fullName: 'Anh Tuấn', phone: '0909123456', isActive: true, sortOrder: 1 },
  { id: 2, code: 'DD-B', name: 'Điểm đan B', fullName: 'Chị Hà', phone: '0918765432', isActive: true, sortOrder: 2 },
  { id: 3, code: 'DD-C', name: 'Điểm đan C', fullName: 'Anh Long', phone: '0932111222', isActive: true, sortOrder: 3 },
];

export const seedWeavingConfig = { minAllocationQty: 50 };

export const seedKcsPending: Record<number, Record<string, number>> = {
  1: { PHOI: 0, HAN: 2, SON: 0 },
  2: { PHOI: 0, HAN: 0, SON: 0 },
};

export const seedSystemConfig: SystemConfig = {
  companyName: 'Công ty TNHH Dịch vụ Xuất Nhập Khẩu Đông Nam Á',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  taxCode: '',
  defaultCurrency: 'VND',
};

export const seedNotifications: Notification[] = [];

export function createInitialMockState() {
  return {
    productionInvoices: structuredClone(seedProductionInvoices),
    planningPIs: structuredClone(seedPlanningPIs),
    materialGroups: structuredClone(seedMaterialGroups),
    materials: structuredClone(seedMaterials),
    mfgWarehouses: structuredClone(seedMfgWarehouses),
    mfgWarehouseItems: structuredClone(seedMfgWarehouseItems),
    mfgWarehouseTxns: structuredClone(seedMfgWarehouseTxns),
    phoiExecutions: structuredClone(seedPhoiExecutions),
    stageExec: structuredClone(seedStageExec),
    weavingFinishedFrames: structuredClone(seedWeavingFinishedFrames),
    weavingManhSummary: structuredClone(seedWeavingManhSummary),
    weavingByPoint: structuredClone(seedWeavingByPoint),
    weavingAllocation: structuredClone(seedWeavingAllocation),
    weavingReceivePending: structuredClone(seedWeavingReceivePending),
    weavingByWarehouse: structuredClone(seedWeavingByWarehouse),
    chuyenKiem: structuredClone(seedChuyenKiem),
    packing: structuredClone(seedPacking),
    piMaterialChecks: structuredClone(seedPiMaterialChecks),
    laborCost: structuredClone(seedLaborCost),
    suppliers: structuredClone(seedSuppliers),
    materialSuppliers: structuredClone(seedMaterialSuppliers),
    specEntryProposals: structuredClone(seedSpecEntryProposals),
    exportPurposes: structuredClone(seedExportPurposes),
    defectReasons: structuredClone(seedDefectReasons),
    weavingPoints: structuredClone(seedWeavingPoints),
    weavingConfig: structuredClone(seedWeavingConfig),
    kcsPending: structuredClone(seedKcsPending),
    packagingBOM: structuredClone(seedPackagingBOM),
    packagingByPI: structuredClone(seedPackagingByPI),
    phoiReports: [] as unknown[],
    stageReports: [] as unknown[],
    weavingAllocations: [] as unknown[],
    packingRecords: [] as unknown[],
    warehouseTransfers: [] as unknown[],
    mfgTransferReservations: [] as unknown[],
    manhOrders: structuredClone(seedManhOrders),
    auditLogs: [] as AuditLogEntry[],
    systemConfig: structuredClone(seedSystemConfig),
    notifications: structuredClone(seedNotifications),
  };
}

export type MockState = ReturnType<typeof createInitialMockState>;

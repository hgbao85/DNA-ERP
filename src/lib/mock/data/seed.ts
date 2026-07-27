import type { PlanForm } from '../../../types/plan-form';
import type { ManhOrder } from '../../../types/manh';
import type { AuditLogEntry, SystemConfig, Notification } from '../../../types/admin';
import { seedSalesCustomers, seedSalesPOs } from './seed-sales';
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

export const seedMfgExportCustomers = [
  { id: 1, name: 'MEYING USA', country: 'US', market: 'Amazon.com', contactName: 'David Chen' },
  { id: 2, name: 'GOPLUS USA', country: 'US', market: 'Amazon / Walmart', contactName: 'Mike Johnson' },
  { id: 3, name: 'IKEA Supplier', country: 'Sweden', market: 'IKEA International', contactName: 'Anna Bergström' },
  // id 4: khách hàng mock dùng riêng cho SKU test TEST-01 (xem seedMfgProducts id 4) — chạy thử
  // toàn bộ luồng Sales → KHSX → Sản xuất mà không đụng dữ liệu demo có sẵn.
  { id: 4, name: 'DNA TEST CO', country: 'VN', market: 'Nội bộ / QA', contactName: 'QA Tester' },
];

export const seedMfgProducts = [
  { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55', description: 'Ghế khung sắt J55 xuất khẩu' },
  { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3', description: 'Ghế dây đan hoàn toàn' },
  { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60', description: 'Ghế khung sắt J60 kích cỡ lớn' },
  // SKU mock đầy đủ để test toàn bộ luồng: Sales tạo đơn → KHSX duyệt SKU/kiểm tra vật tư →
  // Phôi/Hàn/Sơn/KCS. Xem seedPlanForms id 11 (đã APPROVED, đủ định mức 4 nhóm vật tư).
  { id: 4, factoryCode: 'TEST-01', name: 'Ghế Test Đầy Đủ', description: 'SKU mock dùng để test toàn bộ hệ thống — không phải dữ liệu demo thật' },
];

export const seedProductVariants = [
  { id: 101, mfgProductId: 1, exportCustomerId: 1, colorCode: 'BLACK', description: 'JSE-55 Đen — MEYING',  isActive: true,  mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' } },
  { id: 102, mfgProductId: 2, exportCustomerId: 2, colorCode: 'BLACK', description: 'IEA-3 Đen — GOPLUS',  isActive: true,  mfgProduct: { id: 2, factoryCode: 'IEA-3',  name: 'Ghế đan IEA-3' } },
  { id: 103, mfgProductId: 1, exportCustomerId: 3, colorCode: 'GRAY',  description: 'JSE-55 Xám — IKEA',   isActive: true,  mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' } },
  { id: 104, mfgProductId: 3, exportCustomerId: 1, colorCode: 'BLACK', description: 'JSE-60 Đen — MEYING', isActive: true,  mfgProduct: { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60' } },
  { id: 105, mfgProductId: 3, exportCustomerId: 2, colorCode: 'GRAY',  description: 'JSE-60 Xám — GOPLUS', isActive: true,  mfgProduct: { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60' } },
  { id: 106, mfgProductId: 2, exportCustomerId: 3, colorCode: 'WHITE', description: 'IEA-3 Trắng — IKEA',  isActive: false, mfgProduct: { id: 2, factoryCode: 'IEA-3',  name: 'Ghế đan IEA-3' } },
  { id: 107, mfgProductId: 1, exportCustomerId: 2, colorCode: 'BROWN', description: 'JSE-55 Nâu — GOPLUS', isActive: true,  mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' } },
  { id: 108, mfgProductId: 3, exportCustomerId: 3, colorCode: 'BLACK', description: 'JSE-60 Đen — IKEA',   isActive: true,  mfgProduct: { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60' } },
  { id: 109, mfgProductId: 4, exportCustomerId: 4, colorCode: 'BLACK', description: 'TEST-01 Đen — DNA TEST', isActive: true, mfgProduct: { id: 4, factoryCode: 'TEST-01', name: 'Ghế Test Đầy Đủ' } },
];

export const seedExportOrders = [
  {
    id: 1, poNumber: 'PO-MY-001', exportCustomerId: 1, deliveryDate: ISO('2026-10-15'),
    status: 'DRAFT', paymentStatus: 'DEPOSITED', totalValue: 290000, depositAmount: 50000,
    exportCustomer: { id: 1, name: 'MEYING USA', country: 'US' },
    items: [{ id: 1, quantity: 500, boxesPerSet: 1, productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế J55' } } }],
    createdBy: { name: 'Sales NM Lan' },
  },
  {
    id: 2, poNumber: 'PO-GP-002', exportCustomerId: 2, deliveryDate: ISO('2026-11-01'),
    status: 'DRAFT', paymentStatus: 'UNPAID', totalValue: 350000, depositAmount: 0,
    exportCustomer: { id: 2, name: 'GOPLUS USA', country: 'US' },
    items: [
      { id: 2, quantity: 300, boxesPerSet: 1, productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế đan IEA-3' } } },
      { id: 3, quantity: 200, boxesPerSet: 2, productVariant: { colorCode: 'GRAY', mfgProduct: { name: 'Ghế J55' } } },
    ],
    createdBy: { name: 'Sales NM Lan' },
  },
  {
    id: 3, poNumber: 'PO-IK-003', exportCustomerId: 3, deliveryDate: ISO('2026-12-20'),
    status: 'DRAFT', paymentStatus: 'UNPAID', totalValue: 420000, depositAmount: 0,
    exportCustomer: { id: 3, name: 'IKEA Supplier', country: 'Sweden' },
    items: [{ id: 4, quantity: 800, boxesPerSet: 2, productVariant: { colorCode: 'GRAY', mfgProduct: { name: 'Ghế J55' } } }],
    createdBy: { name: 'Sales NM Lan' },
  },
  // id 100: PO gốc đứng sau PlanForm TEST-01 (id 11) — dùng id lệch hẳn khỏi dải 1-10 để không
  // vô tình khớp exportOrderId của các PI/PlanForm demo khác đang tham chiếu lỏng lẻo (vd id 4/9/10
  // chỉ tồn tại dưới dạng exportOrder nhúng trong seedProductionInvoices, không có bản ghi thật ở đây).
  {
    id: 100, poNumber: 'PO-TEST-001', exportCustomerId: 4, deliveryDate: ISO('2026-12-31'),
    status: 'DRAFT', paymentStatus: 'UNPAID', totalValue: 50000, depositAmount: 0,
    exportCustomer: { id: 4, name: 'DNA TEST CO', country: 'VN' },
    items: [{ id: 100, quantity: 100, boxesPerSet: 1, productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế Test Đầy Đủ' } } }],
    createdBy: { name: 'QA Tester' },
  },
];

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
  // id 8-11: PI ứng với các SKU do KHSX quản lý (seedPlanForms 5/6/9/10) — mỗi PlanForm 1 SKU 1 PI
  // riêng, để "Bảng thống kê" hiện đúng dữ liệu theo từng SKU.
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

export const seedPlanForms: PlanForm[] = [
  {
    id: 1, exportOrderId: 1, mfgProductId: 1, status: 'APPROVED', note: 'PlanForm JSE-55 cho PO MEYING',
    piCode: 'PI-2026-001', productionInvoiceId: 1,
    createdAt: ISO('2026-05-20'), proposedAt: ISO('2026-05-20'),
    exportOrder: { id: 1, poNumber: 'PO-MY-001', deliveryDate: ISO('2026-10-15') },
    mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 1,
      materialType: {
        sat: [
          { id: 1, name: 'Sắt hộp 25×25', specifications: '25×25×1.2mm', thickness: 1.2, unit: 'mm', quantity: 9000, createdAt: '2026-05-20T01:00:00.000Z' },
          { id: 2, name: 'Sắt vuông 20×20', specifications: '20×20×1.0mm', thickness: 1.0, unit: 'mm', quantity: 3600, createdAt: '2026-05-20T01:18:00.000Z' },
          { id: 3, name: 'Sắt tấm 3mm', specifications: '1200×600×3mm', thickness: 3.0, unit: 'tấm', quantity: 2,  createdAt: '2026-05-20T01:35:00.000Z' },
        ],
        daySon: [
          { id: 1, name: 'Dây PE đen', specifications: 'Ø3mm, cuộn 500m', kg: 1.5, unit: 'cuộn', createdAt: '2026-05-20T01:52:00.000Z' },
          { id: 2, name: 'Sơn tĩnh điện đen', specifications: 'RAL9005, bột mịn', kg: 0.8, unit: 'kg',    createdAt: '2026-05-20T02:10:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 1, name: 'Ốc vít M6×20',   specifications: 'Inox 304',          unit: 'cái', quantity: 48, createdAt: '2026-05-20T02:28:00.000Z' },
          { id: 2, name: 'Nắp nhựa đầu ống', specifications: '25×25mm, PP đen', unit: 'cái', quantity: 16, createdAt: '2026-05-20T02:45:00.000Z' },
          { id: 3, name: 'Đệm cao su',       specifications: 'Dày 3mm',          unit: 'cái', quantity: 12, createdAt: '2026-05-20T03:02:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 1, name: 'Thùng carton 5 lớp', specifications: '60×40×30cm',   unit: 'thùng', quantity: 1, createdAt: '2026-05-20T03:20:00.000Z' },
          { id: 2, name: 'Xốp PE bảo vệ',      specifications: 'Dày 5mm',      unit: 'm²',    quantity: 2, createdAt: '2026-05-20T03:35:00.000Z' },
          { id: 3, name: 'Dây đai nhựa',        specifications: 'Rộng 15mm',   unit: 'm',     quantity: 3, createdAt: '2026-05-20T03:48:00.000Z' },
        ],
      },
    },
  },
  {
    id: 2, exportOrderId: 2, mfgProductId: 2, status: 'APPROVED_DETAIL', note: 'PlanForm IEA-3 cho PO GOPLUS',
    piCode: 'PI-2026-002', productionInvoiceId: 2,
    createdAt: ISO('2026-05-21'), proposedAt: ISO('2026-05-21'),
    exportOrder: { id: 2, poNumber: 'PO-GP-002', deliveryDate: ISO('2026-11-01') },
    mfgProduct: { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 2,
      materialType: {
        sat: [
          { id: 4, name: 'Ống sắt tròn Φ16', specifications: 'Φ16×1.0mm', thickness: 1.0, unit: 'cây', quantity: 12, createdAt: '2026-05-21T01:05:00.000Z' },
          { id: 5, name: 'Sắt dẹt 20×3',     specifications: '20×3mm',    thickness: 3.0, unit: 'cây', quantity: 4,  createdAt: '2026-05-21T01:22:00.000Z' },
        ],
        daySon: [
          { id: 3, name: 'Dây nhựa xanh lá', specifications: 'Ø2.5mm, PE',          kg: 2.0, unit: 'cuộn', createdAt: '2026-05-21T01:40:00.000Z' },
          { id: 4, name: 'Dây màu đỏ',        specifications: 'Ø2.5mm, PE điểm nhấn', kg: 0.5, unit: 'cuộn', createdAt: '2026-05-21T01:58:00.000Z' },
          { id: 5, name: 'Sơn xám RAL7035',   specifications: 'Bột sơn tĩnh điện',    kg: 0.6, unit: 'kg',    createdAt: '2026-05-21T02:15:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 4, name: 'Ốc vít M5×15',    specifications: 'Mạ kẽm trắng',   unit: 'cái', quantity: 32, createdAt: '2026-05-21T02:33:00.000Z' },
          { id: 5, name: 'Nắp đầu ống tròn', specifications: 'Φ16mm, nhựa đen', unit: 'cái', quantity: 8,  createdAt: '2026-05-21T02:50:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 4, name: 'Thùng carton 3 lớp', specifications: '50×50×25cm', unit: 'thùng', quantity: 1, createdAt: '2026-05-21T03:08:00.000Z' },
          { id: 5, name: 'Xốp chèn góc',       specifications: '5×5cm, EPE', unit: 'bộ',    quantity: 4, createdAt: '2026-05-21T03:25:00.000Z' },
        ],
      },
    },
  },
  {
    id: 3, exportOrderId: 2, mfgProductId: 1, status: 'APPROVED_DETAIL', note: 'PlanForm JSE-55 cho PO GOPLUS',
    piCode: 'PI-2026-003', productionInvoiceId: 3,
    createdAt: ISO('2026-05-18'), proposedAt: ISO('2026-05-18'),
    exportOrder: { id: 2, poNumber: 'PO-GP-002', deliveryDate: ISO('2026-11-01') },
    mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 3,
      materialType: {
        sat: [
          { id: 6, name: 'Ống sắt hộp 20×40', specifications: '20×40×1.5mm', thickness: 1.5, unit: 'cây', quantity: 18, createdAt: '2026-05-18T02:00:00.000Z' },
          { id: 7, name: 'Sắt tấm 2mm',        specifications: '1000×500×2mm', thickness: 2.0, unit: 'tấm', quantity: 3,  createdAt: '2026-05-18T02:20:00.000Z' },
        ],
        daySon: [
          { id: 6, name: 'Dây PE xám GSS',    specifications: 'Ø3mm, màu xám ghi',  kg: 2.5, unit: 'cuộn', createdAt: '2026-05-18T02:40:00.000Z' },
          { id: 7, name: 'Sơn lót epoxy',      specifications: 'Lót nền chống gỉ',   kg: 0.3, unit: 'kg',    createdAt: '2026-05-18T03:00:00.000Z' },
          { id: 8, name: 'Sơn phủ xám nhạt',  specifications: 'RAL7047 tĩnh điện',   kg: 0.7, unit: 'kg',    createdAt: '2026-05-18T03:20:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 6, name: 'Ốc vít M6×25',        specifications: 'Inox 304',       unit: 'cái', quantity: 36, createdAt: '2026-05-18T03:40:00.000Z' },
          { id: 7, name: 'Tán đinh rivets 4×8',  specifications: 'Nhôm trắng',    unit: 'cái', quantity: 24, createdAt: '2026-05-18T03:58:00.000Z' },
          { id: 8, name: 'Nắp nhựa 40mm',        specifications: 'PP đen, ống hộp', unit: 'cái', quantity: 8,  createdAt: '2026-05-18T04:15:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 6, name: 'Thùng carton sóng kép', specifications: '70×50×35cm',          unit: 'thùng', quantity: 1, createdAt: '2026-05-18T04:32:00.000Z' },
          { id: 7, name: 'Băng keo OPP',           specifications: 'Rộng 48mm, trong suốt', unit: 'cuộn',  quantity: 2, createdAt: '2026-05-18T04:48:00.000Z' },
        ],
      },
    },
  },
  {
    id: 4, exportOrderId: 3, mfgProductId: 1, status: 'APPROVED_PARTS', note: 'PlanForm JSE-55 cho PO IKEA',
    piCode: 'PI-2026-004', productionInvoiceId: 4,
    createdAt: ISO('2026-05-22'), proposedAt: ISO('2026-05-22'),
    exportOrder: { id: 3, poNumber: 'PO-IK-003', deliveryDate: ISO('2026-12-20') },
    mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 4,
      materialType: {
        sat: [
          { id: 8,  name: 'Ống sắt hộp 25×25', specifications: '25×25×1.2mm',      thickness: 1.2, unit: 'cây', quantity: 22, createdAt: '2026-05-22T00:30:00.000Z' },
          { id: 9,  name: 'Sắt chữ L 25×25',   specifications: '25×25×2mm',        thickness: 2.0, unit: 'cây', quantity: 6,  createdAt: '2026-05-22T00:52:00.000Z' },
          { id: 10, name: 'Sắt tấm đục lỗ',    specifications: '800×600×1.5mm, lỗ Φ5', thickness: 1.5, unit: 'tấm', quantity: 1,  createdAt: '2026-05-22T01:12:00.000Z' },
        ],
        daySon: [
          { id: 9,  name: 'Dây PE xám tro',     specifications: 'Ø3mm, màu xám IKEA spec', kg: 2.8, unit: 'cuộn', createdAt: '2026-05-22T01:30:00.000Z' },
          { id: 10, name: 'Sơn tĩnh điện đen',  specifications: 'RAL9005, IKEA approved',   kg: 0.9, unit: 'kg',    createdAt: '2026-05-22T01:48:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 9,  name: 'Ốc vít M6×20',   specifications: 'Mạ kẽm trắng',    unit: 'cái',   quantity: 48, createdAt: '2026-05-22T02:05:00.000Z' },
          { id: 10, name: 'Chốt khóa nhựa', specifications: 'PP đen, snap-fit', unit: 'cái',   quantity: 4,  createdAt: '2026-05-22T02:22:00.000Z' },
          { id: 11, name: 'Đệm vải nỉ',     specifications: '50×50mm, đen',    unit: 'miếng', quantity: 8,  createdAt: '2026-05-22T02:38:00.000Z' },
          { id: 12, name: 'Bulong M8×30',    specifications: 'Inox, kèm đai ốc', unit: 'bộ',   quantity: 4,  createdAt: '2026-05-22T02:55:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 8,  name: 'Thùng carton IKEA', specifications: '65×45×32cm, sóng kép', unit: 'thùng', quantity: 1, createdAt: '2026-05-22T03:10:00.000Z' },
          { id: 9,  name: 'Xốp PE 8mm',        specifications: 'Bảo vệ góc cạnh',      unit: 'm²',    quantity: 3, createdAt: '2026-05-22T03:25:00.000Z' },
          { id: 10, name: 'Túi PE bịt đầu',    specifications: 'Dày 0.05mm',           unit: 'túi',   quantity: 2, createdAt: '2026-05-22T03:40:00.000Z' },
        ],
      },
    },
  },
  {
    id: 5, exportOrderId: 1, mfgProductId: 2, status: 'APPROVED', note: 'PlanForm IEA-3 cho PO MEYING — phê duyệt',
    piCode: 'PI-2026-008', productionInvoiceId: 8,
    createdAt: ISO('2026-05-25'), proposedAt: ISO('2026-05-25'),
    exportOrder: { id: 1, poNumber: 'PO-MY-001', deliveryDate: ISO('2026-10-15') },
    mfgProduct: { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 5,
      materialType: {
        sat: [
          { id: 13, name: 'Ống sắt tròn Φ19', specifications: 'Φ19×1.2mm',          thickness: 1.2, unit: 'cây', quantity: 16, createdAt: '2026-05-25T01:00:00.000Z' },
          { id: 14, name: 'Sắt dẹt 25×3',     specifications: '25×3mm',              thickness: 3.0, unit: 'cây', quantity: 5,  createdAt: '2026-05-25T01:20:00.000Z' },
          { id: 15, name: 'Ống sắt tròn Φ12', specifications: 'Φ12×1.0mm, tay vịn', thickness: 1.0, unit: 'cây', quantity: 4,  createdAt: '2026-05-25T01:40:00.000Z' },
        ],
        daySon: [
          { id: 11, name: 'Dây nhựa trắng kem', specifications: 'Ø3mm, PE chịu UV', kg: 3.5, unit: 'cuộn', createdAt: '2026-05-25T02:00:00.000Z' },
          { id: 12, name: 'Dây màu be',          specifications: 'Ø3mm, phối màu',   kg: 1.2, unit: 'cuộn', createdAt: '2026-05-25T02:18:00.000Z' },
          { id: 13, name: 'Sơn trắng sữa',       specifications: 'RAL9010 tĩnh điện', kg: 0.7, unit: 'kg',    createdAt: '2026-05-25T02:35:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 13, name: 'Ốc vít M5×12',       specifications: 'Inox 304, đầu chìm', unit: 'cái', quantity: 40, createdAt: '2026-05-25T02:52:00.000Z' },
          { id: 14, name: 'Nắp ống tròn Φ19',   specifications: 'Nhựa trắng PP',      unit: 'cái', quantity: 10, createdAt: '2026-05-25T03:08:00.000Z' },
          { id: 15, name: 'Đệm cao su chân ghế', specifications: 'Φ19mm, chống trầy', unit: 'cái', quantity: 4,  createdAt: '2026-05-25T03:25:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 11, name: 'Thùng carton 3 lớp', specifications: '55×55×30cm',      unit: 'thùng', quantity: 1, createdAt: '2026-05-25T03:42:00.000Z' },
          { id: 12, name: 'Túi nilon bọc ngoài', specifications: 'PE trong, 80×60cm', unit: 'túi',   quantity: 1, createdAt: '2026-05-25T03:58:00.000Z' },
          { id: 13, name: 'Xốp EPE góc',         specifications: '40×40×5cm',      unit: 'miếng', quantity: 4, createdAt: '2026-05-25T04:12:00.000Z' },
        ],
      },
    },
  },
  {
    id: 6, exportOrderId: 3, mfgProductId: 2, status: 'APPROVED_PARTS', note: 'PlanForm IEA-3 cho PO IKEA',
    piCode: 'PI-2026-009', productionInvoiceId: 9,
    createdAt: ISO('2026-06-01'), proposedAt: ISO('2026-06-01'),
    exportOrder: { id: 3, poNumber: 'PO-IK-003', deliveryDate: ISO('2026-12-20') },
    mfgProduct: { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 6,
      materialType: {
        sat: [
          { id: 16, name: 'Ống sắt tròn Φ22', specifications: 'Φ22×1.5mm, khung chính',  thickness: 1.5, unit: 'cây', quantity: 14, createdAt: '2026-06-01T01:00:00.000Z' },
          { id: 17, name: 'Sắt hộp 20×20',    specifications: '20×20×1.2mm, thanh ngang', thickness: 1.2, unit: 'cây', quantity: 6,  createdAt: '2026-06-01T01:25:00.000Z' },
        ],
        daySon: [
          { id: 14, name: 'Dây PE đen IKEA',  specifications: 'Ø4mm, IKEA approved',  kg: 4.0, unit: 'cuộn', createdAt: '2026-06-01T01:48:00.000Z' },
          { id: 15, name: 'Dây màu xám đậm',  specifications: 'Ø4mm, phối viền',     kg: 0.8, unit: 'cuộn', createdAt: '2026-06-01T02:05:00.000Z' },
          { id: 16, name: 'Sơn đen bóng',     specifications: 'RAL9005 bóng, IKEA spec', kg: 1.0, unit: 'kg', createdAt: '2026-06-01T02:22:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 16, name: 'Ốc vít M6×16',          specifications: 'Inox 316, biển mặn', unit: 'cái', quantity: 36, createdAt: '2026-06-01T02:40:00.000Z' },
          { id: 17, name: 'Nắp ống tròn Φ22',       specifications: 'PP đen, chống bụi', unit: 'cái', quantity: 8,  createdAt: '2026-06-01T02:58:00.000Z' },
          { id: 18, name: 'Chân nhựa chống trượt',  specifications: 'Φ22mm, TPR đen',    unit: 'cái', quantity: 4,  createdAt: '2026-06-01T03:15:00.000Z' },
          { id: 19, name: 'Vít tự khoan 4×16',      specifications: 'Mạ kẽm',            unit: 'cái', quantity: 20, createdAt: '2026-06-01T03:32:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 14, name: 'Thùng carton IKEA kép', specifications: '70×60×35cm, sóng kép', unit: 'thùng', quantity: 1, createdAt: '2026-06-01T03:50:00.000Z' },
          { id: 15, name: 'Xốp PE cuộn',           specifications: 'Dày 10mm, bọc khung', unit: 'm',     quantity: 4, createdAt: '2026-06-01T04:05:00.000Z' },
          { id: 16, name: 'Nhãn dán IKEA',          specifications: 'Barcode + thông số',  unit: 'tờ',    quantity: 2, createdAt: '2026-06-01T04:20:00.000Z' },
        ],
      },
    },
  },
  {
    id: 7, exportOrderId: 2, mfgProductId: 2, status: 'APPROVED_DETAIL', note: 'PlanForm IEA-3 cho PO GOPLUS (bản sao 1)',
    // Cùng SKU (IEA-3) + cùng PO (GP-002) với PlanForm #2 — 1 SKU chỉ có 1 PI nên dùng chung, không tạo PI mới.
    piCode: 'PI-2026-002', productionInvoiceId: 2,
    createdAt: ISO('2026-06-15'), proposedAt: ISO('2026-06-15'),
    exportOrder: { id: 2, poNumber: 'PO-GP-002', deliveryDate: ISO('2026-11-01') },
    mfgProduct: { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 7,
      materialType: {
        sat: [
          { id: 20, name: 'Ống sắt tròn Φ16', specifications: 'Φ16×1.0mm', thickness: 1.0, unit: 'cây', quantity: 12, createdAt: '2026-06-15T01:05:00.000Z' },
          { id: 21, name: 'Sắt dẹt 20×3',     specifications: '20×3mm',    thickness: 3.0, unit: 'cây', quantity: 4,  createdAt: '2026-06-15T01:22:00.000Z' },
        ],
        daySon: [
          { id: 17, name: 'Dây nhựa xanh lá', specifications: 'Ø2.5mm, PE',          kg: 2.0, unit: 'cuộn', createdAt: '2026-06-15T01:40:00.000Z' },
          { id: 18, name: 'Dây màu đỏ',        specifications: 'Ø2.5mm, PE điểm nhấn', kg: 0.5, unit: 'cuộn', createdAt: '2026-06-15T01:58:00.000Z' },
          { id: 19, name: 'Sơn xám RAL7035',   specifications: 'Bột sơn tĩnh điện',    kg: 0.6, unit: 'kg',    createdAt: '2026-06-15T02:15:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 20, name: 'Ốc vít M5×15',    specifications: 'Mạ kẽm trắng',   unit: 'cái', quantity: 32, createdAt: '2026-06-15T02:33:00.000Z' },
          { id: 21, name: 'Nắp đầu ống tròn', specifications: 'Φ16mm, nhựa đen', unit: 'cái', quantity: 8,  createdAt: '2026-06-15T02:50:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 17, name: 'Thùng carton 3 lớp', specifications: '50×50×25cm', unit: 'thùng', quantity: 1, createdAt: '2026-06-15T03:08:00.000Z' },
          { id: 18, name: 'Xốp chèn góc',       specifications: '5×5cm, EPE', unit: 'bộ',    quantity: 4, createdAt: '2026-06-15T03:25:00.000Z' },
        ],
      },
    },
  },
  {
    id: 8, exportOrderId: 2, mfgProductId: 2, status: 'APPROVED_DETAIL', note: 'PlanForm IEA-3 cho PO GOPLUS (bản sao 2)',
    piCode: 'PI-2026-002', productionInvoiceId: 2,
    createdAt: ISO('2026-06-16'), proposedAt: ISO('2026-06-16'),
    exportOrder: { id: 2, poNumber: 'PO-GP-002', deliveryDate: ISO('2026-11-01') },
    mfgProduct: { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 8,
      materialType: {
        sat: [
          { id: 22, name: 'Ống sắt tròn Φ16', specifications: 'Φ16×1.0mm', thickness: 1.0, unit: 'cây', quantity: 12, createdAt: '2026-06-16T01:05:00.000Z' },
          { id: 23, name: 'Sắt dẹt 20×3',     specifications: '20×3mm',    thickness: 3.0, unit: 'cây', quantity: 4,  createdAt: '2026-06-16T01:22:00.000Z' },
        ],
        daySon: [
          { id: 20, name: 'Dây nhựa xanh lá', specifications: 'Ø2.5mm, PE',          kg: 2.0, unit: 'cuộn', createdAt: '2026-06-16T01:40:00.000Z' },
          { id: 21, name: 'Dây màu đỏ',        specifications: 'Ø2.5mm, PE điểm nhấn', kg: 0.5, unit: 'cuộn', createdAt: '2026-06-16T01:58:00.000Z' },
          { id: 22, name: 'Sơn xám RAL7035',   specifications: 'Bột sơn tĩnh điện',    kg: 0.6, unit: 'kg',    createdAt: '2026-06-16T02:15:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 22, name: 'Ốc vít M5×15',    specifications: 'Mạ kẽm trắng',   unit: 'cái', quantity: 32, createdAt: '2026-06-16T02:33:00.000Z' },
          { id: 23, name: 'Nắp đầu ống tròn', specifications: 'Φ16mm, nhựa đen', unit: 'cái', quantity: 8,  createdAt: '2026-06-16T02:50:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 19, name: 'Thùng carton 3 lớp', specifications: '50×50×25cm', unit: 'thùng', quantity: 1, createdAt: '2026-06-16T03:08:00.000Z' },
          { id: 20, name: 'Xốp chèn góc',       specifications: '5×5cm, EPE', unit: 'bộ',    quantity: 4, createdAt: '2026-06-16T03:25:00.000Z' },
        ],
      },
    },
  },
  // id 9-10: dùng riêng để demo 2 công đoạn cuối (Chuyền kiểm/Đóng gói) ở "Bảng thống kê" (KHSX) —
  // xem ghi chú ở genExecutionStages trong ThongKePagePlan.tsx.
  {
    id: 9, exportOrderId: 9, mfgProductId: 3, status: 'APPROVED', note: 'PlanForm JSE-60 cho PO MEYING — đang Chuyền kiểm',
    piCode: 'PI-2026-010', productionInvoiceId: 10,
    createdAt: ISO('2026-06-05'), proposedAt: ISO('2026-06-05'),
    exportOrder: { id: 9, poNumber: 'PO-MY-009', deliveryDate: ISO('2026-09-20') },
    mfgProduct: { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60' },
    customerName: 'MEYING USA',
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: { id: 9, materialType: { sat: [], daySon: [], vatTuPhuKien: [], baoBiDongGoi: [] } },
  },
  {
    id: 10, exportOrderId: 10, mfgProductId: 1, status: 'APPROVED', note: 'PlanForm JSE-55 cho PO IKEA — đang Đóng gói',
    piCode: 'PI-2026-011', productionInvoiceId: 11,
    createdAt: ISO('2026-06-08'), proposedAt: ISO('2026-06-08'),
    exportOrder: { id: 10, poNumber: 'PO-IK-010', deliveryDate: ISO('2026-09-25') },
    mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' },
    customerName: 'IKEA Supplier',
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: { id: 10, materialType: { sat: [], daySon: [], vatTuPhuKien: [], baoBiDongGoi: [] } },
  },
  // id 11 — SKU MOCK ĐẦY ĐỦ ĐỂ TEST TOÀN BỘ HỆ THỐNG (TEST-01 / PO-TEST-001 / PI-2026-012).
  // Đã APPROVED sẵn (bỏ qua chuỗi duyệt) + đủ 4 nhóm định mức vật tư để "Lệnh kiểm tra vật tư"
  // (KiemTraVatTuPage) có dữ liệu thật ngay khi gửi yêu cầu. Chưa có SalesPO nào dùng SKU này —
  // vào Sales > Đơn hàng > Tạo đơn để chọn "TEST-01" và chạy tiếp toàn bộ luồng từ đầu.
  {
    id: 11, exportOrderId: 100, mfgProductId: 4, status: 'APPROVED', note: 'SKU mock TEST-01 — dùng để test toàn bộ hệ thống',
    piCode: 'PI-2026-012', productionInvoiceId: 12,
    createdAt: ISO('2026-07-01'), proposedAt: ISO('2026-07-01'),
    exportOrder: { id: 100, poNumber: 'PO-TEST-001', deliveryDate: ISO('2026-12-31') },
    mfgProduct: { id: 4, factoryCode: 'TEST-01', name: 'Ghế Test Đầy Đủ' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 11,
      materialType: {
        // Khớp tên + tổng số lượng với manhData.sat bên dưới (20 = 20 Mảnh Tựa; 40 = 20 Tựa +
        // 10 Tay Trái + 10 Tay Phải; 15/15 = Mảnh Mê) — để lúc "Bắt đầu sản xuất" đồng bộ
        // sang "Xuất sắt cho Phôi" theo đúng mảnh mà tổng vẫn khớp với vật tư đã kiểm ở đây.
        // Nhóm sat này chỉ còn là dữ liệu lịch sử — định mức chi tiết không còn nhập/hiển thị Sắt nữa.
        sat: [
          { id: 24, name: 'Ống sắt 25×25', specifications: '25×25×1.2mm', thickness: 1.2, unit: 'cây', quantity: 20, createdAt: '2026-07-01T01:00:00.000Z' },
          { id: 25, name: 'Ống sắt Ø16',   specifications: 'Φ16×1.0mm',    thickness: 1.0, unit: 'cây', quantity: 40, createdAt: '2026-07-01T01:10:00.000Z' },
          { id: 26, name: 'Ống sắt 25×50', specifications: '25×50×1.2mm', thickness: 1.2, unit: 'cây', quantity: 15, createdAt: '2026-07-01T01:20:00.000Z' },
          { id: 27, name: 'Ống sắt 20×40', specifications: '20×40×1.5mm', thickness: 1.5, unit: 'cây', quantity: 15, createdAt: '2026-07-01T01:30:00.000Z' },
        ],
        daySon: [
          { id: 23, name: 'Dây PE đen test',      specifications: 'Ø3mm, cuộn 500m',  kg: 3.0, unit: 'cuộn', createdAt: '2026-07-01T01:45:00.000Z' },
          { id: 24, name: 'Sơn tĩnh điện đen test', specifications: 'RAL9005, bột mịn', kg: 1.5, unit: 'kg',    createdAt: '2026-07-01T02:00:00.000Z' },
        ],
        vatTuPhuKien: [
          { id: 24, name: 'Ốc vít M6×20',        specifications: 'Inox 304',       unit: 'cái', quantity: 60, createdAt: '2026-07-01T02:15:00.000Z' },
          { id: 25, name: 'Nắp nhựa đầu ống',     specifications: '25×25mm, PP đen', unit: 'cái', quantity: 20, createdAt: '2026-07-01T02:30:00.000Z' },
          { id: 26, name: 'Đệm cao su chân ghế',  specifications: 'Dày 3mm',         unit: 'cái', quantity: 16, createdAt: '2026-07-01T02:45:00.000Z' },
        ],
        baoBiDongGoi: [
          { id: 21, name: 'Thùng carton 5 lớp', specifications: '60×40×30cm', unit: 'thùng', quantity: 1, createdAt: '2026-07-01T03:00:00.000Z' },
          { id: 22, name: 'Xốp PE bảo vệ',       specifications: 'Dày 5mm',    unit: 'm²',    quantity: 2, createdAt: '2026-07-01T03:15:00.000Z' },
          { id: 23, name: 'Dây đai nhựa',        specifications: 'Rộng 15mm',  unit: 'm',     quantity: 3, createdAt: '2026-07-01T03:30:00.000Z' },
        ],
      },
    },
    // Định mức mảnh (tab "Định mức mảnh" ở Duyệt SKU/Danh sách SKU) — khác với seedFramePieces
    // (BOM gốc theo sản phẩm, dùng ở "Quản lý định mức"): đây là dữ liệu account Sắt nhập riêng
    // cho SKU/PO này. 4 mảnh, mỗi mảnh chỉ liệt kê loại SẮT (không gồm phụ kiện hàn như Pát/Chốt —
    // ManhChildRow chỉ dành cho sắt, xem comment ManhChildRow trong types/plan-form.ts).
    // qty ở đây là TỔNG số cây cần cho cả PO (100 ghế) theo từng mảnh — do account Sắt tính
    // sẵn từ định mức/mảnh (FramePiece) nhân số lượng PO, không phải số cây cho 1 ghế. Tổng
    // theo từng loại sắt phải khớp quotaManagement.sat ở trên.
    manhData: {
      sat: [
        { id: 1, name: 'Mảnh Tựa', qtyPerSku: '1', children: [
          { id: 1, name: 'Ống sắt 25×25', specs: '25×25×1.2mm', length: '680', qty: '20' },
          { id: 2, name: 'Ống sắt Ø16',   specs: 'Φ16×1.0mm',    length: '450', qty: '20' },
        ]},
        { id: 2, name: 'Mảnh Mê', qtyPerSku: '1', children: [
          { id: 3, name: 'Ống sắt 25×50', specs: '25×50×1.2mm', length: '500', qty: '15' },
          { id: 4, name: 'Ống sắt 20×40', specs: '20×40×1.5mm', length: '480', qty: '15' },
        ]},
        { id: 3, name: 'Mảnh Tay Trái', qtyPerSku: '1', children: [
          { id: 5, name: 'Ống sắt Ø16', specs: 'Φ16×1.0mm', length: '550', qty: '10' },
        ]},
        { id: 4, name: 'Mảnh Tay Phải', qtyPerSku: '1', children: [
          { id: 6, name: 'Ống sắt Ø16', specs: 'Φ16×1.0mm', length: '550', qty: '10' },
        ]},
      ],
      // Mảnh dây — tách ra từ "Dây/Sơn" chi tiết cũ, do NV Dây/Sơn nhập ở bước định mức mảnh.
      daySon: [
        { id: 100, name: 'Dây PE đen test', specifications: 'Ø3mm, cuộn 500m', kg: 3.0, unit: 'cuộn', createdAt: '2026-07-01T01:45:00.000Z' },
      ],
    },
    manhEntryMeta: {
      sat: { enteredBy: 'NV Sắt Đức', enteredAt: '2026-07-01T04:00:00.000Z' },
      daySon: { enteredBy: 'NV Dây/Sơn Hà', enteredAt: '2026-07-01T04:10:00.000Z' },
    },
    manhReviewStatus: {
      sat: { status: 'APPROVED', reviewedAt: '2026-07-01T04:30:00.000Z' },
      daySon: { status: 'APPROVED', reviewedAt: '2026-07-01T04:35:00.000Z' },
    },
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

export const seedFrameProducts = [
  { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55', framePieceCount: 4 },
  { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3', framePieceCount: 3 },
  { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60', framePieceCount: 4 },
  // id 4: TEST-01 — cùng id với seedMfgProducts (không bắt buộc, nhưng để dễ đối chiếu vì
  // 2 danh sách này KHÔNG liên kết với nhau qua id, chỉ trùng ngẫu nhiên ở 3 dòng trên).
  { id: 4, factoryCode: 'TEST-01', name: 'Ghế Test Đầy Đủ', framePieceCount: 4 },
];

// Định mức mảnh của TEST-01 — 4 mảnh ghép thành 1 ghế: Tựa, Mê, Tay trái, Tay phải. Mảnh
// nào cũng có thể đan được (isWoven không cố định theo loại mảnh, tùy sản phẩm) — cả 4 mảnh
// đều đánh dấu isWoven ở đây. Mỗi mảnh có vật tư sắt riêng, cắt (Phôi) → hàn (Hàn) → sơn (Sơn)
// thành "khung hàn" rồi "mảnh chưa đan"; xuất đan/nhập đan xong thành "mảnh đã đan" (thành
// phẩm). Vật tư khung: nhóm Sắt ống + phụ kiện hàn-vào-khung (Pát/Ô tròn lỗ dù) — không gồm
// phụ kiện lắp ráp (bulong, ốc...) do Mua hàng lo riêng.
export const seedFramePieces = [
  { id: 1, productId: 1, code: 'GHE-J55-1', name: 'Ghế J55 - Đế', groupNumber: 1, materials: [] },
  { id: 2, productId: 1, code: 'GHE-J55-2', name: 'Ghế J55 - Lưng', groupNumber: 1, materials: [] },
  { id: 3, productId: 2, code: 'IEA-3-1', name: 'Ghế IEA-3 - Khung', groupNumber: 1, materials: [] },
  {
    id: 10, productId: 4, code: 'TEST-01.1.1', name: 'Mảnh Tựa', groupNumber: 1, pieceNumber: 1,
    quantityPerSet: 1, isWoven: true, weavingPrice: 15000,
    materials: [
      { id: 101, materialId: 1,  material: { id: 1,  code: 'SAT-25',      name: 'Ống sắt 25×25', unit: 'cm',  materialGroupId: 1, materialGroup: { name: 'Sắt ống' } }, quantity: 136, spec: '25×25×1.2mm',   cutLengthMm: 680, piecesPerFrame: 2, operations: ['CAT', 'UON'], needsHan: true, needsSon: true },
      { id: 102, materialId: 13, material: { id: 13, code: 'SAT-16',      name: 'Ống sắt Ø16',   unit: 'cm',  materialGroupId: 1, materialGroup: { name: 'Sắt ống' } }, quantity: 90,  spec: 'Φ16×1.0mm',      cutLengthMm: 450, piecesPerFrame: 2, operations: ['CAT'],        needsHan: true, needsSon: true },
      { id: 103, materialId: 16, material: { id: 16, code: 'PAT-KINH',    name: 'Pát kính',      unit: 'cái', materialGroupId: 3, materialGroup: { name: 'Phụ kiện' } }, quantity: 2,   spec: 'Pát kính 3 lỗ',   cutLengthMm: null, piecesPerFrame: 2, operations: ['DUC_LO'],     needsHan: true, needsSon: false },
    ],
  },
  {
    id: 11, productId: 4, code: 'TEST-01.1.2', name: 'Mảnh Mê', groupNumber: 1, pieceNumber: 2,
    quantityPerSet: 1, isWoven: true, weavingPrice: 20000,
    materials: [
      { id: 104, materialId: 8,  material: { id: 8,  code: 'SAT-50X25',   name: 'Ống sắt 25×50',    unit: 'cm',  materialGroupId: 1, materialGroup: { name: 'Sắt ống' } }, quantity: 100, spec: '25×50×1.2mm', cutLengthMm: 500, piecesPerFrame: 2, operations: ['CAT', 'DUC_LO'], needsHan: true, needsSon: true },
      { id: 105, materialId: 3,  material: { id: 3,  code: 'SAT-20',      name: 'Ống sắt 20×40',    unit: 'cm',  materialGroupId: 1, materialGroup: { name: 'Sắt ống' } }, quantity: 96,  spec: '20×40×1.5mm', cutLengthMm: 480, piecesPerFrame: 2, operations: ['CAT'],            needsHan: true, needsSon: true },
      { id: 106, materialId: 11, material: { id: 11, code: 'O-TRON-LO-DU', name: 'Ô tròn lỗ dù',    unit: 'cái', materialGroupId: 3, materialGroup: { name: 'Phụ kiện' } }, quantity: 4,   spec: 'Φ25mm',       cutLengthMm: null, piecesPerFrame: 4, operations: ['DUC_LO'],         needsHan: true, needsSon: false },
    ],
  },
  {
    id: 12, productId: 4, code: 'TEST-01.2.1', name: 'Mảnh Tay Trái', groupNumber: 2, pieceNumber: 1,
    quantityPerSet: 1, isWoven: true, weavingPrice: 10000,
    materials: [
      { id: 107, materialId: 13, material: { id: 13, code: 'SAT-16',  name: 'Ống sắt Ø16', unit: 'cm',  materialGroupId: 1, materialGroup: { name: 'Sắt ống' } }, quantity: 55, spec: 'Φ16×1.0mm',         cutLengthMm: 550, piecesPerFrame: 1, operations: ['CAT', 'UON'], needsHan: true, needsSon: true },
      { id: 108, materialId: 9,  material: { id: 9,  code: 'CHOT-10', name: 'Chốt 10mm',   unit: 'cái', materialGroupId: 3, materialGroup: { name: 'Phụ kiện' } }, quantity: 2,  spec: 'Chốt định vị 10mm', cutLengthMm: null, piecesPerFrame: 2, operations: [],             needsHan: true, needsSon: false },
    ],
  },
  {
    id: 13, productId: 4, code: 'TEST-01.2.2', name: 'Mảnh Tay Phải', groupNumber: 2, pieceNumber: 2,
    quantityPerSet: 1, isWoven: true, weavingPrice: 10000,
    materials: [
      { id: 109, materialId: 13, material: { id: 13, code: 'SAT-16',  name: 'Ống sắt Ø16', unit: 'cm',  materialGroupId: 1, materialGroup: { name: 'Sắt ống' } }, quantity: 55, spec: 'Φ16×1.0mm',         cutLengthMm: 550, piecesPerFrame: 1, operations: ['CAT', 'UON'], needsHan: true, needsSon: true },
      { id: 110, materialId: 9,  material: { id: 9,  code: 'CHOT-10', name: 'Chốt 10mm',   unit: 'cái', materialGroupId: 3, materialGroup: { name: 'Phụ kiện' } }, quantity: 2,  spec: 'Chốt định vị 10mm', cutLengthMm: null, piecesPerFrame: 2, operations: [],             needsHan: true, needsSon: false },
    ],
  },
];

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
    salesCustomers: structuredClone(seedSalesCustomers),
    salesPOs: structuredClone(seedSalesPOs),
    mfgExportCustomers: structuredClone(seedMfgExportCustomers),
    mfgProducts: structuredClone(seedMfgProducts),
    productVariants: structuredClone(seedProductVariants),
    exportOrders: structuredClone(seedExportOrders),
    productionInvoices: structuredClone(seedProductionInvoices),
    planningPIs: structuredClone(seedPlanningPIs),
    planForms: structuredClone(seedPlanForms),
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
    frameProducts: structuredClone(seedFrameProducts),
    framePieces: structuredClone(seedFramePieces),
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

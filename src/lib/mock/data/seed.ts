import type { Product, Promotion, Quotation, RetailCustomer, CareReminder, WholesaleCustomer, WholesaleCareReminder } from '../../../types';
import type { PlanForm } from '../../../types/plan-form';
import {
  seedPhoiExecutions,
  seedStageExec,
  seedWeavingFinishedFrames,
  seedWeavingManhSummary,
  seedWeavingByPoint,
  seedWeavingReceiptHistory,
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
// CRM DATA: SALES & CUSTOMERS
// ══════════════════════════════════════════════════════════════════════════════

export const seedProducts: Product[] = [
  // Ghế xuất khẩu
  { id: 'JSE-55', name: 'Ghế J55 (Khung sắt)', materials: 'Sắt vuông 25×25, dây PE đen', price: 1200000, category: 'Ghế' },
  { id: 'IEA-3', name: 'Ghế đan IEA-3 (Dây đan)', materials: 'Khung sắt Ø16, dây nhựa đan', price: 1500000, category: 'Ghế đan' },
  { id: 'JSE-60', name: 'Ghế J60 (Khung sắt lớn)', materials: 'Sắt vuông 30×30, dây PE xám', price: 1800000, category: 'Ghế' },
  // Bàn
  { id: 'TB-45', name: 'Bàn TB-45 (Vuông)', materials: 'Sắt ống 25×25, mặt gỗ', price: 2500000, category: 'Bàn' },
  { id: 'TB-50', name: 'Bàn TB-50 (Chữ nhật)', materials: 'Sắt ống 30×30, mặt nhôm', price: 3000000, category: 'Bàn' },
  // Sofa/Phòng khách
  { id: 'SF-10', name: 'Ghế sofa SF-10', materials: 'Khung gỗ, nệm', price: 4500000, category: 'Sofa' },
  { id: 'SF-15', name: 'Ghế sofa SF-15 (2 chỗ)', materials: 'Khung sắt, nệm', price: 5500000, category: 'Sofa' },
  // Ngoài trời
  { id: 'OUT-25', name: 'Ghế ngoài trời OUT-25', materials: 'Thép không gỉ, dây PE', price: 2200000, category: 'Ngoài trời' },
  { id: 'OUT-30', name: 'Bộ bàn ghế ngoài trời OUT-30', materials: 'Thép, mặt gỗ teak', price: 8000000, category: 'Ngoài trời' },
];

export const seedAgencyWarehouses = [
  { id: 'A01', name: 'Kho Đại Lý Q7, TP.HCM', region: 'Miền Nam' },
  { id: 'A02', name: 'Kho Đại Lý Hà Nội', region: 'Miền Bắc' },
  { id: 'A03', name: 'Kho Đại Lý Đà Nẵng', region: 'Miền Trung' },
];

// Sales Users - Nhân viên bán hàng
export const seedSalesUsers = [
  { id: 2, name: 'Nguyễn Hải', email: 'hai@sales.com', salesType: 'RETAIL' },
  { id: 3, name: 'Trương Vy', email: 'vy@sales.com', salesType: 'RETAIL' },
  { id: 4, name: 'Lê Đức Trọng', email: 'duc.trong@sales.com', salesType: 'WHOLESALE' },
  { id: 5, name: 'Phạm Minh Quân', email: 'quan@sales.com', salesType: 'WHOLESALE' },
  { id: 6, name: 'Hoàng Thu Hà', email: 'ha@sales.com', salesType: 'RETAIL' },
];

// Retail Customers - Khách hàng lẻ
export const seedRetailCustomers: RetailCustomer[] = [
  {
    id: 1, name: 'Nguyễn Văn Dũng', phone: '0901111111', email: 'dung@mail.com', address: 'Q7, TP.HCM',
    debt: 0, createdAt: ISO('2026-01-10'), agencyWarehouseId: 'A01', assignedSalesId: 2,
    agencyWarehouse: { id: 'A01', name: 'Kho Đại Lý Q7, TP.HCM', region: 'Miền Nam' },
    assignedSales: { id: 2, name: 'Nguyễn Hải', email: 'hai@sales.com', salesType: 'RETAIL' },
    orderCount: 4, totalRevenue: 48000000,
  },
  {
    id: 2, name: 'Trần Thị Thủy', phone: '0902222222', debt: 1500000, createdAt: ISO('2026-02-01'),
    agencyWarehouseId: 'A01', assignedSalesId: 2, orderCount: 2, totalRevenue: 13000000,
    agencyWarehouse: { id: 'A01', name: 'Kho Đại Lý Q7, TP.HCM', region: 'Miền Nam' },
    assignedSales: { id: 2, name: 'Nguyễn Hải', email: 'hai@sales.com', salesType: 'RETAIL' },
  },
  {
    id: 3, name: 'Phạm Hoàng Nam', phone: '0903333444', email: 'nam@mail.com', address: 'Q1, TP.HCM',
    debt: 0, createdAt: ISO('2026-03-15'), agencyWarehouseId: 'A01', assignedSalesId: 3,
    agencyWarehouse: { id: 'A01', name: 'Kho Đại Lý Q7, TP.HCM', region: 'Miền Nam' },
    assignedSales: { id: 3, name: 'Trương Vy', email: 'vy@sales.com', salesType: 'RETAIL' },
    orderCount: 3, totalRevenue: 25500000,
  },
  {
    id: 4, name: 'Bùi Minh Tuấn', phone: '0904444555', email: 'tuan@mail.com', address: 'Gò Vấp, TP.HCM',
    debt: 3000000, createdAt: ISO('2026-01-20'), agencyWarehouseId: 'A01', assignedSalesId: 3,
    agencyWarehouse: { id: 'A01', name: 'Kho Đại Lý Q7, TP.HCM', region: 'Miền Nam' },
    assignedSales: { id: 3, name: 'Trương Vy', email: 'vy@sales.com', salesType: 'RETAIL' },
    orderCount: 2, totalRevenue: 8500000,
  },
  {
    id: 5, name: 'Võ Thị Liên', phone: '0905555666', email: 'lien@mail.com', address: 'Hà Nội',
    debt: 0, createdAt: ISO('2026-02-10'), agencyWarehouseId: 'A02', assignedSalesId: 6,
    agencyWarehouse: { id: 'A02', name: 'Kho Đại Lý Hà Nội', region: 'Miền Bắc' },
    assignedSales: { id: 6, name: 'Hoàng Thu Hà', email: 'ha@sales.com', salesType: 'RETAIL' },
    orderCount: 1, totalRevenue: 4500000,
  },
  {
    id: 6, name: 'Dương Quốc Huy', phone: '0906666777', email: 'huy@mail.com', address: 'Biên Hòa, Đồng Nai',
    debt: 2000000, createdAt: ISO('2026-03-05'), agencyWarehouseId: 'A01', assignedSalesId: 2,
    agencyWarehouse: { id: 'A01', name: 'Kho Đại Lý Q7, TP.HCM', region: 'Miền Nam' },
    assignedSales: { id: 2, name: 'Nguyễn Hải', email: 'hai@sales.com', salesType: 'RETAIL' },
    orderCount: 2, totalRevenue: 11000000,
  },
  {
    id: 7, name: 'Lê Thị Hương', phone: '0907777888', email: 'huong@mail.com', address: 'Đà Nẵng',
    debt: 0, createdAt: ISO('2026-01-25'), agencyWarehouseId: 'A03', assignedSalesId: 6,
    agencyWarehouse: { id: 'A03', name: 'Kho Đại Lý Đà Nẵng', region: 'Miền Trung' },
    assignedSales: { id: 6, name: 'Hoàng Thu Hà', email: 'ha@sales.com', salesType: 'RETAIL' },
    orderCount: 1, totalRevenue: 5500000,
  },
];

// Wholesale Customers - Khách hàng sỉ
export const seedWholesaleCustomers: WholesaleCustomer[] = [
  {
    id: 1, businessName: 'Minh Anh Trading Co.', representativeName: 'Lê Minh Anh', phone: '0913333333',
    address: 'Hà Nội', debt: 5000000, createdAt: ISO('2026-01-05'), assignedSalesId: 4,
    assignedSales: { id: 4, name: 'Lê Đức Trọng', salesType: 'WHOLESALE' }, orderCount: 5, totalRevenue: 245000000,
  },
  {
    id: 2, businessName: 'Green Garden JSC', representativeName: 'Võ Thanh Bình', phone: '0914444555',
    address: 'Đà Nẵng', debt: 0, createdAt: ISO('2026-02-20'), assignedSalesId: 4,
    assignedSales: { id: 4, name: 'Lê Đức Trọng', salesType: 'WHOLESALE' }, orderCount: 3, totalRevenue: 95000000,
  },
  {
    id: 3, businessName: 'Phú Hồng Furniture', representativeName: 'Ngô Hùng Anh', phone: '0915555666',
    address: 'TP.HCM', debt: 8000000, createdAt: ISO('2026-01-15'), assignedSalesId: 5,
    assignedSales: { id: 5, name: 'Phạm Minh Quân', salesType: 'WHOLESALE' }, orderCount: 4, totalRevenue: 180000000,
  },
  {
    id: 4, businessName: 'Thiên Ân Construction', representativeName: 'Trần Quốc Huy', phone: '0916666777',
    address: 'Biên Hòa', debt: 0, createdAt: ISO('2026-03-01'), assignedSalesId: 5,
    assignedSales: { id: 5, name: 'Phạm Minh Quân', salesType: 'WHOLESALE' }, orderCount: 2, totalRevenue: 52000000,
  },
];

// Promotions - Chương trình khuyến mãi
export const seedPromotions: Promotion[] = [
  {
    id: 1, name: 'Giảm 5% khách lẻ T6/2026', description: 'Áp dụng cho đơn hàng lẻ từ 10 triệu VNĐ trở lên', orderType: 'RETAIL',
    startDate: ISO('2026-06-01'), endDate: ISO('2026-06-30'), createdAt: ISO('2026-05-20'),
  },
  {
    id: 2, name: 'Giảm 10% khách sỉ Q2/2026', description: 'Giảm cho tất cả khách sỉ, áp dụng từ 50M VNĐ', orderType: 'WHOLESALE',
    startDate: ISO('2026-04-01'), endDate: ISO('2026-06-30'), createdAt: ISO('2026-03-25'),
  },
  {
    id: 3, name: 'Miễn vận chuyển đơn từ 30M', description: 'Áp dụng cho cả lẻ và sỉ', orderType: 'RETAIL',
    startDate: ISO('2026-05-15'), endDate: ISO('2026-07-31'), createdAt: ISO('2026-05-10'),
  },
];

// Care Reminders - Nhắc nhở chăm sóc khách hàng lẻ
export const seedCareReminders: CareReminder[] = [
  // Customer 1
  {
    id: 1, dueDate: ISO('2026-06-25'), isCompleted: false, retailCustomerId: 1,
    retailCustomer: { id: 1, name: 'Nguyễn Văn Dũng' }, createdAt: ISO('2026-06-10'),
  },
  {
    id: 2, dueDate: ISO('2026-06-05'), isCompleted: true, retailCustomerId: 1,
    retailCustomer: { id: 1, name: 'Nguyễn Văn Dũng' }, createdAt: ISO('2026-05-15'),
  },
  // Customer 2
  {
    id: 3, dueDate: ISO('2026-06-28'), isCompleted: false, retailCustomerId: 2,
    retailCustomer: { id: 2, name: 'Trần Thị Thủy' }, createdAt: ISO('2026-06-08'),
  },
  // Customer 3
  {
    id: 4, dueDate: ISO('2026-06-22'), isCompleted: false, retailCustomerId: 3,
    retailCustomer: { id: 3, name: 'Phạm Hoàng Nam' }, createdAt: ISO('2026-06-05'),
  },
  {
    id: 5, dueDate: ISO('2026-06-10'), isCompleted: true, retailCustomerId: 3,
    retailCustomer: { id: 3, name: 'Phạm Hoàng Nam' }, createdAt: ISO('2026-05-20'),
  },
  // Customer 4
  {
    id: 6, dueDate: ISO('2026-06-30'), isCompleted: false, retailCustomerId: 4,
    retailCustomer: { id: 4, name: 'Bùi Minh Tuấn' }, createdAt: ISO('2026-06-12'),
  },
  // Customer 5
  {
    id: 7, dueDate: ISO('2026-07-05'), isCompleted: false, retailCustomerId: 5,
    retailCustomer: { id: 5, name: 'Võ Thị Liên' }, createdAt: ISO('2026-06-15'),
  },
  // Customer 6
  {
    id: 8, dueDate: ISO('2026-06-29'), isCompleted: false, retailCustomerId: 6,
    retailCustomer: { id: 6, name: 'Dương Quốc Huy' }, createdAt: ISO('2026-06-10'),
  },
];

// Wholesale Care Reminders - Nhắc nhở chăm sóc khách hàng sỉ
export const seedWholesaleCareReminders: WholesaleCareReminder[] = [
  {
    id: 1, dueDate: ISO('2026-06-25'), isCompleted: false, wholesaleCustomerId: 1,
    wholesaleCustomer: { id: 1, businessName: 'Minh Anh Trading Co.' }, createdAt: ISO('2026-06-10'),
  },
  {
    id: 2, dueDate: ISO('2026-06-10'), isCompleted: true, wholesaleCustomerId: 1,
    wholesaleCustomer: { id: 1, businessName: 'Minh Anh Trading Co.' }, createdAt: ISO('2026-05-20'),
  },
  {
    id: 3, dueDate: ISO('2026-06-28'), isCompleted: false, wholesaleCustomerId: 2,
    wholesaleCustomer: { id: 2, businessName: 'Green Garden JSC' }, createdAt: ISO('2026-06-08'),
  },
  {
    id: 4, dueDate: ISO('2026-06-22'), isCompleted: false, wholesaleCustomerId: 3,
    wholesaleCustomer: { id: 3, businessName: 'Phú Hồng Furniture' }, createdAt: ISO('2026-06-05'),
  },
  {
    id: 5, dueDate: ISO('2026-06-30'), isCompleted: false, wholesaleCustomerId: 4,
    wholesaleCustomer: { id: 4, businessName: 'Thiên Ân Construction' }, createdAt: ISO('2026-06-12'),
  },
];

// Quotations - Báo giá
export const seedQuotations: Quotation[] = [
  // Quotation 1 - For customer 1
  {
    id: 1, code: 'BG-2026-001', status: 'APPROVED', orderType: 'RETAIL',
    customerName: 'Nguyễn Văn Dũng', customerPhone: '0901111111', customerAddress: 'Q7, TP.HCM',
    quotationDate: ISO('2026-05-01'), items: [
      { id: 1, productId: 'JSE-55', product: { id: 'JSE-55', name: 'Ghế J55 (Khung sắt)' }, quantity: 10, unitPrice: 1200000, subtotal: 12000000 },
      { id: 2, productId: 'TB-45', product: { id: 'TB-45', name: 'Bàn TB-45 (Vuông)' }, quantity: 2, unitPrice: 2500000, subtotal: 5000000 },
    ],
    discountPercent: 0, discountAmount: 0, totalAmount: 17000000, createdById: 2,
    createdBy: { id: 2, name: 'Nguyễn Hải' }, retailCustomerId: 1, retailCustomer: { id: 1, name: 'Nguyễn Văn Dũng' },
    createdAt: ISO('2026-05-01'),
  },
  // Quotation 2 - For customer 2
  {
    id: 2, code: 'BG-2026-002', status: 'PENDING', orderType: 'RETAIL',
    customerName: 'Trần Thị Thủy', customerPhone: '0902222222', customerAddress: 'Q7, TP.HCM',
    quotationDate: ISO('2026-06-05'), items: [
      { id: 3, productId: 'SF-10', product: { id: 'SF-10', name: 'Ghế sofa SF-10' }, quantity: 1, unitPrice: 4500000, subtotal: 4500000 },
    ],
    discountPercent: 0, discountAmount: 0, totalAmount: 4500000, createdById: 2,
    createdBy: { id: 2, name: 'Nguyễn Hải' }, retailCustomerId: 2, retailCustomer: { id: 2, name: 'Trần Thị Thủy' },
    createdAt: ISO('2026-06-05'),
  },
  // Quotation 3 - For wholesale customer 1
  {
    id: 3, code: 'BG-2026-003', status: 'APPROVED', orderType: 'WHOLESALE',
    customerName: 'Minh Anh Trading Co.', customerPhone: '0913333333', customerAddress: 'Hà Nội',
    quotationDate: ISO('2026-05-20'), items: [
      { id: 4, productId: 'JSE-55', product: { id: 'JSE-55', name: 'Ghế J55 (Khung sắt)' }, quantity: 50, unitPrice: 1000000, subtotal: 50000000 },
      { id: 5, productId: 'TB-45', product: { id: 'TB-45', name: 'Bàn TB-45 (Vuông)' }, quantity: 20, unitPrice: 2200000, subtotal: 44000000 },
    ],
    discountPercent: 10, discountAmount: 9400000, totalAmount: 84600000, createdById: 4,
    createdBy: { id: 4, name: 'Lê Đức Trọng' }, wholesaleCustomerId: 1, wholesaleCustomer: { id: 1, businessName: 'Minh Anh Trading Co.' },
    createdAt: ISO('2026-05-20'),
  },
  // Quotation 4 - For wholesale customer 3
  {
    id: 4, code: 'BG-2026-004', status: 'DRAFT', orderType: 'WHOLESALE',
    customerName: 'Phú Hồng Furniture', customerPhone: '0915555666', customerAddress: 'TP.HCM',
    quotationDate: ISO('2026-06-15'), items: [
      { id: 6, productId: 'IEA-3', product: { id: 'IEA-3', name: 'Ghế đan IEA-3 (Dây đan)' }, quantity: 30, unitPrice: 1200000, subtotal: 36000000 },
      { id: 7, productId: 'OUT-30', product: { id: 'OUT-30', name: 'Bộ bàn ghế ngoài trời OUT-30' }, quantity: 5, unitPrice: 7500000, subtotal: 37500000 },
    ],
    discountPercent: 5, discountAmount: 3675000, totalAmount: 69825000, createdById: 5,
    createdBy: { id: 5, name: 'Phạm Minh Quân' }, wholesaleCustomerId: 3, wholesaleCustomer: { id: 3, businessName: 'Phú Hồng Furniture' },
    createdAt: ISO('2026-06-15'),
  },
];

// Orders - Đơn hàng bán
export const seedOrders = [
  // Retail orders
  {
    id: 'LE-001', customerName: 'Nguyễn Văn Dũng', phone: '0901111111', date: ISO('2026-05-05'),
    details: 'JSE-55 × 10, TB-45 × 2', quantity: 12, total: 17000000, paymentPercent: 100, status: 'DONE', orderType: 'RETAIL',
  },
  {
    id: 'LE-002', customerName: 'Trần Thị Thủy', phone: '0902222222', date: ISO('2026-06-10'),
    details: 'SF-10 × 1', quantity: 1, total: 4500000, paymentPercent: 50, status: 'PROCESSING', orderType: 'RETAIL',
  },
  {
    id: 'LE-003', customerName: 'Phạm Hoàng Nam', phone: '0903333444', date: ISO('2026-04-20'),
    details: 'JSE-60 × 5, TB-50 × 3', quantity: 8, total: 18000000, paymentPercent: 100, status: 'DONE', orderType: 'RETAIL',
  },
  {
    id: 'LE-004', customerName: 'Bùi Minh Tuấn', phone: '0904444555', date: ISO('2026-06-15'),
    details: 'OUT-25 × 2', quantity: 2, total: 4400000, paymentPercent: 0, status: 'PENDING', orderType: 'RETAIL',
  },
  {
    id: 'LE-005', customerName: 'Võ Thị Liên', phone: '0905555666', date: ISO('2026-02-10'),
    details: 'SF-15 × 1', quantity: 1, total: 5500000, paymentPercent: 100, status: 'DONE', orderType: 'RETAIL',
  },
  {
    id: 'LE-006', customerName: 'Dương Quốc Huy', phone: '0906666777', date: ISO('2026-05-30'),
    details: 'IEA-3 × 4', quantity: 4, total: 6000000, paymentPercent: 50, status: 'PROCESSING', orderType: 'RETAIL',
  },
  {
    id: 'LE-007', customerName: 'Lê Thị Hương', phone: '0907777888', date: ISO('2026-01-25'),
    details: 'TB-45 × 2, JSE-55 × 1', quantity: 3, total: 5500000, paymentPercent: 100, status: 'DONE', orderType: 'RETAIL',
  },
  // Wholesale orders
  {
    id: 'WS-001', customerName: 'Minh Anh Trading Co.', phone: '0913333333', date: ISO('2026-05-25'),
    details: 'JSE-55 × 50, TB-45 × 20', quantity: 70, total: 84600000, paymentPercent: 30, status: 'PROCESSING', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-002', customerName: 'Minh Anh Trading Co.', phone: '0913333333', date: ISO('2026-04-10'),
    details: 'JSE-60 × 20, TB-50 × 10', quantity: 30, total: 66000000, paymentPercent: 100, status: 'DONE', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-003', customerName: 'Green Garden JSC', phone: '0914444555', date: ISO('2026-03-15'),
    details: 'SF-15 × 8', quantity: 8, total: 44000000, paymentPercent: 100, status: 'DONE', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-004', customerName: 'Phú Hồng Furniture', phone: '0915555666', date: ISO('2026-06-01'),
    details: 'IEA-3 × 30, OUT-30 × 5', quantity: 35, total: 69825000, paymentPercent: 40, status: 'PROCESSING', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-005', customerName: 'Phú Hồng Furniture', phone: '0915555666', date: ISO('2026-04-25'),
    details: 'JSE-55 × 15', quantity: 15, total: 18000000, paymentPercent: 100, status: 'DONE', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-006', customerName: 'Thiên Ân Construction', phone: '0916666777', date: ISO('2026-05-10'),
    details: 'OUT-25 × 10', quantity: 10, total: 22000000, paymentPercent: 50, status: 'PROCESSING', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-007', customerName: 'Thiên Ân Construction', phone: '0916666777', date: ISO('2026-02-20'),
    details: 'TB-50 × 5', quantity: 5, total: 15000000, paymentPercent: 100, status: 'DONE', orderType: 'WHOLESALE',
  },
  {
    id: 'WS-008', customerName: 'Minh Anh Trading Co.', phone: '0913333333', date: ISO('2026-02-05'),
    details: 'SF-10 × 12', quantity: 12, total: 54000000, paymentPercent: 100, status: 'DONE', orderType: 'WHOLESALE',
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// MANUFACTURING DATA: PRODUCTION, MATERIALS, SUPPLIERS
// ══════════════════════════════════════════════════════════════════════════════

export const seedMfgExportCustomers = [
  { id: 1, name: 'MEYING USA', country: 'US', market: 'Amazon.com', contactName: 'David Chen' },
  { id: 2, name: 'GOPLUS USA', country: 'US', market: 'Amazon / Walmart', contactName: 'Mike Johnson' },
  { id: 3, name: 'IKEA Supplier', country: 'Sweden', market: 'IKEA International', contactName: 'Anna Bergström' },
];

export const seedMfgProducts = [
  { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55', description: 'Ghế khung sắt J55 xuất khẩu' },
  { id: 2, factoryCode: 'IEA-3', name: 'Ghế đan IEA-3', description: 'Ghế dây đan hoàn toàn' },
  { id: 3, factoryCode: 'JSE-60', name: 'Ghế J60', description: 'Ghế khung sắt J60 kích cỡ lớn' },
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
  // 3 SKU — mỗi SKU có timeline riêng, deadline PI là hạn giao chung
  {
    id: 5, code: 'PI-2026-005', deadline: ISO('2026-09-30'),
    status: 'PLANNING', exportOrderId: 4,
    exportOrder: { poNumber: 'PO-EU-005', contractFileUrl: null },
    items: [
      {
        quantity: 400, materialDeadline: ISO('2026-07-10'),
        stages: [
          { stageType: 'HAN',     deadline: ISO('2026-07-28') },
          { stageType: 'WEAVING', deadline: ISO('2026-08-20') },
          { stageType: 'SON',     deadline: ISO('2026-09-10') },
        ],
        productVariant: { colorCode: 'BEIGE', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
      },
      {
        quantity: 250, materialDeadline: ISO('2026-07-20'),
        stages: [
          { stageType: 'HAN',     deadline: ISO('2026-08-10') },
          { stageType: 'WEAVING', deadline: ISO('2026-09-01') },
          { stageType: 'SON',     deadline: ISO('2026-09-22') },
        ],
        productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế đan IEA-3', factoryCode: 'IEA-3' } },
      },
      {
        quantity: 150, materialDeadline: ISO('2026-06-30'),
        stages: [
          { stageType: 'HAN', deadline: ISO('2026-07-20') },
          { stageType: 'SON', deadline: ISO('2026-08-25') },
        ],
        productVariant: { colorCode: 'WHITE', mfgProduct: { name: 'Bàn đan T-08', factoryCode: 'TBL-08' } },
      },
    ],
    createdBy: { name: 'Quản lý SX Hùng' },
  },
  //
  {
    id: 6, code: 'PI-2026-006', deadline: ISO('2026-09-30'),
    status: 'PLANNING', exportOrderId: 4,
    exportOrder: { poNumber: 'PO-EU-005', contractFileUrl: null },
    items: [
      {
        quantity: 400,
        stages: [
          { stageType: 'HAN',     deadline: ISO('2026-07-28') },
          { stageType: 'WEAVING', deadline: ISO('2026-08-20') },
          { stageType: 'SON',     deadline: ISO('2026-09-10') },
        ],
        productVariant: { colorCode: 'BEIGE', mfgProduct: { name: 'Ghế J55', factoryCode: 'JSE-55' } },
      },
      {
        quantity: 250, materialDeadline: ISO('2026-07-20'),
        stages: [
          { stageType: 'HAN',     deadline: ISO('2026-08-10') },
          { stageType: 'WEAVING', deadline: ISO('2026-09-01') },
          { stageType: 'SON',     deadline: ISO('2026-09-22') },
        ],
        productVariant: { colorCode: 'BLACK', mfgProduct: { name: 'Ghế đan IEA-3', factoryCode: 'IEA-3' } },
      },
      {
        quantity: 150, materialDeadline: ISO('2026-06-30'),
        stages: [
          { stageType: 'HAN', deadline: ISO('2026-07-20') },
          { stageType: 'SON', deadline: ISO('2026-08-25') },
        ],
        productVariant: { colorCode: 'WHITE', mfgProduct: { name: 'Bàn đan T-08', factoryCode: 'TBL-08' } },
      },
            {
        quantity: 600,
        productVariant: { colorCode: 'WHITE', mfgProduct: { name: 'Bàn đan T-08', factoryCode: 'TBL-08' } },
      },
    ],
    createdBy: { name: 'Quản lý SX Hùng' },
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
    createdAt: ISO('2026-05-20'), proposedAt: ISO('2026-05-20'),
    exportOrder: { id: 1, poNumber: 'PO-MY-001', deliveryDate: ISO('2026-10-15') },
    mfgProduct: { id: 1, factoryCode: 'JSE-55', name: 'Ghế J55' },
    createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
    quotaManagement: {
      id: 1,
      materialType: {
        sat: [
          { id: 1, name: 'Sắt hộp 25×25', specifications: '25×25×1.2mm', thickness: 1.2, unit: 'cây', quantity: 20, createdAt: '2026-05-20T01:00:00.000Z' },
          { id: 2, name: 'Sắt vuông 20×20', specifications: '20×20×1.0mm', thickness: 1.0, unit: 'cây', quantity: 8,  createdAt: '2026-05-20T01:18:00.000Z' },
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
];

export const seedMfgWarehouses = [
  { id: 1, name: 'Kho phụ kiện',          code: 'phu-kien',   note: 'Phụ kiện sản xuất', isActive: true },
  { id: 2, name: 'Kho Sắt',               code: 'sat',         note: 'Sắt ống, sắt tấm, sắt hộp', isActive: true },
  { id: 3, name: 'Kho Khung/Dây',         code: 'day',         note: 'Dây đan, khung bán thành phẩm', isActive: true },
  { id: 5, name: 'Kho Bao bì/Thành phẩm', code: 'thanh-pham',  note: 'Bao bì đóng gói & thành phẩm hoàn chỉnh', isActive: true },
  { id: 6, name: 'Kho Vật tư SX',         code: 'vat-tu-sx',  note: 'Sơn, dây, vật tư tiêu hao sản xuất', isActive: true },
];

export const seedMfgWarehouseItems = [
  { id: 1, warehouseId: 2, materialId: 1, name: 'Ống sắt 25×25', unit: 'cây', quantity: 500, material: { id: 1, code: 'SAT-25', name: 'Ống sắt 25×25', unit: 'cm' } },
  { id: 2, warehouseId: 1, materialId: null, name: 'Tán M6×12', unit: 'cái', quantity: 5000, material: null },
  { id: 3, warehouseId: 3, materialId: 2, name: 'Dây PE Ø3mm', unit: 'kg', quantity: 250, material: { id: 2, code: 'DAY-PE3', name: 'Dây PE Ø3mm', unit: 'kg' } },
  { id: 4, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Thùng carton JSE-55', unit: 'cái', quantity: 600, material: null },
  { id: 5, warehouseId: 5, materialId: null, classification: 'Bao bì', name: 'Bao nylon 68×105', unit: 'cái', quantity: 1200, material: null },
  { id: 6, warehouseId: 5, materialId: null, classification: 'Thành phẩm', name: 'Mặt ghế J55 (đan xong)', unit: 'cái', quantity: 200, material: null },
  { id: 7, warehouseId: 2, materialId: 3, name: 'Ống sắt 20×40', unit: 'cây', quantity: 300, material: { id: 3, code: 'SAT-20', name: 'Ống sắt 20×40', unit: 'cm' } },
  { id: 8, warehouseId: 3, materialId: 4, name: 'Dây PE Ø4mm', unit: 'kg', quantity: 180, material: { id: 4, code: 'DAY-PE4', name: 'Dây PE Ø4mm', unit: 'kg' } },
  { id: 9, warehouseId: 2, materialId: 8, name: 'Ống sắt 25×50', unit: 'cây', quantity: 240, material: { id: 8, code: 'SAT-50X25', name: 'Ống sắt 25×50', unit: 'cm' } },
  { id: 10, warehouseId: 2, materialId: 12, name: 'Ống sắt 30×30', unit: 'cây', quantity: 200, material: { id: 12, code: 'SAT-30X30', name: 'Ống sắt 30×30', unit: 'cm' } },
  { id: 11, warehouseId: 2, materialId: 13, name: 'Ống sắt Ø16', unit: 'cây', quantity: 180, material: { id: 13, code: 'SAT-16', name: 'Ống sắt Ø16', unit: 'cm' } },
  { id: 12, warehouseId: 3, materialId: 14, name: 'Dây nhựa đan', unit: 'kg', quantity: 320, material: { id: 14, code: 'DAY-NHUA-DAN', name: 'Dây nhựa đan', unit: 'kg' } },
  { id: 13, warehouseId: 3, materialId: 15, name: 'Dây PE xám', unit: 'kg', quantity: 210, material: { id: 15, code: 'DAY-PE-XAM', name: 'Dây PE xám', unit: 'kg' } },
  { id: 14, warehouseId: 1, materialId: 9, name: 'Chốt 10mm', unit: 'cái', quantity: 3000, material: { id: 9, code: 'CHOT-10', name: 'Chốt 10mm', unit: 'cái' } },
  { id: 15, warehouseId: 1, materialId: 10, name: 'Pát V 100', unit: 'cái', quantity: 1200, material: { id: 10, code: 'PAT-V100', name: 'Pát V 100', unit: 'cái' } },
  { id: 16, warehouseId: 1, materialId: 11, name: 'Ô tròn lỗ dù', unit: 'cái', quantity: 1500, material: { id: 11, code: 'O-TRON-LO-DU', name: 'Ô tròn lỗ dù', unit: 'cái' } },
  { id: 17, warehouseId: 1, materialId: 16, name: 'Pát kính', unit: 'cái', quantity: 900, material: { id: 16, code: 'PAT-KINH', name: 'Pát kính', unit: 'cái' } },
  { id: 18, warehouseId: 1, materialId: 17, name: 'Pát 1-4', unit: 'cái', quantity: 900, material: { id: 17, code: 'PAT-1-4', name: 'Pát 1-4', unit: 'cái' } },
  // Kho Vật tư SX (id:6) — sơn + dây tiêu hao
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
  // ── Kho Vật tư SX (id:6) — dây/sơn khớp định mức ───────────────────
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
];

export const seedSuppliers = [
  { id: 1, name: 'Cty Thép Miền Nam', phone: '0281234567', isActive: true },
  { id: 2, name: 'Công ty Dây nhựa TM', phone: '0282345678', isActive: true },
  { id: 3, name: 'Sơn Thắng Phát', phone: '0283456789', isActive: true },
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
  { id: 14, materialId: 17, supplierId: 1, price: 9100, material: { id: 17, code: 'PAT-1-4', name: 'Pát 1-4' }, supplier: { id: 1, name: 'Cty Thép Miền Nam' } },
];

export const seedPurchaseCommands = [
  {
    id: 1, code: 'LMH-2026-001', source: 'PI', status: 'QUOTING', piId: 2,
    createdAt: ISO('2026-06-01'), piCode: 'PI-2026-002', poNumber: 'PO-GP-002', productLabel: 'Ghế IEA-3 × 300 bộ', itemCount: 3,
    items: [
      { id: 1, materialId: 1, requiredQty: 5000, stockQty: 500, buyQty: 4500, unit: 'cm', material: { name: 'Ống sắt 25×25' } },
      { id: 2, materialId: 2, requiredQty: 300, stockQty: 250, buyQty: 50, unit: 'kg', material: { name: 'Dây PE Ø3mm' } },
      { id: 3, materialId: null, requiredQty: 6000, stockQty: 5000, buyQty: 1000, unit: 'cái', material: { name: 'Tán M6×12' } },
    ],
  },
  {
    id: 2, code: 'LMH-2026-002', source: 'PI', status: 'ORDERED', piId: 3,
    createdAt: ISO('2026-06-05'), piCode: 'PI-2026-003', poNumber: 'PO-GP-002', productLabel: 'Ghế J55 × 200 bộ', itemCount: 2,
    items: [
      { id: 4, materialId: 1, requiredQty: 3000, stockQty: 500, buyQty: 2500, unit: 'cm', material: { name: 'Ống sắt 25×25' } },
      { id: 5, materialId: 5, requiredQty: 560, stockQty: 0, buyQty: 560, unit: 'kg', material: { name: 'Sơn trắng tĩnh điện' } },
    ],
  },
  {
    id: 3, code: 'LMH-2026-003', source: 'PI', status: 'DONE', piId: 1,
    createdAt: ISO('2026-05-01'), piCode: 'PI-2026-001', poNumber: 'PO-MY-001', productLabel: 'Ghế J55 × 500 bộ', itemCount: 1,
    items: [
      { id: 6, materialId: 1, requiredQty: 6000, stockQty: 500, buyQty: 5500, unit: 'cm', material: { name: 'Ống sắt 25×25' } },
    ],
  },
  {
    id: 4, code: 'LMH-2026-004', source: 'PROPOSAL', status: 'DRAFT', piId: null,
    createdAt: ISO('2026-06-10'), piCode: null, poNumber: null, productLabel: 'Vật tư phụ kiện chung', itemCount: 3,
    items: [
      { id: 7, materialId: 5, requiredQty: 800, stockQty: 0, buyQty: 800, unit: 'kg', material: { name: 'Sơn trắng tĩnh điện' } },
      { id: 8, materialId: 6, requiredQty: 600, stockQty: 0, buyQty: 600, unit: 'kg', material: { name: 'Sơn đen tĩnh điện' } },
      { id: 9, materialId: 7, requiredQty: 2000, stockQty: 0, buyQty: 2000, unit: 'cái', material: { name: 'Tán M6×12' } },
    ],
  },
];

export const seedPurchaseProposals = [
  { id: 1, code: 'DX-2026-001', status: 'PENDING', proposedBy: { id: 5, name: 'Kho Minh' }, items: [{ id: 1, materialId: 1, quantity: 500, unit: 'cây' }] },
  { id: 2, code: 'DX-2026-002', status: 'APPROVED', proposedBy: { id: 5, name: 'Kho Minh' }, items: [{ id: 2, materialId: 5, quantity: 200, unit: 'kg' }] },
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
];

export const seedFramePieces = [
  { id: 1, productId: 1, code: 'GHE-J55-1', name: 'Ghế J55 - Đế', groupNumber: 1, materials: [] },
  { id: 2, productId: 1, code: 'GHE-J55-2', name: 'Ghế J55 - Lưng', groupNumber: 1, materials: [] },
  { id: 3, productId: 2, code: 'IEA-3-1', name: 'Ghế IEA-3 - Khung', groupNumber: 1, materials: [] },
];

export function createInitialMockState() {
  return {
    products: structuredClone(seedProducts),
    agencyWarehouses: structuredClone(seedAgencyWarehouses),
    retailCustomers: structuredClone(seedRetailCustomers),
    wholesaleCustomers: structuredClone(seedWholesaleCustomers),
    promotions: structuredClone(seedPromotions),
    careReminders: structuredClone(seedCareReminders),
    wholesaleCareReminders: structuredClone(seedWholesaleCareReminders),
    quotations: structuredClone(seedQuotations),
    orders: structuredClone(seedOrders),
    salesUsers: structuredClone(seedSalesUsers),
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
    weavingReceiptHistory: structuredClone(seedWeavingReceiptHistory),
    weavingAllocation: structuredClone(seedWeavingAllocation),
    weavingReceivePending: structuredClone(seedWeavingReceivePending),
    weavingByWarehouse: structuredClone(seedWeavingByWarehouse),
    chuyenKiem: structuredClone(seedChuyenKiem),
    packing: structuredClone(seedPacking),
    piMaterialChecks: structuredClone(seedPiMaterialChecks),
    laborCost: structuredClone(seedLaborCost),
    suppliers: structuredClone(seedSuppliers),
    materialSuppliers: structuredClone(seedMaterialSuppliers),
    purchaseCommands: structuredClone(seedPurchaseCommands),
    purchaseProposals: structuredClone(seedPurchaseProposals),
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
    purchaseOrders: [] as unknown[],
    warehouseReceipts: [] as unknown[],
    mfgWarehouseReservations: [] as unknown[],
  };
}

export type MockState = ReturnType<typeof createInitialMockState>;

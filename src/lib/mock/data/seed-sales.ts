import type { SalesCustomer, SalesPO } from '../../../types/sales';

const ISO = (d: string) => new Date(d).toISOString();

export const seedSalesCustomers: SalesCustomer[] = [
  { id: 1, name: 'Nguyễn Văn Dũng', phone: '0901111111', email: 'dung@mail.com', address: 'Q7, TP.HCM', createdAt: ISO('2026-01-10') },
  { id: 2, name: 'Trần Thị Thủy', phone: '0902222222', address: 'Q7, TP.HCM', createdAt: ISO('2026-02-01') },
  { id: 3, name: 'Phạm Hoàng Nam', phone: '0903333444', email: 'nam@mail.com', address: 'Q1, TP.HCM', createdAt: ISO('2026-03-15') },
  { id: 4, name: 'Minh Anh Trading Co.', phone: '0913333333', address: 'Hà Nội', note: 'Khách sỉ', createdAt: ISO('2026-01-05') },
];

export const seedSalesPOs: SalesPO[] = [
  {
    id: 1, code: 'PO-001', customerId: 1, customerName: 'Nguyễn Văn Dũng', orderDate: ISO('2026-05-05'), deliveryDate: ISO('2026-05-20'), createdAt: ISO('2026-05-05'),
    totalValue: 17000000, depositAmount: 5000000, depositConfirmed: true, paidAmount: 17000000,
    items: [
      { id: 1, skuCode: 'JSE-55', skuName: 'Ghế J55 (Khung sắt)', totalQty: 200, shippedQty: 200, status: 'HOAN_THANH' },
      { id: 2, skuCode: 'TB-45', skuName: 'Bàn TB-45 (Vuông)', totalQty: 50, shippedQty: 50, status: 'HOAN_THANH' },
    ],
  },
  {
    id: 2, code: 'PO-002', customerId: 2, customerName: 'Trần Thị Thủy', orderDate: ISO('2026-06-10'), deliveryDate: ISO('2026-07-15'), createdAt: ISO('2026-06-10'),
    totalValue: 4500000, depositAmount: 1500000, depositConfirmed: true, paidAmount: 1500000,
    items: [
      { id: 3, skuCode: 'SF-10', skuName: 'Ghế sofa SF-10', totalQty: 80, shippedQty: 20, status: 'DAN' },
    ],
  },
  {
    id: 3, code: 'PO-003', customerId: 3, customerName: 'Phạm Hoàng Nam', orderDate: ISO('2026-04-20'), deliveryDate: ISO('2026-06-01'), createdAt: ISO('2026-04-20'),
    totalValue: 18000000, depositAmount: 5000000, depositConfirmed: true, paidAmount: 12000000,
    items: [
      { id: 4, skuCode: 'JSE-60', skuName: 'Ghế J60 (Khung sắt lớn)', totalQty: 300, shippedQty: 300, status: 'HOAN_THANH' },
      { id: 5, skuCode: 'TB-50', skuName: 'Bàn TB-50 (Chữ nhật)', totalQty: 100, shippedQty: 60, status: 'DONG_GOI' },
    ],
  },
  {
    id: 4, code: 'PO-004', customerId: 4, customerName: 'Minh Anh Trading Co.', orderDate: ISO('2026-05-25'), deliveryDate: ISO('2026-08-30'), createdAt: ISO('2026-05-25'),
    totalValue: 84600000, depositAmount: 20000000, depositConfirmed: false, paidAmount: 0,
    items: [
      { id: 6, skuCode: 'JSE-55', skuName: 'Ghế J55 (Khung sắt)', totalQty: 500, shippedQty: 0, status: 'MUA_HANG' },
      { id: 7, skuCode: 'TB-45', skuName: 'Bàn TB-45 (Vuông)', totalQty: 200, shippedQty: 0, status: 'KHUNG_CO_KHI' },
      { id: 8, skuCode: 'OUT-30', skuName: 'Bộ bàn ghế ngoài trời OUT-30', totalQty: 50, shippedQty: 10, status: 'CHUYEN_KIEM' },
    ],
  },
  {
    id: 5, code: 'PO-005', customerId: 4, customerName: 'Minh Anh Trading Co.', orderDate: ISO('2026-03-01'), deliveryDate: ISO('2026-04-15'), createdAt: ISO('2026-03-01'),
    totalValue: 45000000, depositAmount: 10000000, depositConfirmed: true, paidAmount: 45000000,
    items: [
      { id: 9, skuCode: 'IEA-3', skuName: 'Ghế đan IEA-3 (Dây đan)', totalQty: 300, shippedQty: 300, status: 'HOAN_THANH' },
    ],
  },
];

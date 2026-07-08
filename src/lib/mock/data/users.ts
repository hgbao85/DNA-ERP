import type { User } from '../../../context/AuthContext';

export interface MockAccount {
  email: string;
  password: string;
  user: User;
}

/** Tài khoản demo — mật khẩu chung demo1234 */
export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    email: 'boss@demo.com',
    password: 'demo1234',
    user: { id: 1, name: 'Boss Tuấn', email: 'boss@demo.com', role: 'BOSS' },
  },
  {
    email: 'sales@demo.com',
    password: 'demo1234',
    user: { id: 70, name: 'NV Sales Minh', email: 'sales@demo.com', role: 'WAREHOUSE_STAFF', isSale: true },
  },
  {
    email: 'khovattutp@demo.com',
    password: 'demo1234',
    user: { id: 6, name: 'Thủ kho Vật tư thành phẩm', email: 'khovattutp@demo.com', role: 'WAREHOUSE_STAFF', warehouseScope: 'vat-tu-tp' },
  },
  {
    email: 'khophoisonhan@demo.com',
    password: 'demo1234',
    user: { id: 61, name: 'Thủ kho Phôi Sơn Hàn', email: 'khophoisonhan@demo.com', role: 'WAREHOUSE_STAFF', warehouseScope: 'phoi-son-han' },
  },
  {
    email: 'khothanhpham@demo.com',
    password: 'demo1234',
    user: { id: 62, name: 'Thủ kho Thành Phẩm', email: 'khothanhpham@demo.com', role: 'WAREHOUSE_STAFF', warehouseScope: 'thanh-pham' },
  },
  {
    email: 'prodmgr@demo.com',
    password: 'demo1234',
    user: {
      id: 10,
      name: 'Quản lý SX Hùng',
      email: 'prodmgr@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'PRODUCTION_MANAGER',
    },
  },
  {
    email: 'purchasing@demo.com',
    password: 'demo1234',
    user: {
      id: 20,
      name: 'NV Mua hàng Lan',
      email: 'purchasing@demo.com',
      role: 'WAREHOUSE_STAFF',
      isPurchaser: true,
    },
  },
  {
    email: 'productplan@demo.com',
    password: 'demo1234',
    user: {
      id: 39,
      name: 'NV Kế hoạch SX Linh',
      email: 'productplan@demo.com',
      role: 'WAREHOUSE_STAFF',
      isProductPlanner: true,
    },
  },
  {
    email: 'phoi@demo.com',
    password: 'demo1234',
    user: {
      id: 12,
      name: 'Thống kê Cơ khí',
      email: 'phoi@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'PHOI',
    },
  },
  {
    email: 'han@demo.com',
    password: 'demo1234',
    user: {
      id: 13,
      name: 'Tổ Hàn',
      email: 'han@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'HAN',
    },
  },
  {
    email: 'son@demo.com',
    password: 'demo1234',
    user: {
      id: 14,
      name: 'Tổ Sơn',
      email: 'son@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'SON',
    },
  },
  {
    email: 'qc@demo.com',
    password: 'demo1234',
    user: {
      id: 15,
      name: 'QC Kiều',
      email: 'qc@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'QC',
    },
  },
  {
    email: 'weaving@demo.com',
    password: 'demo1234',
    user: {
      id: 16,
      name: 'Nhập đan - Hà',
      email: 'weaving@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'WEAVING_MANAGER',
    },
  },
  {
    email: 'xuatdan@demo.com',
    password: 'demo1234',
    user: {
      id: 17,
      name: 'Xuất đan - Nam',
      email: 'xuatdan@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'WEAVING_EXPORT',
    },
  },
  {
    email: 'dinhmuc@demo.com',
    password: 'demo1234',
    user: {
      id: 14,
      name: 'NV Định mức',
      email: 'dinhmuc@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'BOM_MANAGER',
    },
  },
  {
    email: 'dinhmucsat@demo.com',
    password: 'demo1234',
    user: {
      id: 50,
      name: 'NV Định mức - Sắt',
      email: 'dinhmucsat@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'SPEC_STEEL',
    },
  },
  {
    email: 'dinhmucdayson@demo.com',
    password: 'demo1234',
    user: {
      id: 51,
      name: 'NV Định mức - Dây/Sơn',
      email: 'dinhmucdayson@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'SPEC_WIRE_PAINT',
    },
  },
  {
    email: 'dinhmucphukien@demo.com',
    password: 'demo1234',
    user: {
      id: 52,
      name: 'NV Định mức - Vật tư/Phụ kiện',
      email: 'dinhmucphukien@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'SPEC_ACCESSORY',
    },
  },
  {
    email: 'dinhmucbaobi@demo.com',
    password: 'demo1234',
    user: {
      id: 53,
      name: 'NV Định mức - Bao bì/Đóng gói',
      email: 'dinhmucbaobi@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'SPEC_PACKAGING',
    },
  },
];

import type { User } from '../../../context/AuthContext';

export interface MockAccount {
  email: string;
  password: string;
  user: User;
}

/** Tài khoản demo — mật khẩu chung demo1234 */
export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    email: 'admin@demo.com',
    password: 'demo1234',
    user: { id: 2, name: 'Quản trị viên hệ thống', email: 'admin@demo.com', role: 'ADMIN' },
  },
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
    email: 'khovttp@demo.com',
    password: 'demo1234',
    user: { id: 6, name: 'Thủ kho Vật tư thành phẩm', email: 'khovttp@demo.com', role: 'WAREHOUSE_STAFF', warehouseScope: 'vat-tu-tp' },
  },
  {
    email: 'khopsh@demo.com',
    password: 'demo1234',
    user: { id: 61, name: 'Thủ kho Phôi Sơn Hàn', email: 'khopsh@demo.com', role: 'WAREHOUSE_STAFF', warehouseScope: 'phoi-son-han' },
  },
  {
    email: 'khotp@demo.com',
    password: 'demo1234',
    user: { id: 62, name: 'Thủ kho Thành Phẩm', email: 'khotp@demo.com', role: 'WAREHOUSE_STAFF', warehouseScope: 'thanh-pham' },
  },
  {
    email: 'qlsx@demo.com',
    password: 'demo1234',
    user: {
      id: 10,
      name: 'Quản lý SX Hùng',
      email: 'qlsx@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'PRODUCTION_MANAGER',
    },
  },
  {
    email: 'muapsh@demo.com',
    password: 'demo1234',
    user: {
      id: 21,
      name: 'NV Mua hàng - Phôi Sơn Hàn',
      email: 'muapsh@demo.com',
      role: 'WAREHOUSE_STAFF',
      isPurchaser: true,
      warehouseScope: 'phoi-son-han',
    },
  },
  {
    email: 'muavttp@demo.com',
    password: 'demo1234',
    user: {
      id: 22,
      name: 'NV Mua hàng - Vật tư thành phẩm',
      email: 'muavttp@demo.com',
      role: 'WAREHOUSE_STAFF',
      isPurchaser: true,
      warehouseScope: 'vat-tu-tp',
    },
  },
  {
    email: 'muatp@demo.com',
    password: 'demo1234',
    user: {
      id: 23,
      name: 'NV Mua hàng - Thành phẩm',
      email: 'muatp@demo.com',
      role: 'WAREHOUSE_STAFF',
      isPurchaser: true,
      warehouseScope: 'thanh-pham',
    },
  },
  {
    email: 'khsx@demo.com',
    password: 'demo1234',
    user: {
      id: 39,
      name: 'NV Kế hoạch SX Linh',
      email: 'khsx@demo.com',
      role: 'WAREHOUSE_STAFF',
      isProductPlanner: true,
    },
  },
  {
    email: 'phoi@demo.com',
    password: 'demo1234',
    user: {
      id: 12,
      name: 'Thống kê Phôi',
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
    email: 'kcs@demo.com',
    password: 'demo1234',
    user: {
      id: 71,
      name: 'KCS Kiều',
      email: 'kcs@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'KCS',
    },
  },
  {
    email: 'dinhmuc@demo.com',
    password: 'demo1234',
    user: {
      id: 15,
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
    email: 'dinhmucpkbb@demo.com',
    password: 'demo1234',
    user: {
      id: 52,
      name: 'NV Định mức - Phụ kiện/Bao bì',
      email: 'dinhmucpkbb@demo.com',
      role: 'WAREHOUSE_STAFF',
      mfgRole: 'SPEC_ACCESSORY',
    },
  },
];

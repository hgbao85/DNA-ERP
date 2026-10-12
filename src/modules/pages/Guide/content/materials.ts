import type { GuideGroup } from '../types';
import { materialsCatalogArticle, materialsRoleArticle } from './materialsShared';

// Hướng dẫn RIÊNG của vai trò "Quản lý vật tư" (2026-10-12, theo yêu cầu) - KHÔNG nằm ở /guide công
// khai mà hiện ở tab "Hướng dẫn" ngay trong phân hệ Quản lý vật tư (MaterialsManagerApp.tsx, qua
// Guide/EmbeddedGuide.tsx). 2 bài dùng chung nội dung với Admin (cùng 1 màn danh mục Vật tư) - xem
// materialsShared.ts. KHÔNG import admin.ts ở đây: tài khoản này không phải Admin.
//
// Ảnh minh hoạ ghi đè riêng: ảnh gốc của 2 bài chụp trong phân hệ Admin (có sidebar quản trị), còn
// người đọc ở đây thấy màn của chính họ (thanh tiêu đề 2 tab, không có sidebar).
export const materialsGroup: GuideGroup = {
  id: 'materials',
  title: 'Quản lý vật tư',
  icon: 'Package',
  color: 'var(--fg-6d28d9)',
  bg: 'var(--bg-ede9fe)',
  roles: ['materials'],
  description: 'Khai báo và duy trì danh mục vật tư: mã, đơn vị, nhóm, kho, người mua phụ trách, % dự trù hao hụt khi mua.',
  articles: [
    { ...materialsRoleArticle, screenshot: '/guide-screens/materials-tong-quan.png' },
    { ...materialsCatalogArticle, screenshot: '/guide-screens/materials-vat-tu.png' },
  ],
};

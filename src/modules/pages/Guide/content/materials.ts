import type { GuideArticle, GuideGroup } from '../types';
import { materialsCatalogArticles, materialsRoleArticle } from './materialsShared';

// Hướng dẫn RIÊNG của vai trò "Quản lý vật tư" (2026-10-12, theo yêu cầu) - KHÔNG nằm ở /guide công
// khai mà hiện ở tab "Hướng dẫn" ngay trong phân hệ Quản lý vật tư (MaterialsManagerApp.tsx, qua
// Guide/EmbeddedGuide.tsx). Nội dung dùng chung với Admin (cùng 1 màn danh mục Vật tư) - xem
// materialsShared.ts. KHÔNG import admin.ts ở đây: tài khoản này không phải Admin.
//
// Ảnh minh hoạ gắn RIÊNG ở đây: người đọc thấy màn của chính họ (thanh tiêu đề 2 tab, không có
// sidebar quản trị). Bài nào không có ảnh thì ArticleView tự hiện sơ đồ `mock`.
const SCREENSHOTS: Record<string, string> = {
  'admin-quan-ly-vat-tu-role': '/guide-screens/materials-tong-quan.png',
  'vt-bang-vat-tu': '/guide-screens/materials-tong-quan.png',
  'vt-them-vat-tu': '/guide-screens/materials-vat-tu.png',
  'vt-nhom-phan-loai': '/guide-screens/materials-nhom-con-sat.png',
  'vt-hao-hut-hang-loat': '/guide-screens/materials-hao-hut-hang-loat.png',
  'vt-sua-xoa': '/guide-screens/materials-sua.png',
};
const withShot = (a: GuideArticle): GuideArticle => (SCREENSHOTS[a.id] ? { ...a, screenshot: SCREENSHOTS[a.id] } : a);

export const materialsGroup: GuideGroup = {
  id: 'materials',
  title: 'Quản lý vật tư',
  icon: 'Package',
  color: 'var(--fg-6d28d9)',
  bg: 'var(--bg-ede9fe)',
  roles: ['materials'],
  description: 'Khai báo và duy trì danh mục vật tư: mã, đơn vị, nhóm, kho, người mua phụ trách, % dự trù hao hụt khi mua.',
  articles: [materialsRoleArticle, ...materialsCatalogArticles].map(withShot),
};

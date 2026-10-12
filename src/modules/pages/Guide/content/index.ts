import type { GuideGroup } from '../types';
import { journeyGroup } from './journey';
import { salesGroup } from './sales';
import { productionPlanGroup } from './productionPlan';
import { purchasingGroup } from './purchasing';
import { warehouseGroup } from './warehouse';
import { manufacturingGroup } from './manufacturing';
import { bossGroup } from './boss';


/** Nội dung trang /guide CÔNG KHAI, theo đúng thứ tự hiển thị trong sidebar.
 *
 * KHÔNG gồm hướng dẫn của Admin và của Quản lý vật tư (2026-10-12, theo yêu cầu): /guide mở được
 * cho mọi vai trò và cả người chưa đăng nhập, còn 2 vai trò này có hướng dẫn RIÊNG nhúng ngay trong
 * phân hệ của họ (Guide/EmbeddedGuide.tsx): tab "Hướng dẫn quản trị" của Admin (AdminGuidePage.tsx,
 * import thẳng ./admin) và tab "Hướng dẫn" của Quản lý vật tư (MaterialsManagerApp.tsx, import thẳng
 * ./materials). File này CỐ Ý không import ./admin, ./materials hay ./materialsShared: import là
 * nội dung đó sẽ nằm trong gói JS của trang /guide công khai. Đừng thêm 2 nhóm đó trở lại. */
export const GUIDE_GROUPS: GuideGroup[] = [
  journeyGroup,
  salesGroup,
  productionPlanGroup,
  purchasingGroup,
  warehouseGroup,
  manufacturingGroup,
  bossGroup,
];

export function allArticles() {
  return GUIDE_GROUPS.flatMap(g => g.articles.map(a => ({ group: g, article: a })));
}

export function findArticle(id: string) {
  for (const g of GUIDE_GROUPS) {
    const a = g.articles.find(a => a.id === id);
    if (a) return { group: g, article: a };
  }
  return null;
}

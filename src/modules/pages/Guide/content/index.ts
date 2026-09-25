import type { GuideGroup } from '../types';
import { journeyGroup } from './journey';
import { salesGroup } from './sales';
import { productionPlanGroup } from './productionPlan';
import { purchasingGroup } from './purchasing';
import { warehouseGroup } from './warehouse';
import { manufacturingGroup } from './manufacturing';
import { bossGroup } from './boss';
import { adminGroup } from './admin';


/** Toàn bộ nội dung Hướng dẫn sử dụng, theo đúng thứ tự hiển thị trong sidebar. */
export const GUIDE_GROUPS: GuideGroup[] = [
  journeyGroup,
  salesGroup,
  productionPlanGroup,
  purchasingGroup,
  warehouseGroup,
  manufacturingGroup,
  bossGroup,
  adminGroup,
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

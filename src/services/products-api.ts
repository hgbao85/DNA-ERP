/**
 * Adapter PRODUCTS: FE ⇄ BE thật (module `products` — danh mục SKU/mfgProduct).
 * Trước đây không nối vì mọi nơi tạo mfgProduct đều nhét thẳng vào PlanForm — nay PlanForm
 * cũng đã là BE thật (xem plan-forms-api.ts) nên không còn rủi ro "2 nguồn sự thật" nữa.
 * Id bigint-as-string.
 */
import { http } from './core/http';

export interface BeMfgProduct {
  id: number;
  factoryCode: string;
  name: string;
  description: string | null;
}

export async function getMfgProducts(): Promise<BeMfgProduct[]> {
  const res = await http.get<BeMfgProduct[] | { data: BeMfgProduct[] }>('/products?limit=100');
  return Array.isArray(res) ? res : res.data;
}

export async function createMfgProduct(data: Record<string, unknown>): Promise<BeMfgProduct> {
  return http.post<BeMfgProduct>('/products', {
    factoryCode: data.factoryCode,
    name: data.name,
    description: data.description,
  });
}

/** Tìm theo factoryCode (không phân biệt hoa/thường), không có thì tạo mới — dùng chung cho
 *  mọi nơi cần "resolve-or-create" 1 SKU theo mã (OrderManagementPage, SKUReviewPage...). */
export async function resolveMfgProduct(factoryCode: string, name?: string): Promise<BeMfgProduct> {
  const products = await getMfgProducts();
  const existing = products.find((p) => p.factoryCode.toLowerCase() === factoryCode.toLowerCase());
  if (existing) return existing;
  return createMfgProduct({ factoryCode, name: name ?? factoryCode });
}

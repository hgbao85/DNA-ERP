/**
 * Adapter PRODUCTS: FE ⇄ BE thật (module `products` — danh mục SKU/mfgProduct).
 * Trước đây không nối vì mọi nơi tạo mfgProduct đều nhét thẳng vào Sku — nay Sku
 * cũng đã là BE thật (xem sku-api.ts) nên không còn rủi ro "2 nguồn sự thật" nữa.
 * Id bigint-as-string.
 */
import { http } from './core/http';

export interface BeMfgProduct {
  id: string;
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

/** Tra 1 sản phẩm theo đúng mã (không phân biệt hoa/thường) — hỏi thẳng BE bằng `search` tại
 *  thời điểm gọi, không dựa danh sách đã tải sẵn (có thể cũ, hoặc vượt limit=100) — danh sách cũ
 *  làm FE tưởng mã chưa có rồi POST /products tạo trùng → 409 Conflict. */
export async function findMfgProductByCode(factoryCode: string): Promise<BeMfgProduct | undefined> {
  const res = await http.get<BeMfgProduct[] | { data: BeMfgProduct[] }>('/products', {
    params: { search: factoryCode, limit: 100 },
  });
  const list = Array.isArray(res) ? res : res.data;
  return list.find((p) => p.factoryCode.toLowerCase() === factoryCode.toLowerCase());
}

/** Tìm theo factoryCode (không phân biệt hoa/thường), không có thì tạo mới — dùng chung cho
 *  mọi nơi cần "resolve-or-create" 1 SKU theo mã (OrderManagementPage, SKUReviewPage...). */
export async function resolveMfgProduct(factoryCode: string, name?: string): Promise<BeMfgProduct> {
  const existing = await findMfgProductByCode(factoryCode);
  if (existing) return existing;
  return createMfgProduct({ factoryCode, name: name ?? factoryCode });
}

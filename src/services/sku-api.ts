/**
 * Adapter SKU: FE ⇄ BE thật (module `skus`).
 * Map ngược đầy đủ về shape `Sku` (types/sku.ts) — quotaManagement.materialType/
 * manhData/manhReviewStatus/qlsxReviewStatus... — để SKUListPage/SKUDetail/SKUReviewPage
 * không phải sửa lại logic hiển thị + duyệt, chỉ đổi nguồn dữ liệu.
 *
 * Việc 2: BE không còn lưu JSON tự do — `manhData`/`detailQuota` được BE TÁI DỰNG từ dữ liệu
 * quan hệ thật (Piece/SegmentSpec/BomRevision...) mỗi lần đọc, theo shape "tự nhiên" của BE
 * (materialId/materialCode/materialName/cutLengthMm...), KHÔNG còn round-trip y hệt những gì
 * FE gửi lên. Adapter này chịu trách nhiệm map 2 chiều: khi GHI, gửi `materialId` (chọn từ
 * MaterialPicker, không còn gõ tên tự do); khi ĐỌC, dựng lại đúng shape cũ (ManhRow/
 * ManhChildRow/DaySonItem/VatTuPhuKienItem/BaoBiDongGoiItem, field `name` = tên Material) để
 * SKUDetail.tsx và các trang thống kê/kho/kiểm tra vật tư đọc `pf.manhData`/
 * `pf.quotaManagement.materialType` không phải sửa gì thêm.
 */
import { http } from './core/http';
import type {
  BaoBiDongGoiItem,
  CreateSkuPayload,
  DaySonItem,
  ManhChildRow,
  ManhGroup,
  ManhRow,
  MaterialType,
  Sku,
  QuotaReviewStatus,
  VatTuPhuKienItem,
} from '../types/sku';

type ReviewDecision = 'APPROVED' | 'REJECTED';

interface BeReview {
  group: string;
  status: ReviewDecision | null;
  reason: string | null;
  enteredBy: string | null;
  enteredAt: string | null;
  reviewedAt: string | null;
}

interface BeSteelSegment {
  id: number;
  segmentSpecId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  cutLengthMm: number;
  qtyPerPiece: number;
  needsHan: boolean;
  needsSon: boolean;
}
interface BeSteelPiece {
  id: number;
  pieceId: string;
  name: string;
  qtyPerUnit: number;
  segments: BeSteelSegment[];
}
interface BeMaterialLine {
  id: number;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialUnit: string;
  qtyPerUnit: number;
}

interface BeSku {
  id: number;
  salesOrderId: number | null;
  mfgProductId: number;
  factoryCode: string;
  productName: string;
  customerName: string | null;
  productionInvoiceId: number | null;
  piCode: string | null;
  status: Sku['status'];
  note: string | null;
  origin: string | null;
  manhData: { sat: BeSteelPiece[]; day: BeMaterialLine[]; dinh: BeMaterialLine[] } | null;
  detailQuota: {
    daySon: BeMaterialLine[];
    vatTuPhuKien: BeMaterialLine[];
    baoBiDongGoi: BeMaterialLine[];
  } | null;
  qlsxReviewedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  manhReviews: BeReview[];
  detailReviews: BeReview[];
}

const DETAIL_GROUP_TO_BE: Record<keyof MaterialType, string> = {
  sat: 'SAT', // dead/legacy — không có nhóm BE tương ứng, xem ghi chú dưới
  daySon: 'DAY_SON',
  vatTuPhuKien: 'VAT_TU_PHU_KIEN',
  baoBiDongGoi: 'BAO_BI_DONG_GOI',
};
const MANH_GROUP_TO_BE: Record<ManhGroup, string> = { sat: 'SAT', day: 'DAY', dinh: 'DINH' };

function toManhRow(p: BeSteelPiece): ManhRow {
  return {
    id: p.id,
    pieceId: p.pieceId,
    name: p.name,
    qtyPerSku: String(p.qtyPerUnit),
    children: p.segments.map(
      (s): ManhChildRow => ({
        id: s.id,
        segmentSpecId: s.segmentSpecId,
        materialId: s.materialId,
        name: s.materialName,
        length: String(s.cutLengthMm),
        qty: String(s.qtyPerPiece),
      }),
    ),
  };
}

function toDaySonItem(l: BeMaterialLine): DaySonItem {
  return { id: l.id, materialId: l.materialId, name: l.materialName, kg: l.qtyPerUnit, unit: l.materialUnit };
}

function toAccessoryLine(l: BeMaterialLine): VatTuPhuKienItem | BaoBiDongGoiItem {
  return { id: l.id, materialId: l.materialId, name: l.materialName, quantity: l.qtyPerUnit, unit: l.materialUnit };
}

function toReviewStatus<K extends string>(reviews: BeReview[], groupOf: Record<K, string>): Partial<Record<K, QuotaReviewStatus>> {
  const out: Partial<Record<K, QuotaReviewStatus>> = {};
  for (const key of Object.keys(groupOf) as K[]) {
    const beGroup = groupOf[key];
    const row = reviews.find((r) => r.group === beGroup);
    if (row && row.status) out[key] = { status: row.status, reason: row.reason ?? undefined, reviewedAt: row.reviewedAt ?? '' };
  }
  return out;
}

function toEntryMeta<K extends string>(reviews: BeReview[], groupOf: Record<K, string>): Partial<Record<K, { enteredBy: string; enteredAt: string }>> {
  const out: Partial<Record<K, { enteredBy: string; enteredAt: string }>> = {};
  for (const key of Object.keys(groupOf) as K[]) {
    const beGroup = groupOf[key];
    const row = reviews.find((r) => r.group === beGroup);
    if (row?.enteredBy) out[key] = { enteredBy: row.enteredBy, enteredAt: row.enteredAt ?? '' };
  }
  return out;
}

function toSku(pf: BeSku): Sku {
  return {
    id: pf.id,
    exportOrderId: pf.salesOrderId,
    mfgProductId: pf.mfgProductId,
    status: pf.status,
    note: pf.note,
    customerName: pf.customerName,
    piCode: pf.piCode ?? '',
    productionInvoiceId: pf.productionInvoiceId ?? undefined,
    origin: (pf.origin as 'PRODUCTION_CONFIRM' | undefined) ?? undefined,
    createdAt: pf.createdAt,
    exportOrder:
      pf.salesOrderId != null
        ? { id: pf.salesOrderId, poNumber: pf.piCode ?? '', deliveryDate: undefined }
        : undefined,
    mfgProduct: { id: pf.mfgProductId, factoryCode: pf.factoryCode, name: pf.productName },
    quotaManagement: {
      id: pf.id,
      materialType: {
        sat: [],
        daySon: (pf.detailQuota?.daySon ?? []).map(toDaySonItem),
        vatTuPhuKien: (pf.detailQuota?.vatTuPhuKien ?? []).map(toAccessoryLine) as MaterialType['vatTuPhuKien'],
        baoBiDongGoi: (pf.detailQuota?.baoBiDongGoi ?? []).map(toAccessoryLine) as MaterialType['baoBiDongGoi'],
      },
      entryMeta: toEntryMeta(pf.detailReviews, DETAIL_GROUP_TO_BE),
      reviewStatus: toReviewStatus(pf.detailReviews, DETAIL_GROUP_TO_BE),
    },
    manhData: {
      sat: (pf.manhData?.sat ?? []).map(toManhRow),
      day: (pf.manhData?.day ?? []).map(toDaySonItem),
      dinh: (pf.manhData?.dinh ?? []).map(toDaySonItem),
    },
    manhEntryMeta: toEntryMeta(pf.manhReviews, MANH_GROUP_TO_BE),
    manhReviewStatus: toReviewStatus(pf.manhReviews, MANH_GROUP_TO_BE),
    qlsxReviewStatus: pf.qlsxReviewedAt ? { status: 'APPROVED', reviewedAt: pf.qlsxReviewedAt } : undefined,
  };
}

export async function getSkus(): Promise<Sku[]> {
  const res = await http.get<BeSku[] | { data: BeSku[] }>('/skus?limit=100');
  const list = Array.isArray(res) ? res : res.data;
  return list.map(toSku);
}

export async function getSku(id: number | string): Promise<Sku> {
  return toSku(await http.get<BeSku>(`/skus/${id}`));
}

/** mfgProducts để chọn khi tạo SKU mới — SKU không còn bắt buộc gắn Sales Order (xem
 *  ghi chú CreateSkuPayload.exportOrderId), nên không cần lấy exportOrders nữa. */
export async function getSkuOptions(): Promise<{
  mfgProducts: { id: number; factoryCode: string; name: string }[];
}> {
  const products = await http.get<{ id: number; factoryCode: string; name: string }[] | { data: { id: number; factoryCode: string; name: string }[] }>('/products?limit=100');
  const productList = Array.isArray(products) ? products : products.data;
  return { mfgProducts: productList };
}

export async function createSku(payload: CreateSkuPayload): Promise<Sku> {
  const created = await http.post<BeSku>('/skus', {
    salesOrderId: payload.exportOrderId || undefined,
    mfgProductId: payload.mfgProductId,
    note: payload.note,
    customerName: payload.customerName,
  });
  return toSku(created);
}

export async function deleteSkus(ids: (number | string)[]): Promise<void> {
  await Promise.all(ids.map((id) => http.del(`/skus/${id}`)));
}

/**
 * group='sat': `items` là `ManhRow[]` (mảnh → đoạn sắt, mỗi đoạn phải có `materialId` — chọn
 * từ MaterialPicker lọc theo nhóm Sắt, không còn gõ tên tự do) — gửi dạng `{pieces}` có cấu trúc.
 * group='day'|'dinh': `items` là `DaySonItem[]`, mỗi dòng phải có `materialId` (chọn từ
 * MaterialPicker lọc theo nhóm Dây/Đinh) — gửi dạng `{items}` phẳng.
 */
export async function updateSkuManhQuota(
  id: number | string,
  group: ManhGroup,
  items: unknown,
  enteredBy: string,
): Promise<Sku> {
  const beGroup = MANH_GROUP_TO_BE[group];
  const body =
    group === 'sat'
      ? {
          pieces: (items as ManhRow[]).map((r) => ({
            name: r.name,
            qtyPerUnit: Number(r.qtyPerSku) || 1,
            segments: r.children.map((c) => ({
              materialId: String(c.materialId ?? ''),
              cutLengthMm: Number(c.length) || 0,
              qtyPerPiece: Number(c.qty) || 0,
            })),
          })),
          enteredBy,
        }
      : {
          items: (items as DaySonItem[]).map((it) => ({
            materialId: String(it.materialId ?? ''),
            qtyPerUnit: it.kg ?? 0,
          })),
          enteredBy,
        };
  const updated = await http.post<BeSku>(`/skus/${id}/manh-quota/${beGroup}`, body);
  return toSku(updated);
}

/** `items` phải có `materialId` trên mỗi dòng — chọn từ MaterialPicker (nhóm Sơn cho
 *  daySon, Phụ kiện cho vatTuPhuKien, Bao bì cho baoBiDongGoi). */
export async function updateSkuDetailQuota<K extends keyof MaterialType>(
  id: number | string,
  group: K,
  items: unknown,
  enteredBy: string,
): Promise<Sku> {
  const beGroup = DETAIL_GROUP_TO_BE[group];
  const arr = items as (DaySonItem | VatTuPhuKienItem | BaoBiDongGoiItem)[];
  const body = {
    items: arr.map((it) => ({
      materialId: String(it.materialId ?? ''),
      qtyPerUnit: ('kg' in it ? it.kg : 'quantity' in it ? it.quantity : 0) ?? 0,
    })),
    enteredBy,
  };
  const updated = await http.post<BeSku>(`/skus/${id}/detail-quota/${beGroup}`, body);
  return toSku(updated);
}

export async function reviewSkuManhQuota(
  id: number | string,
  group: ManhGroup,
  status: ReviewDecision,
  reason?: string,
): Promise<Sku> {
  const beGroup = MANH_GROUP_TO_BE[group];
  const updated = await http.post<BeSku>(`/skus/${id}/manh-quota/${beGroup}/review`, { status, reason });
  return toSku(updated);
}

export async function reviewSkuDetailQuota<K extends keyof MaterialType>(
  id: number | string,
  group: K,
  status: ReviewDecision,
  reason?: string,
): Promise<Sku> {
  const beGroup = DETAIL_GROUP_TO_BE[group];
  const updated = await http.post<BeSku>(`/skus/${id}/detail-quota/${beGroup}/review`, { status, reason });
  return toSku(updated);
}

export async function approvePartsSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/approve-parts`));
}

export async function approveDetailSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/approve-detail`));
}

export async function reviewQlsxSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/qlsx-review`));
}

export async function requestBossApprovalSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/request-boss-approval`));
}

export async function rejectSkuByQlsx(id: number | string, _reason?: string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/reject-qlsx`));
}

export async function rejectSkuByBoss(id: number | string, _reason?: string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/reject-boss`));
}

export async function approveFullSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/approve`));
}

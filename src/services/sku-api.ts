/**
 * Adapter SKU: FE ⇄ BE thật (module `skus`).
 * Map ngược đầy đủ về shape `Sku` (types/sku.ts) — quotaManagement.materialType/
 * manhData/manhReviewStatus... — để SKUListPage/SKUDetail/SKUReviewPage
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
import { http, withIdempotencyKey } from './core/http';
import type {
  BaoBiDongGoiItem,
  CreateSkuPayload,
  DaySonItem,
  ManhChildGroup,
  ManhChildRow,
  ManhRow,
  MaterialType,
  ProcessStep,
  Sku,
  QuotaEntryMeta,
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
  materialSpec: string | null;
  materialUnit: string;
  cutLengthMm: number;
  qtyPerPiece: number;
  processSteps: ProcessStep[];
  note: string | null;
}
interface BeMaterialLine {
  id: number;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialSpec: string | null;
  materialUnit: string;
  qtyPerUnit: number;
}
/** Dây/Đinh/Tán rút/Nút nhựa của 1 mảnh — vật tư phẳng theo mảnh (PieceMaterialItem ở BE,
 *  KHÔNG phải SegmentSpec: không có khái niệm cắt). */
interface BePieceMaterialLine {
  id: number;
  materialId: string;
  materialCode: string;
  materialName: string;
  materialSpec: string | null;
  materialUnit: string;
  qtyPerPiece: number;
  note: string | null;
}
interface BePiece {
  id: number;
  pieceId: string;
  name: string;
  qtyPerUnit: number;
  needsHan: boolean;
  needsSon: boolean;
  steel: BeSteelSegment[];
  wire: BePieceMaterialLine[];
  nail: BePieceMaterialLine[];
  rivet: BePieceMaterialLine[];
  plasticButton: BePieceMaterialLine[];
}

interface BeSku {
  id: string;
  salesOrderId: string | null;
  salesOrderCode: string | null;
  salesOrderDeliveryDate: string | null;
  mfgProductId: string;
  factoryCode: string;
  productName: string;
  customerName: string | null;
  productionInvoiceId: string | null;
  piCode: string | null;
  status: Sku['status'];
  note: string | null;
  origin: string | null;
  manhData: { pieces: BePiece[] } | null;
  detailQuota: {
    daySon: BeMaterialLine[];
    vatTuPhuKien: BeMaterialLine[];
    baoBiDongGoi: BeMaterialLine[];
  } | null;
  manhForwardedAt: string | null;
  detailForwardedAt: string | null;
  bossRejectReason: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  manhReviews: BeReview[];
  detailReviews: BeReview[];
}

/** Mảnh giờ luôn nhập/duyệt 1 lần duy nhất (group SAT ở BE, không còn DAY/DINH riêng). */
const MANH_REVIEW_GROUP = 'SAT';
/** Định mức chi tiết giờ luôn nhập/duyệt 1 lần duy nhất (group DAY_SON ở BE làm sentinel, không
 *  còn tách VAT_TU_PHU_KIEN/BAO_BI_DONG_GOI riêng). */
const DETAIL_REVIEW_GROUP = 'DAY_SON';

/** 4 nhóm vật tư "phẳng theo mảnh" cạnh Sắt - khớp PIECE_MATERIAL_LINE_GROUPS ở BE. */
const CHILD_GROUP_TO_BE: Record<Exclude<ManhChildGroup, 'sat'>, string> = {
  day: 'WIRE',
  dinh: 'NAIL',
  tanRut: 'RIVET',
  nutNhua: 'PLASTIC_BUTTON',
};

function toManhRow(p: BePiece): ManhRow {
  const steelChildren: ManhChildRow[] = p.steel.map((s) => ({
    id: s.id,
    group: 'sat',
    segmentSpecId: s.segmentSpecId,
    materialId: s.materialId,
    name: s.materialName,
    specs: s.materialSpec ?? undefined,
    length: String(s.cutLengthMm),
    qty: String(s.qtyPerPiece),
    processSteps: s.processSteps ?? [],
    note: s.note ?? undefined,
    unit: s.materialUnit,
  }));
  const lineChildren = (lines: BePieceMaterialLine[], group: Exclude<ManhChildGroup, 'sat'>): ManhChildRow[] =>
    lines.map((l) => ({
      id: l.id,
      group,
      materialId: l.materialId,
      name: l.materialName,
      specs: l.materialSpec ?? undefined,
      qty: String(l.qtyPerPiece),
      note: l.note ?? undefined,
      unit: l.materialUnit,
    }));
  return {
    id: p.id,
    pieceId: p.pieceId,
    name: p.name,
    qtyPerSku: String(p.qtyPerUnit),
    needsHan: p.needsHan,
    needsSon: p.needsSon,
    children: [
      ...steelChildren,
      ...lineChildren(p.wire, 'day'),
      ...lineChildren(p.nail, 'dinh'),
      ...lineChildren(p.rivet, 'tanRut'),
      ...lineChildren(p.plasticButton, 'nutNhua'),
    ],
  };
}

function toDaySonItem(l: BeMaterialLine): DaySonItem {
  return { id: l.id, materialId: l.materialId, name: l.materialName, specifications: l.materialSpec ?? undefined, kg: l.qtyPerUnit, unit: l.materialUnit };
}

function toAccessoryLine(l: BeMaterialLine): VatTuPhuKienItem | BaoBiDongGoiItem {
  return { id: l.id, materialId: l.materialId, name: l.materialName, specifications: l.materialSpec ?? undefined, quantity: l.qtyPerUnit, unit: l.materialUnit };
}

/** Mảnh/Định mức chi tiết chỉ còn 1 quyết định duyệt duy nhất (không còn Record theo nhóm như
 *  Sắt/Dây/Đinh hay Sơn/Phụ kiện/Bao bì cũ) - `sentinelGroup` là group cố định dùng làm đại
 *  diện cho cả nhóm gộp (xem MANH_REVIEW_GROUP/DETAIL_REVIEW_GROUP). */
function toSingleReviewStatus(reviews: BeReview[], sentinelGroup: string): QuotaReviewStatus | undefined {
  const row = reviews.find((r) => r.group === sentinelGroup);
  return row && row.status ? { status: row.status, reason: row.reason ?? undefined, reviewedAt: row.reviewedAt ?? '' } : undefined;
}

function toSingleEntryMeta(reviews: BeReview[], sentinelGroup: string): QuotaEntryMeta | undefined {
  const row = reviews.find((r) => r.group === sentinelGroup);
  return row?.enteredBy ? { enteredBy: row.enteredBy, enteredAt: row.enteredAt ?? '' } : undefined;
}

function toSku(pf: BeSku): Sku {
  return {
    id: pf.id,
    exportOrderId: pf.salesOrderId,
    mfgProductId: pf.mfgProductId,
    status: pf.status,
    note: pf.note,
    manhForwardedAt: pf.manhForwardedAt,
    detailForwardedAt: pf.detailForwardedAt,
    bossRejectReason: pf.bossRejectReason,
    customerName: pf.customerName,
    piCode: pf.piCode ?? '',
    productionInvoiceId: pf.productionInvoiceId ?? undefined,
    origin: (pf.origin as 'PRODUCTION_CONFIRM' | undefined) ?? undefined,
    createdAt: pf.createdAt,
    exportOrder:
      pf.salesOrderId != null
        ? { id: pf.salesOrderId, poNumber: pf.salesOrderCode ?? '', deliveryDate: pf.salesOrderDeliveryDate ?? undefined }
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
      entryMeta: toSingleEntryMeta(pf.detailReviews, DETAIL_REVIEW_GROUP),
      reviewStatus: toSingleReviewStatus(pf.detailReviews, DETAIL_REVIEW_GROUP),
    },
    manhData: {
      pieces: (pf.manhData?.pieces ?? []).map(toManhRow),
    },
    manhEntryMeta: toSingleEntryMeta(pf.manhReviews, MANH_REVIEW_GROUP),
    manhReviewStatus: toSingleReviewStatus(pf.manhReviews, MANH_REVIEW_GROUP),
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
  mfgProducts: { id: string; factoryCode: string; name: string }[];
}> {
  const products = await http.get<{ id: string; factoryCode: string; name: string }[] | { data: { id: string; factoryCode: string; name: string }[] }>('/products?limit=100');
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
 * Mảnh giờ chứa cả 5 nhóm vật tư trong 1 lần gửi duy nhất - mỗi `ManhRow.children` được tách
 * theo `group`: `group==='sat'` build `segments[]` (đoạn cắt, materialId chọn từ MaterialPicker
 * nhóm Sắt); 4 nhóm còn lại (day/dinh/tanRut/nutNhua) build `materialLines[]` phẳng (materialId
 * chọn từ MaterialPicker nhóm tương ứng, không có khái niệm cắt).
 */
export async function updateSkuManhQuota(
  id: number | string,
  rows: ManhRow[],
  enteredBy: string,
): Promise<Sku> {
  const body = {
    pieces: rows.map((r) => ({
      name: r.name,
      qtyPerUnit: Number(r.qtyPerSku) || 1,
      needsHan: r.needsHan,
      needsSon: r.needsSon,
      segments: r.children
        .filter((c) => c.group === 'sat')
        .map((c) => ({
          materialId: String(c.materialId ?? ''),
          cutLengthMm: Number(c.length) || 0,
          qtyPerPiece: Number(c.qty) || 0,
          processSteps: c.processSteps ?? [],
          note: c.note || undefined,
        })),
      materialLines: r.children
        .filter((c): c is ManhChildRow & { group: Exclude<ManhChildGroup, 'sat'> } => c.group !== 'sat')
        .map((c) => ({
          group: CHILD_GROUP_TO_BE[c.group],
          materialId: String(c.materialId ?? ''),
          qtyPerPiece: Number(c.qty) || 0,
          note: c.note || undefined,
        })),
    })),
    enteredBy,
  };
  const updated = await http.post<BeSku>(`/skus/${id}/manh-quota`, body);
  return toSku(updated);
}

/**
 * Định mức chi tiết giờ chứa cả 3 nhóm (Sơn/Phụ kiện/Bao bì) trong 1 lần gửi duy nhất - mỗi
 * mảng được tag `group` tương ứng (DAY_SON/VAT_TU_PHU_KIEN/BAO_BI_DONG_GOI) trước khi gộp
 * thành `detailLines[]` gửi lên. `materialId` trên mỗi dòng chọn từ MaterialPicker (nhóm Sơn/
 * Phụ kiện/Bao bì tương ứng).
 */
export async function updateSkuDetailQuota(
  id: number | string,
  payload: { daySon: DaySonItem[]; vatTuPhuKien: VatTuPhuKienItem[]; baoBiDongGoi: BaoBiDongGoiItem[] },
  enteredBy: string,
): Promise<Sku> {
  const detailLines = [
    ...payload.daySon.map((it) => ({ group: 'DAY_SON', materialId: String(it.materialId ?? ''), qtyPerUnit: it.kg ?? 0 })),
    ...payload.vatTuPhuKien.map((it) => ({ group: 'VAT_TU_PHU_KIEN', materialId: String(it.materialId ?? ''), qtyPerUnit: it.quantity ?? 0 })),
    ...payload.baoBiDongGoi.map((it) => ({ group: 'BAO_BI_DONG_GOI', materialId: String(it.materialId ?? ''), qtyPerUnit: it.quantity ?? 0 })),
  ]
  const updated = await http.post<BeSku>(`/skus/${id}/detail-quota`, { detailLines, enteredBy });
  return toSku(updated);
}

export async function reviewSkuManhQuota(
  id: number | string,
  status: ReviewDecision,
  reason?: string,
): Promise<Sku> {
  const updated = await http.post<BeSku>(`/skus/${id}/manh-quota/review`, { status, reason });
  return toSku(updated);
}

export async function reviewSkuDetailQuota(
  id: number | string,
  status: ReviewDecision,
  reason?: string,
): Promise<Sku> {
  const updated = await http.post<BeSku>(`/skus/${id}/detail-quota/review`, { status, reason });
  return toSku(updated);
}

export async function approvePartsSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/approve-parts`));
}

export async function approveDetailSku(id: number | string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/approve-detail`));
}

export async function rejectSkuByBoss(id: number | string, reason?: string): Promise<Sku> {
  return toSku(await http.post<BeSku>(`/skus/${id}/reject-boss`, { reason }));
}

export async function approveFullSku(id: number | string): Promise<Sku> {
  // BE bắt buộc header này (BadRequestException nếu thiếu, SkusController.approve()) - trước đây
  // hàm này gọi thiếu, khiến nút "Duyệt" cuối của Sếp luôn 400.
  return toSku(await http.post<BeSku>(`/skus/${id}/approve`, undefined, withIdempotencyKey()));
}

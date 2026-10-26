/**
 * Chip "hao hụt khi cắt riêng ở cây 6m" và gợi ý "gộp với đơn nào" ở màn Tối ưu cắt sắt (2026-10-24).
 *
 * - Chip là CẢNH BÁO cho trường hợp SKU cắt riêng trên cây chuẩn (người dùng: "con số đó là đối với cây chuẩn 6m để cảnh báo").
 *   Đo 2026-10-24 (changelog BE mục 28): số đã xác minh bằng solver khớp 27/27; nhưng chip CHƯA xác minh (ước tính best-fill "≥")
 *   từng hiện XANH khi thật ra vượt ngưỡng (SAT-PHI-6 "≥0,17%" vs 19,67 %; MC Tự động "≥0%" vs 57 %) - nên chưa xác minh mà
 *   cận dưới chưa vượt ngưỡng thì là "chưa kiểm" (xám), không phải "đạt".
 * - Gợi ý gộp: trước mỗi dòng SKU in "gộp được với: GHE-J55, GHE-J55, …" lặp ở MỌI dòng dùng chung sắt. Nay gom theo LOẠI SẮT
 *   (1 khối trên bảng), dựng từ chính danh sách đơn của bảng (id, mã PO, hạn giao).
 */
import type { CuttingBatchCandidate, CuttingBatchCandidateList } from '../services/cutting-batch-api';

type Material = CuttingBatchCandidate['materials'][number];

/** ok = đã xác minh, đạt ngưỡng; over = vượt ngưỡng (đã xác minh, hoặc cận dưới ước tính đã vượt - chắc chắn vượt); unknown = chưa kiểm. */
export type ChipStatus = 'ok' | 'over' | 'unknown';

export function chipStatus(m: Material): ChipStatus {
  if (m.overThreshold) return 'over';
  return m.verified ? 'ok' : 'unknown';
}

/**
 * Ghép kết quả lượt KIỂM BÙ (`deepVerify`) vào bảng đang hiện: chỉ thay các loại sắt lượt bù đã xác minh được, GIỮ thứ tự dòng và
 * mọi thứ khác (đề xuất tick sẵn, lựa chọn) - bảng không được nhảy dòng dưới tay KHSX đang tick.
 */
export function mergeVerified(prev: CuttingBatchCandidateList, deep: CuttingBatchCandidateList): CuttingBatchCandidateList {
  const deepById = new Map(deep.items.map((i) => [i.productionInvoiceItemId, i]));
  return {
    ...prev,
    items: prev.items.map((it) => {
      const d = deepById.get(it.productionInvoiceItemId);
      if (!d) return it;
      const dm = new Map(d.materials.map((m) => [m.materialId, m]));
      let changed = false;
      const materials = it.materials.map((m) => {
        const x = dm.get(m.materialId);
        if (!x || !x.verified || m.verified) return m;
        changed = true;
        return { ...m, ...x };
      });
      return changed ? { ...it, materials } : it;
    }),
    // Tick sẵn (đơn gấp nhất có chip đỏ): lượt bù xác minh lại chip nên có thể đổi - lấy của lượt bù (lựa chọn đang tick do trang tự quyết).
    recommendedItemIds: deep.recommendedItemIds,
  };
}

/** Loại sắt -> mọi đơn trong bảng dùng loại đó. */
export function itemsByMaterialOf(items: CuttingBatchCandidate[]): Map<string, CuttingBatchCandidate[]> {
  const map = new Map<string, CuttingBatchCandidate[]>();
  for (const it of items) for (const m of it.materials) map.set(m.materialId, [...(map.get(m.materialId) ?? []), it]);
  return map;
}

/** "GHE-J55 ×9 · GHE-TINH-YEU ×8 · BAN-8-MEIYING-J55" - đếm đơn trùng mã SKU, nhiều nhất trước. */
export function countBySku(items: CuttingBatchCandidate[]): string {
  const counts = new Map<string, number>();
  for (const p of items) counts.set(p.mfgProductCode, (counts.get(p.mfgProductCode) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, n]) => (n > 1 ? `${code} ×${n}` : code))
    .join(' · ');
}

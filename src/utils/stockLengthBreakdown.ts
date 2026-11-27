/**
 * Tách số cây của 1 loại sắt theo chiều dài cây (CS2 20/11/2026). File riêng, không phụ thuộc xlsx, để màn KHSX dùng được mà
 * không kéo theo thư viện in/Excel của cuttingGuide.ts.
 */
/** Dòng tối thiểu để tách số cây theo chiều dài - CuttingProposalLine (đã duyệt) lẫn CuttingSolveLine (lượt tính) đều thoả. */
export type LineWithPatternLengths = {
  bestStockLengthMm: number | null;
  totalBars: number | null;
  patterns?: ReadonlyArray<{ stockLengthMm?: number | null; barCount: number }> | null;
};

/** CS2 (nghiệp vụ 20/11/2026): số cây theo từng chiều dài cây của 1 loại sắt - cây lẻ đang có ở kho Phôi (dùng trước, khác
 *  chiều dài mua) và cây chiều dài mua (`bestStockLengthMm`). Tăng dần theo chiều dài; cây không rõ chiều dài tính vào chiều
 *  dài mua. Phương án cũ / không có cây lẻ thì đúng 1 phần tử (chiều dài mua). */
export function stockLengthBreakdown(line: LineWithPatternLengths): { lengthMm: number; bars: number; leftover: boolean }[] {
  const best = line.bestStockLengthMm;
  const byLen = new Map<number, number>();
  let counted = 0;
  for (const p of line.patterns ?? []) {
    const len = p.stockLengthMm ?? best;
    if (len == null || !(p.barCount > 0)) continue;
    byLen.set(len, (byLen.get(len) ?? 0) + p.barCount);
    counted += p.barCount;
  }
  const rest = (line.totalBars ?? 0) - counted;
  if (rest > 0 && best != null) byLen.set(best, (byLen.get(best) ?? 0) + rest);
  return [...byLen].sort((a, b) => a[0] - b[0]).map(([lengthMm, bars]) => ({ lengthMm, bars, leftover: lengthMm !== best }));
}


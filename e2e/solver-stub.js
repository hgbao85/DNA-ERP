// Stub cho solver ngoài "cat_sat" (SOLVER_BASE_URL, xem D:\DNA-ERP-BE\src\modules\cutting-proposals\cutting-proposals.service.ts).
// Baseline e2e không nên phụ thuộc 1 service ngoài thật (chậm, không xác định, không có trong repo
// này) — stub trả lời deterministic đúng shape SolverProposeResponse mà cutting-proposals.service.ts
// mong đợi, đủ để CuttingProposalsService.approve() chạy hết luồng thật (tạo PurchaseProposal...).
const http = require('http');

const PORT = Number(process.env.SOLVER_STUB_PORT || 18080);
const PROPOSE_PATH = '/api/v1/de_xuat/propose/';

function buildResponse(body) {
  const stockLengths = String(body.stock_lengths || '5850')
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);
  const stockLen = stockLengths[0] || 5850;
  const numSets = Number(body.num_sets) || 1;

  const byMaterial = new Map();
  for (const row of body.bom || []) {
    const key = String(row.material);
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key).push(row);
  }

  let totalBarsAll = 0;
  let totalWasteMmAll = 0;
  const purchase_plan = [];

  for (const [material, rows] of byMaterial) {
    const totalLengthMm = rows.reduce(
      (sum, r) => sum + Number(r.cut_length) * Number(r.qty_per_part) * numSets,
      0,
    );
    const bars = Math.max(1, Math.ceil(totalLengthMm / stockLen));
    const wasteMm = Math.max(0, bars * stockLen - totalLengthMm);
    const wastePct = bars > 0 ? (wasteMm / (bars * stockLen)) * 100 : 0;

    const bySize = new Map();
    for (const r of rows) {
      const size = Number(r.cut_length);
      const count = Math.max(1, Math.ceil((Number(r.qty_per_part) * numSets) / bars));
      bySize.set(size, (bySize.get(size) || 0) + count);
    }

    totalBarsAll += bars;
    totalWasteMmAll += wasteMm;

    purchase_plan.push({
      material,
      feasible: true,
      over_threshold: false,
      best_stock_length: stockLen,
      total_bars: bars,
      total_waste_mm: wasteMm,
      waste_percentage: wastePct,
      mau_nguyen_mm: 0,
      length_comparison: [{ length: stockLen, bars, waste_pct: wastePct }],
      cutting_patterns: [
        {
          pattern_id: 0,
          bars,
          waste_per_bar: bars > 0 ? wasteMm / bars : 0,
          mau_nguyen_mm: 0,
          pieces_breakdown: [...bySize.entries()].map(([size, count]) => ({ size, count })),
        },
      ],
    });
  }

  return {
    status: 'ok',
    summary: {
      total_bars_all: totalBarsAll,
      total_waste_mm: totalWasteMmAll,
      waste_percentage: totalBarsAll > 0 ? (totalWasteMmAll / (totalBarsAll * stockLen)) * 100 : 0,
      any_over_threshold: false,
    },
    purchase_plan,
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('solver-stub ok');
    return;
  }
  if (req.method === 'POST' && req.url === PROPOSE_PATH) {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        const body = JSON.parse(raw || '{}');
        const response = buildResponse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: String(err) }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(PORT, () => {
  console.log(`[solver-stub] listening on http://localhost:${PORT}`);
});

const ISO = (d: string) => new Date(d).toISOString();

const PI1 = { piId: 1, code: 'PI-2026-001', poNumber: 'PO-MY-001', productLabel: 'Ghế J55 × 500 bộ', totalBo: 500 };
const PI2 = { piId: 2, code: 'PI-2026-002', poNumber: 'PO-GP-002', productLabel: 'Ghế IEA-3 × 200 bộ', totalBo: 200 };

const manhPiece = (overrides: Record<string, unknown> = {}) => ({
  id: 101,
  name: 'Mặt ghế',
  code: 'MAT-GHE',
  groupNumber: 1,
  pieceNumber: 2,
  target: 500,
  waiting: 80,
  allocated: 200,
  received: 120,
  notReceived: 80,
  remaining: 300,
  ...overrides,
});

export const seedPhoiExecutions = [
  {
    piId: 1,
    code: 'PI-2026-001',
    poNumber: 'PO-MY-001',
    deadline: ISO('2026-08-01'),
    items: [{ quantity: 500, productName: 'Ghế J55', factoryCode: 'JSE-55', colorCode: 'BLACK', description: 'JSE-55 Đen — MEYING' }],
    pieces: [
      {
        id: 101,
        framePieceId: 1,
        code: 'GHE-J55',
        name: 'Ghế J55',
        groupNumber: 1,
        pieceNumber: 1,
        targetQuantity: 500,
        requiredOps: ['CAT', 'UON', 'DAP'],
        completedQuantity: 320,
        failedQuantity: 5,
        remaining: 175,
        byOperation: [
          { operation: 'CAT', passed: 450, pending: 10, failed: 2, available: 0 },
          { operation: 'UON', passed: 380, pending: 8, failed: 1, available: 60 },
          { operation: 'DAP', passed: 320, pending: 5, failed: 2, available: 58 },
        ],
        materials: [
          {
            framePieceMaterialId: 11,
            name: 'Ống sắt 25×25',
            unit: 'cây',
            spec: '25×25×1.2mm',
            cutLengthMm: 600,
            piecesPerFrame: 2,
            operations: ['CAT'],
            byOp: {
              CAT: { target: 1000, passed: 900, pending: 10, failed: 2, remaining: 88 },
            },
          },
        ],
      },
    ],
    pendingReports: [
      {
        id: 501,
        piFramePieceId: 101,
        framePieceMaterialId: 11,
        pieceName: 'Ghế J55',
        materialLabel: 'Ống sắt 25×25: 25×25×1.2mm',
        operation: 'CAT',
        quantity: 20,
        createdAt: ISO('2026-06-20'),
        reportedBy: { id: 12, name: 'Thống kê Cơ khí' },
      },
    ],
    failedReports: [
      {
        id: 502,
        pieceName: 'Ghế J55',
        operation: 'UON',
        quantity: 3,
        defectReason: { id: 1, label: 'Cong méo' },
        reviewNote: 'Uốn lệch 2mm',
        reviewedBy: { id: 10, name: 'QC Kiều' },
        reviewedAt: ISO('2026-06-19'),
      },
    ],
  },
  {
    piId: 2,
    code: 'PI-2026-002',
    poNumber: 'PO-GP-002',
    deadline: ISO('2026-09-01'),
    items: [{ quantity: 200, productName: 'Ghế IEA-3', factoryCode: 'IEA-3', colorCode: 'BLACK', description: 'IEA-3 Đen' }],
    pieces: [],
    pendingReports: [],
    failedReports: [],
  },
];

export const seedStageExec = [
  {
    key: '1-HAN',
    piId: 1,
    code: 'PI-2026-001',
    poNumber: 'PO-MY-001',
    deadline: ISO('2026-08-01'),
    stageType: 'HAN',
    items: [{ quantity: 500, productName: 'Ghế J55', factoryCode: 'JSE-55', colorCode: 'BLACK' }],
    pieces: [
      { id: 101, code: 'GHE-J55', name: 'Ghế J55', target: 500, passed: 280, pending: 12, failed: 4, remaining: 204, upstreamDone: 480, available: 188 },
    ],
    pats: [
      { id: 101, framePieceMaterialId: 21, pieceName: 'Ghế J55', name: 'Tán M6', spec: 'M6×12', unit: 'cái', target: 2000, passed: 1200, pending: 0, failed: 0, remaining: 800 },
    ],
    piecePercent: 56,
    patPercent: 60,
    hasPat: true,
    pendingReports: [{ id: 601, piFramePieceId: 101, pieceName: 'Ghế J55', quantity: 12, createdAt: ISO('2026-06-21'), reportedBy: { id: 13, name: 'Tổ Hàn Sơn' } }],
    failedReports: [],
  },
  {
    key: '1-SON',
    piId: 1,
    code: 'PI-2026-001',
    poNumber: 'PO-MY-001',
    deadline: ISO('2026-08-01'),
    stageType: 'SON',
    items: [{ quantity: 500, productName: 'Ghế J55', factoryCode: 'JSE-55', colorCode: 'BLACK' }],
    pieces: [{ id: 101, code: 'GHE-J55', name: 'Ghế J55', target: 500, passed: 120, pending: 0, failed: 0, remaining: 380, upstreamDone: 280, available: 160 }],
    pats: [],
    piecePercent: 24,
    patPercent: 0,
    hasPat: false,
    pendingReports: [],
    failedReports: [],
  },
  {
    key: '2-HAN',
    piId: 2,
    code: 'PI-2026-002',
    poNumber: 'PO-GP-002',
    deadline: ISO('2026-09-01'),
    stageType: 'HAN',
    items: [{ quantity: 200, productName: 'Ghế IEA-3', factoryCode: 'IEA-3', colorCode: 'BLACK' }],
    pieces: [{ id: 201, code: 'GHE-IEA3', name: 'Khung IEA-3', target: 200, passed: 0, pending: 0, failed: 0, remaining: 200, upstreamDone: 0, available: 0 }],
    pats: [],
    piecePercent: 0,
    patPercent: 0,
    hasPat: false,
    pendingReports: [],
    failedReports: [],
  },
];

export const seedWeavingFinishedFrames = [
  {
    ...PI1,
    pieces: [manhPiece()],
  },
  {
    ...PI2,
    totalBo: 200,
    productLabel: 'Ghế IEA-3 × 200 bộ',
    pieces: [manhPiece({ id: 201, name: 'Khung IEA-3', code: 'KH-IEA3', target: 200, waiting: 200, allocated: 0, received: 0, notReceived: 0, remaining: 200 })],
  },
];

export const seedWeavingManhSummary = seedWeavingFinishedFrames;

export const seedWeavingByPoint = [
  {
    id: 1,
    code: 'DD-A',
    fullName: 'Anh Tuấn',
    phone: '0909123456',
    totalHolding: 45,
    assignments: [
      {
        id: 901,
        piCode: 'PI-2026-001',
        poNumber: 'PO-MY-001',
        productLabel: 'Ghế J55',
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        quantity: 100,
        completed: 55,
        holding: 45,
        deadline: ISO('2026-07-05'),
      },
    ],
  },
  {
    id: 2,
    code: 'DD-B',
    fullName: 'Chị Hà',
    phone: '0918765432',
    totalHolding: 30,
    assignments: [
      {
        id: 902,
        piCode: 'PI-2026-001',
        poNumber: 'PO-MY-001',
        productLabel: 'Ghế J55',
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        quantity: 80,
        completed: 50,
        holding: 30,
        deadline: ISO('2026-07-10'),
      },
    ],
  },
];

export const seedWeavingAllocation = [
  {
    ...PI1,
    minAllocationQty: 50,
    pieces: [
      {
        ...manhPiece(),
        sonCompleted: 280,
        allocations: [
          { id: 901, weavingPointId: 1, weavingPointName: 'DD-A — Anh Tuấn', quantity: 120, deadline: ISO('2026-07-05') },
          { id: 902, weavingPointId: 2, weavingPointName: 'DD-B — Chị Hà', quantity: 80, deadline: ISO('2026-07-10') },
        ],
      },
    ],
  },
];

export const seedWeavingReceivePending = [
  {
    id: 1,
    code: 'DD-A',
    fullName: 'Anh Tuấn',
    phone: '0909123456',
    totalPending: 45,
    pieces: [
      {
        piFramePieceId: 101,
        piCode: 'PI-2026-001',
        poNumber: 'PO-MY-001',
        productLabel: 'Ghế J55',
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        dispatched: 100,
        received: 55,
        notReceived: 45,
      },
    ],
  },
  {
    id: 2,
    code: 'DD-B',
    fullName: 'Chị Hà',
    phone: '0918765432',
    totalPending: 30,
    pieces: [
      {
        piFramePieceId: 101,
        piCode: 'PI-2026-001',
        poNumber: 'PO-MY-001',
        productLabel: 'Ghế J55',
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        dispatched: 80,
        received: 50,
        notReceived: 30,
      },
    ],
  },
];

export const seedWeavingByWarehouse = [
  {
    id: 5,
    name: 'Kho Nghĩa',
    totalPieces: 120,
    pieces: [
      { piCode: 'PI-2026-001', pieceName: 'Mặt ghế', pieceCode: 'MAT-GHE', quantity: 120 },
    ],
  },
];

export const seedChuyenKiem = [
  {
    ...PI1,
    pieces: [
      {
        ...manhPiece(),
        received: 120,
        inspected: 95,
        failed: 5,
        pending: 8,
        available: 12,
      },
    ],
    pendingReports: [
      {
        id: 701,
        piFramePieceId: 101,
        pieceName: 'Mặt ghế',
        pieceCode: 'MAT-GHE',
        quantity: 8,
        reportedBy: { id: 14, name: 'QC Kiều' },
        reportedAt: ISO('2026-06-22'),
      },
    ],
    failedReports: [],
  },
];

export const seedPacking = [
  {
    piId: 1,
    code: 'PI-2026-001',
    poNumber: 'PO-MY-001',
    totalTarget: 500,
    totalPacked: 180,
    allDone: false,
    products: [
      {
        productVariantId: 101,
        productName: 'Ghế J55',
        variantDesc: 'JSE-55 Đen — MEYING',
        boxesPerSet: 1,
        boxNote: '1 bộ / 1 thùng',
        target: 500,
        readyToPackSets: 160,
        boxes: [
          { boxIndex: 0, label: 'Thùng tổng', target: 500, packed: 180, remaining: 320, canPackNow: 160, lastPackedAt: ISO('2026-06-20') },
        ],
      },
    ],
  },
];

export const seedPackagingBOM = [
  { id: 1, productVariantId: 101, itemName: 'Thùng carton JSE-55 (75×54×44cm)', unit: 'cái', qtyPerSet: 1, isActive: true },
  { id: 2, productVariantId: 101, itemName: 'Lót góc 10×10', unit: 'cái', qtyPerSet: 8, isActive: true },
  { id: 3, productVariantId: 101, itemName: 'Bao nylon 68×105', unit: 'cái', qtyPerSet: 2, isActive: true },
  { id: 4, productVariantId: 102, itemName: 'Thùng carton IEA-3', unit: 'cái', qtyPerSet: 1, isActive: true },
];

export const seedPackagingByPI: Record<number, unknown[]> = {
  1: [
    { id: 1, itemName: 'Thùng carton JSE-55 (75×54×44cm)', unit: 'cái', qtyNeeded: 500, qtyReceived: 300, qtyMissing: 200, isFromBOM: true },
    { id: 2, itemName: 'Lót góc 10×10', unit: 'cái', qtyNeeded: 4000, qtyReceived: 4000, qtyMissing: 0, isFromBOM: true },
    { id: 3, itemName: 'Bao nylon 68×105', unit: 'cái', qtyNeeded: 1000, qtyReceived: 800, qtyMissing: 200, isFromBOM: true },
    { id: 4, itemName: 'Nhãn barcode MEYING', unit: 'cái', qtyNeeded: 500, qtyReceived: 0, qtyMissing: 500, isFromBOM: true },
  ],
};

export const seedPiMaterialChecks: Record<number, { piId: number; status: string; shortages: Array<{ name: string; unit: string; required: number; stock: number; buyQty: number }> }> = {
  1: { piId: 1, status: 'PRODUCING', shortages: [] },
  2: {
    piId: 2,
    status: 'PURCHASING',
    shortages: [
      { name: 'Ống sắt 25×25', unit: 'cây', required: 120, stock: 30, buyQty: 90 },
      { name: 'Dây PE Ø3mm', unit: 'kg', required: 200, stock: 50, buyQty: 150 },
      { name: 'Tán M6×12', unit: 'cái', required: 4000, stock: 3500, buyQty: 500 },
    ],
  },
};

export const seedMfgWarehouseTxns = [
  // ── Kho Sắt (id:2) ──────────────────────────────────────────────────
  {
    id: 1, type: 'IMPORT', quantity: 50, warehouseId: 2,
    date: ISO('2026-06-15'), refCode: 'LMH-2026-001',
    item: { name: 'Ống sắt 25×25', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Nhập từ lệnh mua hàng LMH-001',
  },
  {
    id: 2, type: 'EXPORT', quantity: 10, warehouseId: 2,
    date: ISO('2026-06-18'),
    item: { name: 'Ống sắt 25×25', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Xuất cho PI-2026-001',
  },
  {
    id: 4, type: 'IMPORT', quantity: 100, warehouseId: 2,
    date: ISO('2026-05-10'), refCode: 'LMH-2026-002',
    item: { name: 'Ống sắt 20×40', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Nhập bổ sung tháng 5',
  },
  {
    id: 5, type: 'EXPORT', quantity: 22, warehouseId: 2,
    date: ISO('2026-05-20'),
    item: { name: 'Ống sắt 20×40', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Xuất xưởng hàn PI-2026-003',
  },
  {
    id: 6, type: 'IMPORT', quantity: 80, warehouseId: 2,
    date: ISO('2026-05-25'), refCode: 'LMH-2026-003',
    item: { name: 'Ống sắt 30×30', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Nhập từ nhà cung cấp Thép Nam Đô',
  },
  {
    id: 7, type: 'EXPORT', quantity: 30, warehouseId: 2,
    date: ISO('2026-06-05'),
    item: { name: 'Ống sắt 30×30', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Xuất cắt phôi lô JSE-60 x200',
  },
  {
    id: 8, type: 'ADJUST', quantity: -5, warehouseId: 2,
    date: ISO('2026-06-20'),
    item: { name: 'Sắt hộp 25×25', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Điều chỉnh kiểm kê tháng 6 — phát hiện hao hụt cắt',
  },
  {
    id: 9, type: 'IMPORT', quantity: 60, warehouseId: 2,
    date: ISO('2026-06-22'), refCode: 'LMH-2026-005',
    item: { name: 'Sắt dẹt 20×3', unit: 'cây' },
    createdBy: { name: 'Kho Minh' }, note: 'Nhập phục vụ đơn IEA-3 GOPLUS',
  },

  // ── Kho Phụ kiện (id:1) ─────────────────────────────────────────────
  {
    id: 3, type: 'IMPORT', quantity: 2000, warehouseId: 1,
    date: ISO('2026-06-10'), refCode: 'LMH-2026-001',
    item: { name: 'Tán M6×12', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Nhập theo kế hoạch quý 2',
  },
  {
    id: 10, type: 'EXPORT', quantity: 480, warehouseId: 1,
    date: ISO('2026-06-12'),
    item: { name: 'Tán M6×12', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Xuất lắp ráp JSE-55 x10 bộ',
  },
  {
    id: 11, type: 'IMPORT', quantity: 1500, warehouseId: 1,
    date: ISO('2026-05-15'), refCode: 'LMH-2026-002',
    item: { name: 'Chốt 10mm', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Nhập từ NCC Phú Thịnh',
  },
  {
    id: 12, type: 'EXPORT', quantity: 200, warehouseId: 1,
    date: ISO('2026-05-28'),
    item: { name: 'Chốt 10mm', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Xuất lắp ráp IEA-3 lô MEYING',
  },
  {
    id: 13, type: 'IMPORT', quantity: 600, warehouseId: 1,
    date: ISO('2026-06-01'), refCode: 'LMH-2026-004',
    item: { name: 'Pát V 100', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Nhập tồn kho dự phòng',
  },
  {
    id: 14, type: 'EXPORT', quantity: 120, warehouseId: 1,
    date: ISO('2026-06-08'),
    item: { name: 'Pát V 100', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Xuất PI-2026-002 xưởng hàn',
  },
  {
    id: 15, type: 'ADJUST', quantity: -30, warehouseId: 1,
    date: ISO('2026-06-25'),
    item: { name: 'Ô tròn lỗ dù', unit: 'cái' },
    createdBy: { name: 'Kho Hoa' }, note: 'Kiểm kê — mất mát trong tháng',
  },

  // ── Kho Khung/Dây (id:3) ────────────────────────────────────────────
  {
    id: 16, type: 'IMPORT', quantity: 150, warehouseId: 3,
    date: ISO('2026-05-05'), refCode: 'LMH-2026-003',
    item: { name: 'Dây PE Ø3mm', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Nhập từ Nhựa Tiền Phong',
  },
  {
    id: 17, type: 'EXPORT', quantity: 35, warehouseId: 3,
    date: ISO('2026-05-12'),
    item: { name: 'Dây PE Ø3mm', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Xuất tổ đan IEA-3 lô 1',
  },
  {
    id: 18, type: 'EXPORT', quantity: 28, warehouseId: 3,
    date: ISO('2026-05-22'),
    item: { name: 'Dây PE Ø3mm', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Xuất tổ đan JSE-55 lô IKEA',
  },
  {
    id: 19, type: 'IMPORT', quantity: 100, warehouseId: 3,
    date: ISO('2026-06-02'), refCode: 'LMH-2026-005',
    item: { name: 'Dây PE Ø4mm', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Nhập bổ sung — hàng về sớm hơn kế hoạch',
  },
  {
    id: 20, type: 'EXPORT', quantity: 45, warehouseId: 3,
    date: ISO('2026-06-10'),
    item: { name: 'Dây PE Ø4mm', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Xuất đan JSE-60 lô GOPLUS x50',
  },
  {
    id: 21, type: 'IMPORT', quantity: 80, warehouseId: 3,
    date: ISO('2026-06-18'), refCode: 'LMH-2026-006',
    item: { name: 'Dây nhựa đan', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Nhập hàng tháng 6',
  },
  {
    id: 22, type: 'EXPORT', quantity: 60, warehouseId: 3,
    date: ISO('2026-06-23'),
    item: { name: 'Dây PE xám', unit: 'kg' },
    createdBy: { name: 'Kho Nam' }, note: 'Xuất đan ghế IEA-3 xám IKEA',
  },

  // ── Kho Bao bì/Thành phẩm (id:5) ────────────────────────────────────
  {
    id: 23, type: 'IMPORT', quantity: 300, warehouseId: 5,
    date: ISO('2026-05-08'), refCode: 'LMH-2026-002',
    item: { name: 'Thùng carton JSE-55', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Nhập thùng cho đơn MEYING Q3',
  },
  {
    id: 24, type: 'EXPORT', quantity: 100, warehouseId: 5,
    date: ISO('2026-05-18'),
    item: { name: 'Thùng carton JSE-55', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Xuất đóng gói lô PO-MY-001 đợt 1',
  },
  {
    id: 25, type: 'EXPORT', quantity: 80, warehouseId: 5,
    date: ISO('2026-06-05'),
    item: { name: 'Thùng carton JSE-55', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Xuất đóng gói lô PO-IK-003 đợt 1',
  },
  {
    id: 26, type: 'IMPORT', quantity: 500, warehouseId: 5,
    date: ISO('2026-05-15'), refCode: 'LMH-2026-003',
    item: { name: 'Bao nylon 68×105', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Nhập bao bọc sản phẩm Q2-Q3',
  },
  {
    id: 27, type: 'EXPORT', quantity: 150, warehouseId: 5,
    date: ISO('2026-05-25'),
    item: { name: 'Bao nylon 68×105', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Xuất bọc ghế trước khi đóng thùng',
  },
  {
    id: 28, type: 'IMPORT', quantity: 120, warehouseId: 5,
    date: ISO('2026-06-14'),
    item: { name: 'Mặt ghế J55 (đan xong)', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Nhận bán thành phẩm từ tổ đan',
  },
  {
    id: 29, type: 'EXPORT', quantity: 80, warehouseId: 5,
    date: ISO('2026-06-20'),
    item: { name: 'Mặt ghế J55 (đan xong)', unit: 'cái' },
    createdBy: { name: 'Thủ kho Lan' }, note: 'Chuyển sang xưởng lắp ráp PI-2026-001',
  },

  // ── Kho Vật tư SX (id:6) ────────────────────────────────────────────
  {
    id: 30, type: 'IMPORT', quantity: 50, warehouseId: 6,
    date: ISO('2026-05-07'), refCode: 'LMH-2026-001',
    item: { name: 'Sơn tĩnh điện đen RAL9005', unit: 'kg' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Nhập sơn quý 2',
  },
  {
    id: 31, type: 'EXPORT', quantity: 12, warehouseId: 6,
    date: ISO('2026-05-20'),
    item: { name: 'Sơn tĩnh điện đen RAL9005', unit: 'kg' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Xuất sơn JSE-55 lô 1',
  },
  {
    id: 32, type: 'IMPORT', quantity: 30, warehouseId: 6,
    date: ISO('2026-06-03'), refCode: 'LMH-2026-004',
    item: { name: 'Sơn tĩnh điện xám RAL7035', unit: 'kg' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Nhập theo kế hoạch sơn IKEA',
  },
  {
    id: 33, type: 'EXPORT', quantity: 8, warehouseId: 6,
    date: ISO('2026-06-10'),
    item: { name: 'Sơn tĩnh điện xám RAL7035', unit: 'kg' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Xuất sơn IEA-3 xám lô IKEA',
  },
  {
    id: 34, type: 'IMPORT', quantity: 80, warehouseId: 6,
    date: ISO('2026-06-08'), refCode: 'LMH-2026-005',
    item: { name: 'Dây PE Ø3mm đen', unit: 'kg' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Nhập dây đan tiêu hao sản xuất',
  },
  {
    id: 35, type: 'EXPORT', quantity: 25, warehouseId: 6,
    date: ISO('2026-06-15'),
    item: { name: 'Dây PE Ø3mm đen', unit: 'kg' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Xuất tổ đan IEA-3 lô MEYING',
  },
  {
    id: 36, type: 'ADJUST', quantity: -3, warehouseId: 6,
    date: ISO('2026-06-24'),
    item: { name: 'Dung môi sơn', unit: 'lít' },
    createdBy: { name: 'Kho Tuấn' }, note: 'Điều chỉnh sau kiểm kê — bay hơi trong quá trình bảo quản',
  },
];

export const seedLaborCost: Record<number, { total: number; items: Array<{ stageType: string; amount: number }> }> = {
  1: {
    total: 12500000,
    items: [
      { stageType: 'PHOI', amount: 4500000 },
      { stageType: 'HAN', amount: 5000000 },
      { stageType: 'SON', amount: 3000000 },
    ],
  },
};

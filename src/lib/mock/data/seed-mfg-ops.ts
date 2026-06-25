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

export const seedWeavingReceiptHistory = [
  {
    id: 1,
    receivedDate: ISO('2026-06-18'),
    pointCode: 'DD-A',
    pointName: 'Anh Tuấn',
    pieceName: 'Mặt ghế',
    pieceCode: 'MAT-GHE',
    piCode: 'PI-2026-001',
    poNumber: 'PO-MY-001',
    productLabel: 'Ghế J55',
    warehouseName: 'Kho Nghĩa',
    quantity: 30,
    by: 'Đan Trưởng Hà',
    note: 'Nhập đan về kho thành phẩm',
  },
  {
    id: 2,
    receivedDate: ISO('2026-06-15'),
    pointCode: 'DD-B',
    pointName: 'Chị Hà',
    pieceName: 'Mặt ghế',
    pieceCode: 'MAT-GHE',
    piCode: 'PI-2026-001',
    poNumber: 'PO-MY-001',
    productLabel: 'Ghế J55',
    warehouseName: 'Kho Nghĩa',
    quantity: 25,
    by: 'Đan Trưởng Hà',
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
  {
    id: 1,
    type: 'IMPORT',
    quantity: 50,
    date: ISO('2026-06-15'),
    refCode: 'LMH-2026-001',
    warehouseId: 2,
    item: { name: 'Ống sắt 25×25', unit: 'cây' },
    createdBy: { name: 'Kho Minh' },
    note: 'Nhập từ lệnh mua hàng',
  },
  {
    id: 2,
    type: 'EXPORT',
    quantity: 10,
    date: ISO('2026-06-18'),
    warehouseId: 2,
    item: { name: 'Ống sắt 25×25', unit: 'cây' },
    createdBy: { name: 'Kho Minh' },
    exportPurpose: { id: 1, label: 'Xuất sản xuất' },
    note: 'Xuất cho PI-2026-001',
  },
  {
    id: 3,
    type: 'IMPORT',
    quantity: 200,
    date: ISO('2026-06-10'),
    refCode: 'LMH-2026-001',
    warehouseId: 1,
    item: { name: 'Tán M6×12', unit: 'cái' },
    createdBy: { name: 'Kho phụ kiện' },
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

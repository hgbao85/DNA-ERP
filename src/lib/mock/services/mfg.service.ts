import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';

const clone = <T>(v: T): T => structuredClone(v);
const ok = async <T>(v: T) => { await mockDelay(); return v; };

// Export customers
export const getMfgExportCustomers = () => ok(clone(mockStore.get().mfgExportCustomers));
export const createMfgExportCustomer = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), ...data };
  mockStore.update((s) => s.mfgExportCustomers.push(row as never));
  return row;
};
export const updateMfgExportCustomer = async (id: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.mfgExportCustomers.findIndex((c) => c.id === id);
    if (i >= 0) s.mfgExportCustomers[i] = { ...s.mfgExportCustomers[i], ...data } as never;
  });
  return mockStore.get().mfgExportCustomers.find((c) => c.id === id);
};

// Products
export const getMfgProducts = () => ok(clone(mockStore.get().mfgProducts));
export const getMfgProductVariants = (productId: number) =>
  ok(clone(mockStore.get().productVariants.filter((v) => v.mfgProductId === productId)));
export const getAllProductVariants = () => {
  const s = mockStore.get();
  return ok(clone(s.productVariants).map((v: any) => ({
    ...v,
    exportCustomer: s.mfgExportCustomers.find((c: any) => c.id === v.exportCustomerId) ?? null,
  })));
};
export const createMfgProduct = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), ...data };
  mockStore.update((s) => s.mfgProducts.push(row as never));
  return row;
};
export const createProductVariant = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), isActive: true, ...data };
  mockStore.update((s) => s.productVariants.push(row as never));
  return row;
};

// Materials
export const getMaterialGroups = () => ok(clone(mockStore.get().materialGroups));
export const createMaterialGroup = async (name: string) => {
  await mockDelay();
  const row = { id: nextId(), name };
  mockStore.update((s) => s.materialGroups.push(row));
  return row;
};
export const getMaterials = () => ok(clone(mockStore.get().materials));
export const createMaterial = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), ...data };
  mockStore.update((s) => s.materials.push(row as never));
  return row;
};
export const updateMaterial = async (id: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.materials.findIndex((m) => m.id === id);
    if (i >= 0) s.materials[i] = { ...s.materials[i], ...data } as never;
  });
  return mockStore.get().materials.find((m) => m.id === id);
};

// BOM
export const getFrameProducts = () => ok(clone(mockStore.get().frameProducts));
export const getFramePieces = (productId: number) =>
  ok(clone(mockStore.get().framePieces.filter((f) => f.productId === productId)));
export const createFramePiece = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), materials: [], ...data };
  mockStore.update((s) => s.framePieces.push(row as never));
  return row;
};
export const updateFramePiece = async (id: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.framePieces.findIndex((f) => f.id === id);
    if (i >= 0) s.framePieces[i] = { ...s.framePieces[i], ...data } as never;
  });
  return mockStore.get().framePieces.find((f) => f.id === id);
};
export const deleteFramePiece = async (id: number) => {
  await mockDelay();
  mockStore.update((s) => { s.framePieces = s.framePieces.filter((f) => f.id !== id); });
  return { id };
};
export const getPILaborCost = (piId: number) => {
  const row = mockStore.get().laborCost[piId];
  return ok(clone(row ?? { total: 0, items: [] }));
};

// Production invoices
export const getProductionInvoices = () => ok(clone(mockStore.get().productionInvoices));
export const getKcsPendingCounts = () => ok(clone(mockStore.get().kcsPending));
export const getProductionInvoice = (id: number) =>
  ok(clone(mockStore.get().productionInvoices.find((p) => p.id === id) ?? mockStore.get().productionInvoices[0]));
export const createProductionInvoice = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), code: `PI-2026-${nextId()}`, status: 'NEW', items: [], stages: [], ...data };
  mockStore.update((s) => s.productionInvoices.unshift(row as never));
  return row;
};
export const updateProductionInvoice = async (id: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.productionInvoices.findIndex((p) => p.id === id);
    if (i >= 0) s.productionInvoices[i] = { ...s.productionInvoices[i], ...data } as never;
  });
  return mockStore.get().productionInvoices.find((p) => p.id === id);
};

// Stages
export const getStagesByPI = (piId: number) => {
  const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
  return ok(clone(pi?.stages ?? []));
};
export const updateStageProgress = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const submitQCResult = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });

const emptyPhoi = (piId: number) => {
  const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
  return {
    piId,
    code: pi?.code ?? `PI-${piId}`,
    poNumber: pi?.exportOrder?.poNumber ?? null,
    deadline: pi?.deadline ?? new Date().toISOString(),
    items: (pi?.items ?? []).map((it: { quantity: number; productVariant?: { colorCode?: string; mfgProduct?: { name?: string; factoryCode?: string } } }) => ({
      quantity: it.quantity,
      productName: it.productVariant?.mfgProduct?.name ?? '',
      factoryCode: it.productVariant?.mfgProduct?.factoryCode ?? '',
      colorCode: it.productVariant?.colorCode ?? null,
      description: `${it.productVariant?.mfgProduct?.factoryCode ?? ''} ${it.productVariant?.colorCode ?? ''}`.trim(),
    })),
    pieces: [],
    pendingReports: [],
    failedReports: [],
  };
};

// Phoi
export const getPhoiExecutions = (piId: number) => {
  const row = mockStore.get().phoiExecutions.find((p: { piId: number }) => p.piId === piId);
  return ok(clone(row ?? emptyPhoi(piId)));
};
export const submitPhoiReport = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewPhoiReport = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const seedPhoi = (_piId: number) => ok({ ok: true });
export const getPlanningPIs = () => ok(clone(mockStore.get().planningPIs));
export const checkPIMaterials = (piId: number) => {
  const row = mockStore.get().piMaterialChecks[piId];
  if (row) return ok(clone(row));
  const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
  return ok({ piId, status: pi?.status ?? 'PLANNING', shortages: [] });
};
export const startProducingPI = async (piId: number) => {
  await mockDelay();
  mockStore.update((s) => {
    const pi = s.productionInvoices.find((p) => p.id === piId);
    if (pi) pi.status = 'PRODUCING';
  });
  return { id: piId, status: 'PRODUCING' };
};
export const createProposalFromPI = (_piId: number) => ok({ id: nextId(), code: 'DX-2026-NEW', status: 'PENDING' });

const emptyStageExec = (piId: number, stageType: string) => {
  const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
  return {
    piId,
    code: pi?.code ?? `PI-${piId}`,
    poNumber: pi?.exportOrder?.poNumber ?? null,
    deadline: pi?.deadline ?? new Date().toISOString(),
    stageType,
    items: (pi?.items ?? []).map((it: { quantity: number; productVariant?: { colorCode?: string; mfgProduct?: { name?: string; factoryCode?: string } } }) => ({
      quantity: it.quantity,
      productName: it.productVariant?.mfgProduct?.name ?? '',
      factoryCode: it.productVariant?.mfgProduct?.factoryCode ?? '',
      colorCode: it.productVariant?.colorCode ?? null,
    })),
    pieces: [],
    pats: [],
    piecePercent: 0,
    patPercent: 0,
    hasPat: false,
    pendingReports: [],
    failedReports: [],
  };
};

// Stage exec
export const getStageExec = (piId: number, stageType: string) => {
  const key = `${piId}-${stageType}`;
  const row = mockStore.get().stageExec.find((s: { key: string }) => s.key === key);
  if (row) {
    const { key: _k, ...rest } = row as { key: string } & Record<string, unknown>;
    return ok(clone(rest));
  }
  return ok(emptyStageExec(piId, stageType));
};
export const submitStageReport = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewStageReport = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });

// Defect reasons
export const getDefectReasons = (stageType?: string) => {
  const all = mockStore.get().defectReasons;
  return ok(clone(stageType ? all.filter((d) => d.stageType === stageType) : all));
};
export const createDefectReason = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), ...data };
  mockStore.update((s) => s.defectReasons.push(row as never));
  return row;
};
export const updateDefectReason = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deleteDefectReason = async (id: number) => ok({ id });

// Packaging
export const getPackagingBOM = (variantId: number) =>
  ok(clone(mockStore.get().packagingBOM.filter((b: { productVariantId: number }) => b.productVariantId === variantId)));
export const createPackagingBOMItem = async (data: Record<string, unknown>) => ok({ id: nextId(), ...data });
export const updatePackagingBOMItem = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deletePackagingBOMItem = async (id: number) => ok({ id });
export const getPackagingByPI = (piId: number) => ok(clone(mockStore.get().packagingByPI[piId] ?? []));
export const generatePackagingFromBOM = (_piId: number) => ok([]);
export const addManualPackaging = async (_piId: number, data: Record<string, unknown>) => ok({ id: nextId(), ...data });
export const updatePackagingReceived = async (id: number, qtyReceived: number) => ok({ id, qtyReceived });
export const deletePackagingItem = async (id: number) => ok({ id });

// Export orders
export const getExportOrders = () => ok(clone(mockStore.get().exportOrders));
export const getExportOrder = (id: number) =>
  ok(clone(mockStore.get().exportOrders.find((o) => o.id === id)));
export const createExportOrder = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = {
    id: nextId(),
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    items: [],
    createdAt: new Date().toISOString(),
    ...data,
  };
  mockStore.update((s) => s.exportOrders.unshift(row as never));
  return row;
};
export const deleteExportOrder = async (id: number) => {
  await mockDelay();
  mockStore.update((s) => { s.exportOrders = s.exportOrders.filter((o) => o.id !== id); });
  return { id };
};
export const confirmExportOrder = async (id: number, _data?: unknown) => {
  await mockDelay();
  mockStore.update((s) => {
    const o = s.exportOrders.find((x) => x.id === id);
    if (o) o.status = 'PLANNED';
  });
  return { id, status: 'PLANNED' };
};
export const getExportOrderTimeline = (id: number) => {
  const o = mockStore.get().exportOrders.find((x) => x.id === id);
  return ok({
    poNumber: o?.poNumber ?? 'PO-???',
    deliveryDate: o?.deliveryDate ?? new Date().toISOString(),
    steps: [
      { key: 'MATERIAL', label: 'Vật tư', deadline: '2026-06-01' },
      { key: 'PHOI', label: 'Phôi', startDate: '2026-06-02', deadline: '2026-06-10' },
      { key: 'DELIVERY', label: 'Giao hàng', deadline: o?.deliveryDate },
    ],
  });
};
export const updateOrderPayment = async (id: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const o = s.exportOrders.find((x) => x.id === id);
    if (o) Object.assign(o, data);
  });
  return mockStore.get().exportOrders.find((o) => o.id === id);
};
export const uploadContractFile = async (file: File) => {
  await mockDelay();
  return URL.createObjectURL(file);
};

// Warehouses
export const getMfgWarehouses = () => {
  const s = mockStore.get();
  const warehouses = clone(s.mfgWarehouses).map((wh: any) => {
    const items = s.mfgWarehouseItems.filter((i: any) => i.warehouseId === wh.id);
    return {
      ...wh,
      _count: { items: items.length },
      totalQty: items.reduce((sum: number, i: any) => sum + (i.quantity ?? 0), 0),
    };
  });
  return ok(warehouses);
};
export const createMfgWarehouse = async (data: Record<string, unknown>) => ok({ id: nextId(), ...data });
export const updateMfgWarehouse = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deleteMfgWarehouse = async (id: number) => ok({ id });
export const getMfgWarehouseItems = (warehouseId: number, search?: string) => {
  let items = mockStore.get().mfgWarehouseItems.filter((i) => i.warehouseId === warehouseId);
  if (search) items = items.filter((i) => i.name?.includes(search));
  return ok(clone(items));
};
export const getAllMfgWarehouseItems = (search?: string) => {
  let items = mockStore.get().mfgWarehouseItems;
  if (search) items = items.filter((i) => i.name?.includes(search));
  return ok(clone(items));
};
export const createMfgWarehouseItem = async (_warehouseId: number, data: Record<string, unknown>) =>
  ok({ id: nextId(), quantity: 0, ...data });
export const updateMfgWarehouseItem = async (itemId: number, data: Record<string, unknown>) => ok({ id: itemId, ...data });
export const deleteMfgWarehouseItem = async (id: number) => ok({ id });
export const importMfgStock = async (data: Record<string, unknown>) => ok({ ok: true, ...data });
export const exportMfgStock = async (data: Record<string, unknown>) => ok({ ok: true, ...data });
export const getMfgWarehouseTxns = (warehouseId?: number) => {
  let txns = mockStore.get().mfgWarehouseTxns;
  if (warehouseId != null) txns = txns.filter((t: { warehouseId?: number }) => t.warehouseId === warehouseId);
  return ok(clone(txns));
};

// Export purposes
export const getExportPurposes = () => ok(clone(mockStore.get().exportPurposes));
export const createExportPurpose = async (label: string) => {
  await mockDelay();
  const row = { id: nextId(), label };
  mockStore.update((s) => s.exportPurposes.push(row));
  return row;
};

// Purchase proposals
export const getPurchaseProposals = () => ok(clone(mockStore.get().purchaseProposals));
export const createPurchaseProposal = async (data: Record<string, unknown>) =>
  ok({ id: nextId(), code: 'DX-2026-NEW', status: 'PENDING', ...data });
export const reviewPurchaseProposal = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deletePurchaseProposal = async (id: number) => ok({ id });

// Weaving
export const getWeavingPoints = (_all?: boolean) => ok(clone(mockStore.get().weavingPoints));
export const createWeavingPoint = async (data: Record<string, unknown>) => ok({ id: nextId(), isActive: true, ...data });
export const updateWeavingPoint = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const deleteWeavingPoint = async (id: number) => ok({ id });
export const getWeavingConfig = () => ok(clone(mockStore.get().weavingConfig));
export const updateWeavingConfig = async (minAllocationQty: number) => {
  await mockDelay();
  mockStore.update((s) => { s.weavingConfig.minAllocationQty = minAllocationQty; });
  return mockStore.get().weavingConfig;
};
export const getFinishedFrames = () => ok(clone(mockStore.get().weavingFinishedFrames));
export const getWeavingByPoint = () => ok(clone(mockStore.get().weavingByPoint));
export const getWeavingManhSummary = () => ok(clone(mockStore.get().weavingManhSummary));
export const getWeavingReceiptHistory = () => ok(clone(mockStore.get().weavingReceiptHistory));
export const getWeavingAllocation = (piId: number) => {
  const row = mockStore.get().weavingAllocation.find((a: { piId: number }) => a.piId === piId);
  return ok(clone(row ?? { piId, code: `PI-${piId}`, poNumber: null, productLabel: '', minAllocationQty: 50, pieces: [] }));
};
export const allocateWeaving = async (data: Record<string, unknown>) => ok({ id: nextId(), ...data });
export const allocateWeavingBulk = async (data: Record<string, unknown>) => ok(data);
export const removeWeavingAllocation = async (id: number) => ok({ id });
export const getWeavingReceivePending = () => ok(clone(mockStore.get().weavingReceivePending));
export const receiveWeaving = async (data: Record<string, unknown>) => ok({ ok: true, ...data });
export const getWeavingByWarehouse = () => ok(clone(mockStore.get().weavingByWarehouse));
export const getChuyenKiem = () => ok(clone(mockStore.get().chuyenKiem));
export const reportChuyenKiem = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewChuyenKiem = async (reportId: number, data: Record<string, unknown>) => ok({ reportId, ...data });

// Packing
export const getPacking = () => ok(clone(mockStore.get().packing));
export const reportPacking = async (data: Record<string, unknown>) => ok({ id: nextId(), ...data });

// Spec Entry Proposals - Đề xuất nhập định mức
export const getSpecEntryProposals = () => ok(clone(mockStore.get().specEntryProposals));
export const getSpecEntryProposal = (id: number) =>
  ok(clone(mockStore.get().specEntryProposals.find((p: { id: number }) => p.id === id) ?? null));
export const createSpecEntryProposal = async (data: Record<string, unknown>) => {
  await mockDelay();
  const row = { id: nextId(), code: `DEF-2026-${nextId()}`, status: 'PROPOSED', tasks: [], createdAt: new Date().toISOString(), ...data };
  mockStore.update((s) => s.specEntryProposals.unshift(row as never));
  return row;
};
export const updateSpecEntryProposal = async (id: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const i = s.specEntryProposals.findIndex((p: { id: number }) => p.id === id);
    if (i >= 0) s.specEntryProposals[i] = { ...s.specEntryProposals[i], ...data } as never;
  });
  return mockStore.get().specEntryProposals.find((p: { id: number }) => p.id === id);
};
export const updateSpecEntryTask = async (proposalId: number, taskId: number, data: Record<string, unknown>) => {
  await mockDelay();
  mockStore.update((s) => {
    const proposal = s.specEntryProposals.find((p: { id: number }) => p.id === proposalId);
    if (proposal && proposal.tasks) {
      const task = proposal.tasks.find((t: { id: number }) => t.id === taskId);
      if (task) Object.assign(task, data);
    }
  });
  const proposal = mockStore.get().specEntryProposals.find((p: { id: number }) => p.id === proposalId);
  return proposal?.tasks?.find((t: { id: number }) => t.id === taskId) ?? null;
};

import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';

const clone = <T>(v: T): T => structuredClone(v);
const ok = async <T>(v: T) => { await mockDelay(); return v; };

// ─── Service classes ──────────────────────────────────────────────────────────

class ExportCustomerService extends BaseService<any> {
  constructor() { super('mfgExportCustomers'); }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.mfgExportCustomers.findIndex((c) => c.id === id);
      if (i >= 0) Object.assign(s.mfgExportCustomers[i], data);
    });
    return mockStore.get().mfgExportCustomers.find((c) => c.id === id);
  }
}

class MfgProductService extends BaseService<any> {
  constructor() { super('mfgProducts'); }

  async getVariantsByProduct(productId: number) {
    return ok(clone(mockStore.get().productVariants.filter((v) => v.mfgProductId === productId)));
  }

  async getAllVariants() {
    const s = mockStore.get();
    return ok(
      clone(s.productVariants).map((v: any) => ({
        ...v,
        exportCustomer: s.mfgExportCustomers.find((c: any) => c.id === v.exportCustomerId) ?? null,
      })),
    );
  }

  async createVariant(data: Record<string, unknown>) {
    await mockDelay();
    const row = { id: nextId(), isActive: true, ...data };
    mockStore.update((s) => (s.productVariants as any[]).push(row));
    return row;
  }
}

class MaterialService extends BaseService<any> {
  constructor() { super('materials'); }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.materials.findIndex((m) => m.id === id);
      if (i >= 0) Object.assign(s.materials[i], data);
    });
    return mockStore.get().materials.find((m) => m.id === id);
  }
}

class MaterialGroupService extends BaseService<any> {
  constructor() { super('materialGroups'); }

  async createGroup(name: string) {
    await mockDelay();
    const row = { id: nextId(), name };
    mockStore.update((s) => s.materialGroups.push(row));
    return row;
  }
}

class FramePieceService extends BaseService<any> {
  constructor() { super('framePieces'); }

  async getFrameProducts() {
    return ok(clone(mockStore.get().frameProducts));
  }

  async getByProduct(productId: number) {
    return ok(clone(mockStore.get().framePieces.filter((f) => f.productId === productId)));
  }

  async create(data: Record<string, unknown>) {
    await mockDelay();
    const row = { id: nextId(), materials: [], ...data };
    mockStore.update((s) => (s.framePieces as any[]).push(row));
    return row;
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.framePieces.findIndex((f) => f.id === id);
      if (i >= 0) Object.assign(s.framePieces[i], data);
    });
    return mockStore.get().framePieces.find((f) => f.id === id);
  }

  async remove(id: number) {
    await mockDelay();
    mockStore.update((s) => { s.framePieces = s.framePieces.filter((f) => f.id !== id); });
    return { id };
  }
}

class ProductionInvoiceService extends BaseService<any> {
  constructor() { super('productionInvoices'); }

  async findById(id: number) {
    const pi = mockStore.get().productionInvoices.find((p) => p.id === id);
    if (!pi) throw new Error(`Lệnh sản xuất #${id} không tồn tại`);
    return ok(clone(pi));
  }

  async create(data: Record<string, unknown>) {
    await mockDelay();
    const row = { id: nextId(), code: `PI-2026-${nextId()}`, status: 'NEW', items: [], stages: [], ...data };
    mockStore.update((s) => (s.productionInvoices as any[]).unshift(row));
    return row;
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.productionInvoices.findIndex((p) => p.id === id);
      if (i >= 0) Object.assign(s.productionInvoices[i], data);
    });
    return mockStore.get().productionInvoices.find((p) => p.id === id);
  }

  async getKcsPendingCounts() {
    return ok(clone(mockStore.get().kcsPending));
  }

  async startProducing(piId: number) {
    await mockDelay();
    mockStore.update((s) => {
      const pi = s.productionInvoices.find((p) => p.id === piId);
      if (pi) pi.status = 'PRODUCING';
    });
    return { id: piId, status: 'PRODUCING' };
  }

  async getStagesByPI(piId: number) {
    const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ok(clone((pi as any)?.stages ?? []));
  }

  async updateStageProgress(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      for (const pi of s.productionInvoices) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stage = ((pi as any).stages as any[])?.find((st: any) => st.id === id);
        if (stage) { Object.assign(stage, data); break; }
      }
    });
    return { id, ...data };
  }

  async submitQCResult(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      for (const pi of s.productionInvoices) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stage = ((pi as any).stages as any[])?.find((st: any) => st.id === id);
        if (stage) { Object.assign(stage, data); break; }
      }
    });
    return { id, ...data };
  }

  async getLaborCost(piId: number) {
    const row = mockStore.get().laborCost[piId];
    return ok(clone(row ?? { total: 0, items: [] }));
  }

  async getPlanningPIs() {
    return ok(clone(mockStore.get().planningPIs));
  }

  async checkMaterials(piId: number) {
    const row = mockStore.get().piMaterialChecks[piId];
    if (row) return ok(clone(row));
    const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
    return ok({ piId, status: pi?.status ?? 'PLANNING', shortages: [] });
  }

  getPhoiExecution(piId: number) {
    const emptyPhoi = () => {
      const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
      return {
        piId,
        code: pi?.code ?? `PI-${piId}`,
        poNumber: pi?.exportOrder?.poNumber ?? null,
        deadline: pi?.deadline ?? new Date().toISOString(),
        items: (pi?.items ?? []).map((it: any) => ({
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
    const row = mockStore.get().phoiExecutions.find((p: { piId: number }) => p.piId === piId);
    return ok(clone(row ?? emptyPhoi()));
  }

  getStageExec(piId: number, stageType: string) {
    const emptyStageExec = () => {
      const pi = mockStore.get().productionInvoices.find((p) => p.id === piId);
      return {
        piId,
        code: pi?.code ?? `PI-${piId}`,
        poNumber: pi?.exportOrder?.poNumber ?? null,
        deadline: pi?.deadline ?? new Date().toISOString(),
        stageType,
        items: (pi?.items ?? []).map((it: any) => ({
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
    const key = `${piId}-${stageType}`;
    const row = mockStore.get().stageExec.find((s: { key: string }) => s.key === key);
    if (row) {
      const { key: _k, ...rest } = row as { key: string } & Record<string, unknown>;
      return ok(clone(rest));
    }
    return ok(emptyStageExec());
  }
}

class ExportOrderService extends BaseService<any> {
  constructor() { super('exportOrders'); }

  async findById(id: number | string): Promise<any> {
    await mockDelay();
    return clone(mockStore.get().exportOrders.find((o) => o.id === id));
  }

  async create(data: Record<string, unknown>) {
    await mockDelay();
    const row = {
      id: nextId(),
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      items: [],
      createdAt: new Date().toISOString(),
      ...data,
    };
    mockStore.update((s) => (s.exportOrders as any[]).unshift(row));
    return row;
  }

  async remove(id: number) {
    await mockDelay();
    mockStore.update((s) => { s.exportOrders = s.exportOrders.filter((o) => o.id !== id); });
    return { id };
  }

  async confirm(id: number) {
    await mockDelay();
    mockStore.update((s) => {
      const o = s.exportOrders.find((x) => x.id === id);
      if (o) o.status = 'PLANNED';
    });
    return { id, status: 'PLANNED' };
  }

  async updatePayment(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const o = s.exportOrders.find((x) => x.id === id);
      if (o) Object.assign(o, data);
    });
    return mockStore.get().exportOrders.find((o) => o.id === id);
  }

  async getTimeline(id: number) {
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
  }

  async uploadContract(_file: File) {
    await mockDelay();
    return `/mock/contract-${Date.now()}.pdf`;
  }
}

class MfgWarehouseService extends BaseService<any> {
  constructor() { super('mfgWarehouses'); }

  async getAll() {
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
  }

  async create(data: Record<string, unknown>) { return ok({ id: nextId(), ...data }); }
  async update(id: number, data: Record<string, unknown>) { return ok({ id, ...data }); }
  async remove(id: number) { return ok({ id }); }

  async getItems(warehouseId: number, search?: string) {
    let items = mockStore.get().mfgWarehouseItems.filter((i) => i.warehouseId === warehouseId);
    if (search) items = items.filter((i) => i.name?.includes(search));
    return ok(clone(items));
  }

  async getAllItems(search?: string) {
    let items = mockStore.get().mfgWarehouseItems;
    if (search) items = items.filter((i) => i.name?.includes(search));
    return ok(clone(items));
  }

  async createItem(_warehouseId: number, data: Record<string, unknown>) {
    return ok({ id: nextId(), quantity: 0, ...data });
  }

  async updateItem(itemId: number, data: Record<string, unknown>) { return ok({ id: itemId, ...data }); }
  async deleteItem(id: number) { return ok({ id }); }

  async importStock(data: Record<string, unknown>) { return ok({ ok: true, ...data }); }
  async exportStock(data: Record<string, unknown>) { return ok({ ok: true, ...data }); }

  async getTransactions(warehouseId?: number) {
    let txns = mockStore.get().mfgWarehouseTxns;
    if (warehouseId != null) txns = txns.filter((t: { warehouseId?: number }) => t.warehouseId === warehouseId);
    return ok(clone(txns));
  }
}

class ExportPurposeService extends BaseService<any> {
  constructor() { super('exportPurposes'); }

  async createWithLabel(label: string) {
    await mockDelay();
    const row = { id: nextId(), label };
    mockStore.update((s) => s.exportPurposes.push(row));
    return row;
  }
}

class WeavingService extends BaseService<any> {
  constructor() { super('weavingPoints'); }

  async getPoints(_all?: boolean) { return ok(clone(mockStore.get().weavingPoints)); }

  async createPoint(data: Record<string, unknown>) {
    await mockDelay();
    const row = { id: nextId(), isActive: true, ...data };
    mockStore.update((s) => (s.weavingPoints as any[]).push(row));
    return row;
  }

  async updatePoint(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.weavingPoints.findIndex((p) => p.id === id);
      if (i >= 0) Object.assign(s.weavingPoints[i], data);
    });
    return mockStore.get().weavingPoints.find((p) => p.id === id);
  }

  async deletePoint(id: number) {
    await mockDelay();
    mockStore.update((s) => { s.weavingPoints = s.weavingPoints.filter((p) => p.id !== id); });
    return { id };
  }

  async getConfig() { return ok(clone(mockStore.get().weavingConfig)); }
  async updateConfig(minAllocationQty: number) {
    await mockDelay();
    mockStore.update((s) => { s.weavingConfig.minAllocationQty = minAllocationQty; });
    return mockStore.get().weavingConfig;
  }

  async getFinishedFrames() { return ok(clone(mockStore.get().weavingFinishedFrames)); }
  async getByPoint() { return ok(clone(mockStore.get().weavingByPoint)); }
  async getManhSummary() { return ok(clone(mockStore.get().weavingManhSummary)); }

  async getAllocation(piId: number) {
    const row = mockStore.get().weavingAllocation.find((a: { piId: number }) => a.piId === piId);
    return ok(clone(row ?? { piId, code: `PI-${piId}`, poNumber: null, productLabel: '', minAllocationQty: 50, pieces: [] }));
  }

  async allocate(data: Record<string, unknown>) { return ok({ id: nextId(), ...data }); }
  async allocateBulk(data: Record<string, unknown>) { return ok(data); }
  async removeAllocation(id: number) { return ok({ id }); }
  async getReceivePending() { return ok(clone(mockStore.get().weavingReceivePending)); }
  async receive(data: Record<string, unknown>) { return ok({ ok: true, ...data }); }
  async getByWarehouse() { return ok(clone(mockStore.get().weavingByWarehouse)); }
  async getChuyenKiem() { return ok(clone(mockStore.get().chuyenKiem)); }
  async reportChuyenKiem(data: Record<string, unknown>) { return ok({ id: nextId(), status: 'PENDING', ...data }); }
  async reviewChuyenKiem(reportId: number, data: Record<string, unknown>) { return ok({ reportId, ...data }); }
}

class DefectReasonService extends BaseService<any> {
  constructor() { super('defectReasons'); }

  async getAll(stageType?: string) {
    const all = mockStore.get().defectReasons;
    return ok(clone(stageType ? all.filter((d) => d.stageType === stageType) : all));
  }

  async create(data: Record<string, unknown>) {
    await mockDelay();
    const row = { id: nextId(), ...data };
    mockStore.update((s) => (s.defectReasons as any[]).push(row));
    return row;
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.defectReasons.findIndex((d) => d.id === id);
      if (i >= 0) Object.assign(s.defectReasons[i], data);
    });
    return mockStore.get().defectReasons.find((d) => d.id === id);
  }

  async remove(id: number) {
    await mockDelay();
    mockStore.update((s) => { s.defectReasons = s.defectReasons.filter((d) => d.id !== id); });
    return { id };
  }
}

class PackagingService extends BaseService<any> {
  constructor() { super('packagingBOM'); }

  async getBOM(variantId: number) {
    return ok(clone(mockStore.get().packagingBOM.filter((b: { productVariantId: number }) => b.productVariantId === variantId)));
  }

  async createBOMItem(data: Record<string, unknown>) { return ok({ id: nextId(), ...data }); }
  async updateBOMItem(id: number, data: Record<string, unknown>) { return ok({ id, ...data }); }
  async deleteBOMItem(id: number) { return ok({ id }); }

  async getByPI(piId: number) { return ok(clone(mockStore.get().packagingByPI[piId] ?? [])); }
  async generateFromBOM(_piId: number) { return ok([]); }
  async addManual(_piId: number, data: Record<string, unknown>) { return ok({ id: nextId(), ...data }); }
  async updateReceived(id: number, qtyReceived: number) { return ok({ id, qtyReceived }); }
  async deleteItem(id: number) { return ok({ id }); }

  async getPacking() { return ok(clone(mockStore.get().packing)); }
  async reportPacking(data: Record<string, unknown>) { return ok({ id: nextId(), ...data }); }
}

class SpecEntryProposalService extends BaseService<any> {
  constructor() { super('specEntryProposals'); }

  async findById(id: number | string): Promise<any> {
    return ok(clone(mockStore.get().specEntryProposals.find((p: { id: number }) => p.id === id) ?? null));
  }

  async create(data: Record<string, unknown>) {
    await mockDelay();
    const row = { id: nextId(), code: `DEF-2026-${nextId()}`, status: 'PROPOSED', tasks: [], createdAt: new Date().toISOString(), ...data };
    mockStore.update((s) => (s.specEntryProposals as any[]).unshift(row));
    return row;
  }

  async update(id: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const i = s.specEntryProposals.findIndex((p: { id: number }) => p.id === id);
      if (i >= 0) Object.assign(s.specEntryProposals[i], data);
    });
    return mockStore.get().specEntryProposals.find((p: { id: number }) => p.id === id);
  }

  async updateTask(proposalId: number, taskId: number, data: Record<string, unknown>) {
    await mockDelay();
    mockStore.update((s) => {
      const proposal = s.specEntryProposals.find((p: { id: number }) => p.id === proposalId);
      if (proposal?.tasks) {
        const task = proposal.tasks.find((t: { id: number }) => t.id === taskId);
        if (task) Object.assign(task, data);
      }
    });
    const proposal = mockStore.get().specEntryProposals.find((p: { id: number }) => p.id === proposalId);
    return proposal?.tasks?.find((t: { id: number }) => t.id === taskId) ?? null;
  }
}

// ─── Service instances (singletons) ──────────────────────────────────────────

const exportCustomerSvc = new ExportCustomerService();
const mfgProductSvc = new MfgProductService();
const materialSvc = new MaterialService();
const materialGroupSvc = new MaterialGroupService();
const framePieceSvc = new FramePieceService();
const piSvc = new ProductionInvoiceService();
const exportOrderSvc = new ExportOrderService();
const warehouseSvc = new MfgWarehouseService();
const exportPurposeSvc = new ExportPurposeService();
const weavingSvc = new WeavingService();
const defectReasonSvc = new DefectReasonService();
const packagingSvc = new PackagingService();
const specEntryProposalSvc = new SpecEntryProposalService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getMfgExportCustomers = () => exportCustomerSvc.getAll();
export const createMfgExportCustomer = (data: Record<string, unknown>) => exportCustomerSvc.create(data);
export const updateMfgExportCustomer = (id: number, data: Record<string, unknown>) => exportCustomerSvc.update(id, data);
export const deleteMfgExportCustomer = (id: number) => exportCustomerSvc.remove(id);

export const getMfgProducts = () => mfgProductSvc.getAll();
export const getMfgProductVariants = (productId: number) => mfgProductSvc.getVariantsByProduct(productId);
export const getAllProductVariants = () => mfgProductSvc.getAllVariants();
export const createMfgProduct = (data: Record<string, unknown>) => mfgProductSvc.create(data);
export const createProductVariant = (data: Record<string, unknown>) => mfgProductSvc.createVariant(data);

export const getMaterialGroups = () => materialGroupSvc.getAll();
export const createMaterialGroup = (name: string) => materialGroupSvc.createGroup(name);
export const updateMaterialGroup = (id: number, data: Record<string, unknown>) => materialGroupSvc.update(id, data);
export const deleteMaterialGroup = (id: number) => materialGroupSvc.remove(id);
export const getMaterials = () => materialSvc.getAll();
export const createMaterial = (data: Record<string, unknown>) => materialSvc.create(data);
export const updateMaterial = (id: number, data: Record<string, unknown>) => materialSvc.update(id, data);
export const deleteMaterial = (id: number) => materialSvc.remove(id);

export const getFrameProducts = () => framePieceSvc.getFrameProducts();
export const getFramePieces = (productId: number) => framePieceSvc.getByProduct(productId);
export const createFramePiece = (data: Record<string, unknown>) => framePieceSvc.create(data);
export const updateFramePiece = (id: number, data: Record<string, unknown>) => framePieceSvc.update(id, data);
export const deleteFramePiece = (id: number) => framePieceSvc.remove(id);
export const getPILaborCost = (piId: number) => piSvc.getLaborCost(piId);

export const getProductionInvoices = () => piSvc.getAll();
export const getKcsPendingCounts = () => piSvc.getKcsPendingCounts();
export const getProductionInvoice = (id: number) => piSvc.findById(id);
export const createProductionInvoice = (data: Record<string, unknown>) => piSvc.create(data);
export const updateProductionInvoice = (id: number, data: Record<string, unknown>) => piSvc.update(id, data);

export const getStagesByPI = (piId: number) => piSvc.getStagesByPI(piId);
export const updateStageProgress = (id: number, data: Record<string, unknown>) => piSvc.updateStageProgress(id, data);
export const submitQCResult = (id: number, data: Record<string, unknown>) => piSvc.submitQCResult(id, data);

export const getPhoiExecutions = (piId: number) => piSvc.getPhoiExecution(piId);
export const submitPhoiReport = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewPhoiReport = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const seedPhoi = (_piId: number) => ok({ ok: true });
export const getPlanningPIs = () => piSvc.getPlanningPIs();
export const checkPIMaterials = (piId: number) => piSvc.checkMaterials(piId);
export const startProducingPI = (piId: number) => piSvc.startProducing(piId);
export const createProposalFromPI = (_piId: number) => ok({ id: nextId(), code: 'DX-2026-NEW', status: 'PENDING' });

export const getStageExec = (piId: number, stageType: string) => piSvc.getStageExec(piId, stageType);
export const submitStageReport = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewStageReport = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });

export const getDefectReasons = (stageType?: string) => defectReasonSvc.getAll(stageType);
export const createDefectReason = (data: Record<string, unknown>) => defectReasonSvc.create(data);
export const updateDefectReason = (id: number, data: Record<string, unknown>) => defectReasonSvc.update(id, data);
export const deleteDefectReason = (id: number) => defectReasonSvc.remove(id);

export const getPackagingBOM = (variantId: number) => packagingSvc.getBOM(variantId);
export const createPackagingBOMItem = (data: Record<string, unknown>) => packagingSvc.createBOMItem(data);
export const updatePackagingBOMItem = (id: number, data: Record<string, unknown>) => packagingSvc.updateBOMItem(id, data);
export const deletePackagingBOMItem = (id: number) => packagingSvc.deleteBOMItem(id);
export const getPackagingByPI = (piId: number) => packagingSvc.getByPI(piId);
export const generatePackagingFromBOM = (_piId: number) => packagingSvc.generateFromBOM(_piId);
export const addManualPackaging = (_piId: number, data: Record<string, unknown>) => packagingSvc.addManual(_piId, data);
export const updatePackagingReceived = (id: number, qtyReceived: number) => packagingSvc.updateReceived(id, qtyReceived);
export const deletePackagingItem = (id: number) => packagingSvc.deleteItem(id);

export const getExportOrders = () => exportOrderSvc.getAll();
export const getExportOrder = (id: number) => exportOrderSvc.findById(id);
export const createExportOrder = (data: Record<string, unknown>) => exportOrderSvc.create(data);
export const deleteExportOrder = (id: number) => exportOrderSvc.remove(id);
export const confirmExportOrder = (id: number, _data?: unknown) => exportOrderSvc.confirm(id);
export const getExportOrderTimeline = (id: number) => exportOrderSvc.getTimeline(id);
export const updateOrderPayment = (id: number, data: Record<string, unknown>) => exportOrderSvc.updatePayment(id, data);
export const uploadContractFile = (file: File) => exportOrderSvc.uploadContract(file);

export const getMfgWarehouses = () => warehouseSvc.getAll();
export const createMfgWarehouse = (data: Record<string, unknown>) => warehouseSvc.create(data);
export const updateMfgWarehouse = (id: number, data: Record<string, unknown>) => warehouseSvc.update(id, data);
export const deleteMfgWarehouse = (id: number) => warehouseSvc.remove(id);
export const getMfgWarehouseItems = (warehouseId: number, search?: string) => warehouseSvc.getItems(warehouseId, search);
export const getAllMfgWarehouseItems = (search?: string) => warehouseSvc.getAllItems(search);
export const createMfgWarehouseItem = (_warehouseId: number, data: Record<string, unknown>) => warehouseSvc.createItem(_warehouseId, data);
export const updateMfgWarehouseItem = (itemId: number, data: Record<string, unknown>) => warehouseSvc.updateItem(itemId, data);
export const deleteMfgWarehouseItem = (id: number) => warehouseSvc.deleteItem(id);
export const importMfgStock = (data: Record<string, unknown>) => warehouseSvc.importStock(data);
export const exportMfgStock = (data: Record<string, unknown>) => warehouseSvc.exportStock(data);
export const getMfgWarehouseTxns = (warehouseId?: number) => warehouseSvc.getTransactions(warehouseId);

export const getExportPurposes = () => exportPurposeSvc.getAll();
export const createExportPurpose = (label: string) => exportPurposeSvc.createWithLabel(label);
export const updateExportPurpose = (id: number, data: Record<string, unknown>) => exportPurposeSvc.update(id, data);
export const deleteExportPurpose = (id: number) => exportPurposeSvc.remove(id);

export const getWeavingPoints = (_all?: boolean) => weavingSvc.getPoints(_all);
export const createWeavingPoint = (data: Record<string, unknown>) => weavingSvc.createPoint(data);
export const updateWeavingPoint = (id: number, data: Record<string, unknown>) => weavingSvc.updatePoint(id, data);
export const deleteWeavingPoint = (id: number) => weavingSvc.deletePoint(id);
export const getWeavingConfig = () => weavingSvc.getConfig();
export const updateWeavingConfig = (minAllocationQty: number) => weavingSvc.updateConfig(minAllocationQty);
export const getFinishedFrames = () => weavingSvc.getFinishedFrames();
export const getWeavingByPoint = () => weavingSvc.getByPoint();
export const getWeavingManhSummary = () => weavingSvc.getManhSummary();
export const getWeavingAllocation = (piId: number) => weavingSvc.getAllocation(piId);
export const allocateWeaving = (data: Record<string, unknown>) => weavingSvc.allocate(data);
export const allocateWeavingBulk = (data: Record<string, unknown>) => weavingSvc.allocateBulk(data);
export const removeWeavingAllocation = (id: number) => weavingSvc.removeAllocation(id);
export const getWeavingReceivePending = () => weavingSvc.getReceivePending();
export const receiveWeaving = (data: Record<string, unknown>) => weavingSvc.receive(data);
export const getWeavingByWarehouse = () => weavingSvc.getByWarehouse();
export const getChuyenKiem = () => weavingSvc.getChuyenKiem();
export const reportChuyenKiem = (data: Record<string, unknown>) => weavingSvc.reportChuyenKiem(data);
export const reviewChuyenKiem = (reportId: number, data: Record<string, unknown>) => weavingSvc.reviewChuyenKiem(reportId, data);

export const getPacking = () => packagingSvc.getPacking();
export const reportPacking = (data: Record<string, unknown>) => packagingSvc.reportPacking(data);

export const getSpecEntryProposals = () => specEntryProposalSvc.getAll();
export const getSpecEntryProposal = (id: number) => specEntryProposalSvc.findById(id);
export const createSpecEntryProposal = (data: Record<string, unknown>) => specEntryProposalSvc.create(data);
export const updateSpecEntryProposal = (id: number, data: Record<string, unknown>) => specEntryProposalSvc.update(id, data);
export const updateSpecEntryTask = (proposalId: number, taskId: number, data: Record<string, unknown>) => specEntryProposalSvc.updateTask(proposalId, taskId, data);

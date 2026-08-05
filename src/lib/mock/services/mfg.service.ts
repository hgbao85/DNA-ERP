import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';

const clone = <T>(v: T): T => structuredClone(v);
const ok = async <T>(v: T) => { await mockDelay(); return v; };

// ─── Service classes ──────────────────────────────────────────────────────────

// ProductionInvoiceService: CHỈ còn phần "thực thi" (Phôi/Hàn/Sơn/KCS demo — stages, labor
// cost, planning, material check) — phần CRUD + duyệt sản xuất theo item (findById/create/
// update/sendItemToQlsx/sendItemToBoss/approveItemByBoss/rejectItem/startProducing) đã thay
// bằng BE thật (services/production-invoices-api.ts). Các hàm còn lại ở đây tiếp tục đọc
// mockStore.productionInvoices (dữ liệu seed cũ) — nằm ngoài phạm vi domain Sales/Production
// Order vừa nối, để dành phase riêng (thực thi Phôi/Hàn/Sơn/KCS).
class ProductionInvoiceService extends BaseService<any> {
  constructor() { super('productionInvoices'); }

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

// Không extends BaseService — collection 'weavingPoints' đã lên BE thật (weaving-points-api.ts),
// class này chỉ còn phần nghiệp vụ phân bổ/nhận đan/chuyển kiểm vẫn mock, không dùng CRUD chung.
class WeavingService {
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

const piSvc = new ProductionInvoiceService();
const warehouseSvc = new MfgWarehouseService();
const exportPurposeSvc = new ExportPurposeService();
const weavingSvc = new WeavingService();
const packagingSvc = new PackagingService();
const specEntryProposalSvc = new SpecEntryProposalService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getPILaborCost = (piId: number) => piSvc.getLaborCost(piId);

export const getKcsPendingCounts = () => piSvc.getKcsPendingCounts();

export const getStagesByPI = (piId: number) => piSvc.getStagesByPI(piId);
export const updateStageProgress = (id: number, data: Record<string, unknown>) => piSvc.updateStageProgress(id, data);
export const submitQCResult = (id: number, data: Record<string, unknown>) => piSvc.submitQCResult(id, data);

export const getPhoiExecutions = (piId: number) => piSvc.getPhoiExecution(piId);
export const submitPhoiReport = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewPhoiReport = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });
export const seedPhoi = (_piId: number) => ok({ ok: true });
export const getPlanningPIs = () => piSvc.getPlanningPIs();
export const checkPIMaterials = (piId: number) => piSvc.checkMaterials(piId);
export const createProposalFromPI = (_piId: number) => ok({ id: nextId(), code: 'DX-2026-NEW', status: 'PENDING' });

export const getStageExec = (piId: number, stageType: string) => piSvc.getStageExec(piId, stageType);
export const submitStageReport = async (data: Record<string, unknown>) => ok({ id: nextId(), status: 'PENDING', ...data });
export const reviewStageReport = async (id: number, data: Record<string, unknown>) => ok({ id, ...data });

export const getPackagingBOM = (variantId: number) => packagingSvc.getBOM(variantId);
export const createPackagingBOMItem = (data: Record<string, unknown>) => packagingSvc.createBOMItem(data);
export const updatePackagingBOMItem = (id: number, data: Record<string, unknown>) => packagingSvc.updateBOMItem(id, data);
export const deletePackagingBOMItem = (id: number) => packagingSvc.deleteBOMItem(id);
export const getPackagingByPI = (piId: number) => packagingSvc.getByPI(piId);
export const generatePackagingFromBOM = (_piId: number) => packagingSvc.generateFromBOM(_piId);
export const addManualPackaging = (_piId: number, data: Record<string, unknown>) => packagingSvc.addManual(_piId, data);
export const updatePackagingReceived = (id: number, qtyReceived: number) => packagingSvc.updateReceived(id, qtyReceived);
export const deletePackagingItem = (id: number) => packagingSvc.deleteItem(id);

// Upload file demo (ảnh KCS, hợp đồng...) — không có backend lưu file thật ở phase này,
// vẫn giữ mock cho mọi nơi cần 1 URL giả (kcsCore.tsx, đính kèm PO...).
export const uploadContractFile = async (_file: File) => {
  await mockDelay();
  return `/mock/contract-${Date.now()}.pdf`;
};

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

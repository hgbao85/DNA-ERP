import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import { BaseService } from '../core/base.service';
import type { CreatePlanFormPayload, ManhRow, MaterialType, PlanForm, PlanFormStatus, QuotaEntryMeta, QuotaReviewStatus } from '../../../types/plan-form';

// ─── Service class ────────────────────────────────────────────────────────────

class PlanFormService extends BaseService<PlanForm> {
  constructor() { super('planForms'); }

  /** SKU mới tạo chưa có định mức nào — 4 account chuyên trách (Sắt/Dây-Sơn/Phụ kiện/Bao bì) sẽ tự nhập sau. */
  private buildEmptyQuota(): NonNullable<PlanForm['quotaManagement']> {
    return {
      id: nextId(),
      materialType: { sat: [], daySon: [], vatTuPhuKien: [], baoBiDongGoi: [] },
    };
  }

  private enrich(pf: PlanForm): PlanForm {
    const s = mockStore.get();
    const exportOrder = s.exportOrders.find((o: any) => o.id === pf.exportOrderId);
    const mfgProduct = s.mfgProducts.find((p: any) => p.id === pf.mfgProductId);
    return {
      ...pf,
      exportOrder: exportOrder
        ? { id: exportOrder.id, poNumber: exportOrder.poNumber, deliveryDate: exportOrder.deliveryDate }
        : pf.exportOrder,
      mfgProduct: mfgProduct
        ? { id: mfgProduct.id, factoryCode: mfgProduct.factoryCode, name: mfgProduct.name }
        : pf.mfgProduct,
      customerName: pf.customerName ?? exportOrder?.exportCustomer?.name ?? null,
      createdBy: pf.createdBy ?? { id: 39, name: 'NV Kế hoạch SX Linh' },
    };
  }

  async getAll(): Promise<PlanForm[]> {
    await mockDelay();
    return mockStore.get().planForms.map((pf) => this.enrich(pf));
  }

  async getOptions() {
    await mockDelay();
    const s = mockStore.get();
    return {
      exportOrders: s.exportOrders.map((o) => ({
        id: o.id,
        poNumber: o.poNumber,
        deliveryDate: o.deliveryDate,
        status: o.status,
      })),
      mfgProducts: s.mfgProducts.map((p) => ({
        id: p.id,
        factoryCode: p.factoryCode,
        name: p.name,
      })),
    };
  }

  async findPlanForm(id: number): Promise<PlanForm> {
    await mockDelay();
    const pf = mockStore.get().planForms.find((p) => p.id === id);
    if (!pf) throw new Error(`PlanForm #${id} not found`);
    return this.enrich(pf);
  }

  async createForm(data: CreatePlanFormPayload): Promise<PlanForm> {
    await mockDelay();
    let created!: PlanForm;
    mockStore.update((s) => {
      const quota = this.buildEmptyQuota();
      created = {
        id: nextId(),
        exportOrderId: data.exportOrderId,
        mfgProductId: data.mfgProductId,
        status: 'WAITING_DETAIL',
        note: data.note,
        customerName: data.customerName ?? null,
        createdAt: new Date().toISOString(),
        createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
        quotaManagement: quota,
      };
      s.planForms.unshift(created);
    });
    return this.enrich(created);
  }

  async propose(data: CreatePlanFormPayload): Promise<PlanForm> {
    const created = await this.createForm(data);
    return this.proposeById(created.id);
  }

  async proposeById(id: number): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      updated = { ...s.planForms[idx], status: 'APPROVED_DETAIL', proposedAt: new Date().toISOString() };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  private async transition(id: number, newStatus: PlanFormStatus): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      updated = { ...s.planForms[idx], status: newStatus };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  async approveDetail(id: number): Promise<PlanForm> { return this.transition(id, 'WAITING_PARTS'); }
  async approveParts(id: number):  Promise<PlanForm> { return this.transition(id, 'APPROVED_PARTS'); }
  /** KHSX gửi danh sách mảnh đã duyệt cho sếp (Giám đốc) phê duyệt lần cuối trước khi bắt đầu sản xuất. */
  async requestBossApproval(id: number): Promise<PlanForm> { return this.transition(id, 'WAITING_BOSS_APPROVAL'); }

  /** Chỉ Sếp (role BOSS) mới được duyệt lần cuối — chặn ở tầng service, không chỉ ẩn nút ở UI. */
  async approveFull(id: number): Promise<PlanForm> {
    this.assertBossRole();
    return this.transition(id, 'APPROVED');
  }

  private assertBossRole(): void {
    const raw = localStorage.getItem('user_info');
    const role = raw ? (JSON.parse(raw) as { role?: string }).role : null;
    if (role !== 'BOSS') throw new Error('Chỉ Giám đốc (Sếp) mới có quyền duyệt bước này');
  }

  /** KHSX từ chối 1+ nhóm định mức chi tiết rồi gửi lại cho bộ phận chuyên trách nhập lại từ đầu. */
  async sendBackDetailQuota(id: number): Promise<PlanForm> { return this.transition(id, 'WAITING_DETAIL'); }
  /** KHSX từ chối danh sách mảnh phôi rồi gửi lại cho account Sắt nhập lại. */
  async sendBackManhQuota(id: number): Promise<PlanForm> { return this.transition(id, 'WAITING_PARTS'); }

  /**
   * 1 trong 4 account chuyên trách (Sắt/Dây-Sơn/Phụ kiện/Bao bì) nhập định mức chi tiết cho nhóm vật tư của mình.
   * Chỉ cần 1 trong 4 nhóm được nhập là đủ để chuyển status WAITING_DETAIL -> APPROVED_DETAIL (chờ KHSX duyệt);
   * không chờ đủ cả 4 nhóm. Các lần nhập sau (sửa lại nhóm đã có) không đổi status đang ở giai đoạn xa hơn.
   */
  async updateDetailQuota<K extends keyof MaterialType>(
    id: number,
    group: K,
    items: MaterialType[K],
    enteredBy: string,
  ): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      const pf = s.planForms[idx];
      const quota = pf.quotaManagement ?? this.buildEmptyQuota();
      const meta: QuotaEntryMeta = { enteredBy, enteredAt: new Date().toISOString() };
      // Nhập lại sau khi bị từ chối coi như đã sửa xong — xóa cờ reviewStatus của nhóm này để KHSX duyệt lại từ đầu.
      const { [group]: _clearedReview, ...restReview } = quota.reviewStatus ?? {};
      updated = {
        ...pf,
        status: pf.status === 'WAITING_DETAIL' ? 'APPROVED_DETAIL' : pf.status,
        quotaManagement: {
          ...quota,
          materialType: { ...quota.materialType, [group]: items },
          entryMeta: { ...quota.entryMeta, [group]: meta },
          reviewStatus: restReview,
        },
      };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  /** KHSX duyệt hoặc từ chối 1 nhóm định mức chi tiết — account chuyên trách sẽ thấy lý do từ chối ở trang nhập của mình. */
  async reviewDetailQuota<K extends keyof MaterialType>(
    id: number,
    group: K,
    status: 'APPROVED' | 'REJECTED',
    reason?: string,
  ): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      const pf = s.planForms[idx];
      const quota = pf.quotaManagement ?? this.buildEmptyQuota();
      const review: QuotaReviewStatus = { status, reason, reviewedAt: new Date().toISOString() };
      updated = {
        ...pf,
        quotaManagement: {
          ...quota,
          reviewStatus: { ...quota.reviewStatus, [group]: review },
        },
      };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  /** Account Sắt nhập danh sách mảnh phôi. Chuyển status WAITING_PARTS -> APPROVED_PARTS (chờ duyệt mảnh). */
  async updateManhQuota(id: number, rows: ManhRow[], enteredBy: string): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      const pf = s.planForms[idx];
      updated = {
        ...pf,
        status: pf.status === 'WAITING_PARTS' ? 'APPROVED_PARTS' : pf.status,
        manhItems: rows,
        manhEntryMeta: { enteredBy, enteredAt: new Date().toISOString() },
        // Nhập lại sau khi bị từ chối coi như đã sửa xong — xóa quyết định cũ để KHSX duyệt lại từ đầu.
        manhReviewStatus: undefined,
      };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  /** KHSX duyệt hoặc từ chối danh sách mảnh phôi — tách biệt khỏi status vì APPROVED_PARTS đã được
   *  set ngay khi account Sắt nhập xong, không phản ánh việc KHSX đã xem/duyệt hay chưa. */
  async reviewManhQuota(id: number, status: 'APPROVED' | 'REJECTED', reason?: string): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      const pf = s.planForms[idx];
      updated = {
        ...pf,
        manhReviewStatus: { status, reason, reviewedAt: new Date().toISOString() },
      };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  async deleteMany(ids: number[]): Promise<void> {
    await mockDelay();
    mockStore.update((s) => {
      s.planForms = s.planForms.filter((p) => !ids.includes(p.id));
    });
  }
}

// ─── Service instance (singleton) ────────────────────────────────────────────

const planFormSvc = new PlanFormService();

// ─── Exports (API công khai, tương thích ngược hoàn toàn) ────────────────────

export const getPlanForms        = ()                          => planFormSvc.getAll();
export const getPlanFormOptions  = ()                          => planFormSvc.getOptions();
export const getPlanForm         = (id: number)                => planFormSvc.findPlanForm(id);
export const createPlanForm      = (data: CreatePlanFormPayload) => planFormSvc.createForm(data);
export const proposePlanForm     = (data: CreatePlanFormPayload) => planFormSvc.propose(data);
export const proposePlanFormById = (id: number)                => planFormSvc.proposeById(id);
export const approveDetailPlanForm = (id: number)              => planFormSvc.approveDetail(id);
export const approvePartsPlanForm  = (id: number)              => planFormSvc.approveParts(id);
export const requestBossApprovalPlanForm = (id: number)        => planFormSvc.requestBossApproval(id);
export const approveFullPlanForm   = (id: number)              => planFormSvc.approveFull(id);
export const sendBackDetailPlanForm = (id: number)             => planFormSvc.sendBackDetailQuota(id);
export const sendBackManhPlanForm   = (id: number)              => planFormSvc.sendBackManhQuota(id);
export const deletePlanForms     = (ids: number[])             => planFormSvc.deleteMany(ids);
export const updatePlanFormDetailQuota = <K extends keyof MaterialType>(id: number, group: K, items: MaterialType[K], enteredBy: string) =>
  planFormSvc.updateDetailQuota(id, group, items, enteredBy);
export const updatePlanFormManhQuota = (id: number, rows: ManhRow[], enteredBy: string) =>
  planFormSvc.updateManhQuota(id, rows, enteredBy);
export const reviewPlanFormDetailQuota = <K extends keyof MaterialType>(id: number, group: K, status: 'APPROVED' | 'REJECTED', reason?: string) =>
  planFormSvc.reviewDetailQuota(id, group, status, reason);
export const reviewPlanFormManhQuota = (id: number, status: 'APPROVED' | 'REJECTED', reason?: string) =>
  planFormSvc.reviewManhQuota(id, status, reason);

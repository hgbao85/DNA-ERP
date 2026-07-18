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

  /** 1 SKU (exportOrderId+mfgProductId) chỉ có đúng 1 PI — tái dùng PI đã có (theo id truyền vào
   *  hoặc theo cùng exportOrderId+SKU), không tạo trùng. Nếu chưa có PI nào thì tạo mới để "Bảng
   *  thống kê" luôn có dữ liệu đúng cho từng SKU. */
  private resolveProductionInvoice(s: { mfgProducts: any[]; productionInvoices: any[]; exportOrders: any[] }, data: CreatePlanFormPayload): { id: number; code: string } {
    const mfgProduct = s.mfgProducts.find((p: any) => p.id === data.mfgProductId);
    let pi: any = data.productionInvoiceId
      ? s.productionInvoices.find((p: any) => p.id === data.productionInvoiceId)
      : s.productionInvoices.find((p: any) =>
          p.exportOrderId === data.exportOrderId &&
          (p.items ?? []).some((it: any) => it.productVariant?.mfgProduct?.factoryCode === mfgProduct?.factoryCode),
        );
    if (!pi) {
      const exportOrder = s.exportOrders.find((o: any) => o.id === data.exportOrderId);
      const orderItem = exportOrder?.items?.find((it: any) => it.productVariant?.mfgProduct?.name === mfgProduct?.name);
      const id = nextId();
      pi = {
        id,
        code: `PI-2026-${id}`,
        status: 'PLANNING',
        deadline: exportOrder?.deliveryDate ?? new Date().toISOString(),
        exportOrderId: data.exportOrderId,
        exportOrder: exportOrder ? { poNumber: exportOrder.poNumber } : undefined,
        items: [{
          quantity: orderItem?.quantity ?? 0,
          productVariant: {
            colorCode: orderItem?.productVariant?.colorCode ?? null,
            mfgProduct: { name: mfgProduct?.name ?? '', factoryCode: mfgProduct?.factoryCode ?? '' },
          },
        }],
        stages: [],
      };
      (s.productionInvoices as any[]).unshift(pi);
    }
    return pi;
  }

  async createForm(data: CreatePlanFormPayload): Promise<PlanForm> {
    await mockDelay();
    let created!: PlanForm;
    mockStore.update((s) => {
      const quota = this.buildEmptyQuota();
      const pi = this.resolveProductionInvoice(s, data);
      created = {
        id: nextId(),
        exportOrderId: data.exportOrderId,
        mfgProductId: data.mfgProductId,
        status: 'WAITING_DETAIL',
        note: data.note,
        customerName: data.customerName ?? null,
        origin: data.origin,
        createdAt: new Date().toISOString(),
        createdBy: { id: 39, name: 'NV Kế hoạch SX Linh' },
        quotaManagement: quota,
        piCode: pi.code,
        productionInvoiceId: pi.id,
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
  /** KHSX gửi danh sách mảnh đã duyệt cho Quản lý sản xuất (QLSX) duyệt trước, trước khi tới sếp. */
  async requestQlsxApproval(id: number): Promise<PlanForm> { return this.transition(id, 'WAITING_QLSX_APPROVAL'); }

  /** QLSX duyệt cục bộ — chưa chuyển status, chỉ mở khóa nút "Gửi sếp duyệt" (xem requestBossApproval). */
  async reviewQlsx(id: number): Promise<PlanForm> {
    this.assertProdMgrRole();
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      const pf = s.planForms[idx];
      updated = { ...pf, qlsxReviewStatus: { status: 'APPROVED', reviewedAt: new Date().toISOString() } };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  /** QLSX gửi cho sếp (Giám đốc) phê duyệt lần cuối trước khi bắt đầu sản xuất. */
  async requestBossApproval(id: number): Promise<PlanForm> {
    this.assertProdMgrRole();
    return this.transition(id, 'WAITING_BOSS_APPROVAL');
  }

  /** Chỉ Sếp (role BOSS) mới được duyệt lần cuối — chặn ở tầng service, không chỉ ẩn nút ở UI. */
  async approveFull(id: number): Promise<PlanForm> {
    this.assertBossRole();
    return this.transition(id, 'APPROVED');
  }

  /** QLSX hoặc Sếp từ chối toàn bộ SKU — trả về bước nhập định mức chi tiết cho các bộ phận chuyên
   *  trách sửa lại. Dữ liệu đã nhập (materialType/manhItems) vẫn giữ nguyên để sửa tiếp, không xóa
   *  trắng. Mỗi nhóm định mức chi tiết ĐÃ CÓ dữ liệu bị đánh dấu REJECTED (kèm lý do) thay vì xóa
   *  trắng cờ duyệt — vì các trang nhập liệu (Spec*Page) suy ra trạng thái "pending" (khóa sửa, đang
   *  chờ KHSX duyệt) chỉ từ việc có dữ liệu + không có quyết định; nếu chỉ xóa reviewStatus mà không
   *  đánh REJECTED, 3 account chuyên trách sẽ bị khóa không sửa lại được dù SKU vừa bị từ chối. Nhóm
   *  chưa từng có dữ liệu thì để trống — tự suy ra "canInput" như bình thường. manhReviewStatus/
   *  qlsxReviewStatus xóa hẳn (không có cơ chế "pending" khóa sửa tương tự ở phía nhập mảnh).
   */
  private async rejectToDetail(id: number, reason?: string): Promise<PlanForm> {
    await mockDelay();
    let updated!: PlanForm;
    mockStore.update((s) => {
      const idx = s.planForms.findIndex((p) => p.id === id);
      if (idx < 0) throw new Error(`PlanForm #${id} not found`);
      const pf = s.planForms[idx];
      const materialType = pf.quotaManagement?.materialType;
      const rejectedEntry: QuotaReviewStatus = { status: 'REJECTED', reason, reviewedAt: new Date().toISOString() };
      const reviewStatus: Partial<Record<keyof MaterialType, QuotaReviewStatus>> = {};
      (['sat', 'daySon', 'vatTuPhuKien', 'baoBiDongGoi'] as (keyof MaterialType)[]).forEach((group) => {
        if (materialType?.[group]?.length) reviewStatus[group] = rejectedEntry;
      });
      updated = {
        ...pf,
        status: 'WAITING_DETAIL',
        quotaManagement: pf.quotaManagement ? { ...pf.quotaManagement, reviewStatus } : pf.quotaManagement,
        manhReviewStatus: undefined,
        qlsxReviewStatus: undefined,
      };
      s.planForms[idx] = updated;
    });
    return this.enrich(updated);
  }

  async rejectByQlsx(id: number, reason?: string): Promise<PlanForm> {
    this.assertProdMgrRole();
    return this.rejectToDetail(id, reason);
  }

  async rejectByBoss(id: number, reason?: string): Promise<PlanForm> {
    this.assertBossRole();
    return this.rejectToDetail(id, reason);
  }

  private assertBossRole(): void {
    const raw = localStorage.getItem('user_info');
    const role = raw ? (JSON.parse(raw) as { role?: string }).role : null;
    if (role !== 'BOSS') throw new Error('Chỉ Giám đốc (Sếp) mới có quyền duyệt bước này');
  }

  /** Chỉ QLSX (mfgRole PRODUCTION_MANAGER) mới được duyệt bước trung gian trước khi gửi sếp. */
  private assertProdMgrRole(): void {
    const raw = localStorage.getItem('user_info');
    const mfgRole = raw ? (JSON.parse(raw) as { mfgRole?: string }).mfgRole : null;
    if (mfgRole !== 'PRODUCTION_MANAGER') throw new Error('Chỉ Quản lý sản xuất mới có quyền duyệt bước này');
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
export const requestQlsxApprovalPlanForm = (id: number)        => planFormSvc.requestQlsxApproval(id);
export const reviewQlsxPlanForm    = (id: number)              => planFormSvc.reviewQlsx(id);
export const requestBossApprovalPlanForm = (id: number)        => planFormSvc.requestBossApproval(id);
export const rejectPlanFormByQlsx  = (id: number, reason?: string) => planFormSvc.rejectByQlsx(id, reason);
export const rejectPlanFormByBoss  = (id: number, reason?: string) => planFormSvc.rejectByBoss(id, reason);
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

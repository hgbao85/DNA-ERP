import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { BaseService } from '../core/base.service';
import type { AuditLogEntry } from '../../../types/admin';

// Không dùng nextId() (bộ đếm số nguyên toàn cục) cho id log: nextId() suy lại "seq" từ giá trị
// lớn nhất của các field `id` KIỂU SỐ trong mockStore mỗi khi bị reset (vd sau reload trang) —
// id dạng "log-N" là chuỗi nên không được nextId() tính vào, dẫn tới khả năng cấp lại đúng N đã
// dùng trước đó (trùng key React) sau khi reload. Timestamp + hậu tố random tránh hoàn toàn việc
// phải phối hợp với bộ đếm dùng chung.
function nextLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

class AuditLogService extends BaseService<AuditLogEntry> {
  constructor() { super('auditLogs'); }

  async record(
    entityType: string,
    entityId: string,
    action: string,
    actorId: number | undefined,
    actorName: string,
    note?: string,
  ): Promise<AuditLogEntry> {
    await mockDelay();
    let created!: AuditLogEntry;
    mockStore.update((s) => {
      created = { id: nextLogId(), entityType, entityId, action, actorId, actorName, at: new Date().toISOString(), note };
      s.auditLogs.push(created);
    });
    return created;
  }

  async listFor(entityType: string, entityId: string): Promise<AuditLogEntry[]> {
    await mockDelay();
    return this.collection()
      .filter((l) => l.entityType === entityType && l.entityId === entityId)
      .sort((a, b) => a.at.localeCompare(b.at));
  }
}

const auditLogSvc = new AuditLogService();

export const logAuditAction = (
  entityType: string,
  entityId: string,
  action: string,
  actorId: number | undefined,
  actorName: string,
  note?: string,
) => auditLogSvc.record(entityType, entityId, action, actorId, actorName, note);
export const getAuditLogsFor = (entityType: string, entityId: string) => auditLogSvc.listFor(entityType, entityId);
export const getAllAuditLogs = () => auditLogSvc.getAll();

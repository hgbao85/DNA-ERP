import { mockDelay } from '../core/delay';
import { mockStore } from '../core/store';
import { nextId } from '../core/id';
import type { SpecRole, SpecLine } from '../../../types/spec-entry';

const clone = <T>(v: T): T => structuredClone(v);
const ok = async <T>(v: T) => { await mockDelay(); return v; };

// ─── Định mức chi tiết theo role (Sắt / Dây-Sơn / Phụ kiện / Bao bì) ─────────
// 1 collection dùng chung cho cả 4 role thay vì mỗi trang Spec*Page tự giữ mock data riêng.

export const getSpecBoms = () => ok(clone(mockStore.get().specBoms));

export const getSpecRoleState = (role: SpecRole) => ok(clone(mockStore.get().specRoleEntries[role]));

export async function addSpecDraftLine(role: SpecRole, bomId: number, line: Omit<SpecLine, 'uid'>) {
  await mockDelay();
  let created!: SpecLine;
  mockStore.update((s) => {
    const st = s.specRoleEntries[role];
    created = { uid: nextId(), ...line };
    st.draftsByBom[bomId] = [...(st.draftsByBom[bomId] ?? []), created];
  });
  return created;
}

export async function removeSpecDraftLine(role: SpecRole, bomId: number, uid: number) {
  await mockDelay();
  mockStore.update((s) => {
    const st = s.specRoleEntries[role];
    st.draftsByBom[bomId] = (st.draftsByBom[bomId] ?? []).filter((l) => l.uid !== uid);
  });
  return { uid };
}

export async function submitSpecDrafts(role: SpecRole, bomId: number) {
  await mockDelay();
  mockStore.update((s) => {
    const st = s.specRoleEntries[role];
    const lines = st.draftsByBom[bomId] ?? [];
    if (!lines.length) return;
    st.pendingReqs.push({
      uid: nextId(),
      bomId,
      lines: clone(lines),
      submittedAt: new Date().toLocaleString('vi-VN'),
    });
    st.draftsByBom[bomId] = [];
  });
  return mockStore.get().specRoleEntries[role].pendingReqs.filter((r) => r.bomId === bomId);
}

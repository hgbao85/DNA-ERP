import { tokenStorage } from '../../../services/core/tokenStorage';

/** Đọc role/mfgRole của user đang đăng nhập để chặn thao tác trái quyền ở tầng service — không chỉ ẩn nút ở UI. */
function currentUser(): { role?: string; mfgRole?: string } {
  return tokenStorage.getUser<{ role?: string; mfgRole?: string }>() ?? {};
}

export function assertBossRole(): void {
  if (currentUser().role !== 'BOSS') throw new Error('Chỉ Giám đốc (Sếp) mới có quyền duyệt bước này');
}

/** Chỉ QLSX (mfgRole PRODUCTION_MANAGER) mới được duyệt bước trung gian trước khi gửi sếp. */
export function assertProdMgrRole(): void {
  if (currentUser().mfgRole !== 'PRODUCTION_MANAGER') throw new Error('Chỉ Quản lý sản xuất mới có quyền duyệt bước này');
}

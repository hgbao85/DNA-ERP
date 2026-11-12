import { useAuth } from '../context/AuthContext';

/**
 * Phạm vi xưởng của user đang đăng nhập (QLSX theo xưởng, 2026-11-12).
 * `workshopId` null = không giới hạn (KHSX / Sếp / Admin / QLSX chưa gắn xưởng) -
 * cũng là giá trị khi BE cũ chưa trả trường này.
 */
export function useScopedWorkshop(): { scopedWorkshopId: string | null; scopedWorkshopName: string | null } {
  const { user } = useAuth();
  return { scopedWorkshopId: user?.workshopId ?? null, scopedWorkshopName: user?.workshopName ?? null };
}

import { beforeEach, describe, expect, it, vi } from 'vitest';

// 2026-09-25: notifications-api.ts đổi hẳn shape (fan-out theo người nhận thay vì broadcast theo
// audience) - test này thay cho việc không có test nào trước đó, phủ đúng phần dễ vỡ nhất: mapping
// Be*->Fe* (đặc biệt `audience: null` cho category khác ANNOUNCEMENT) và query string dựng đúng.
vi.mock('./core/http', () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

import { http } from './core/http';
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
  createNotification,
  getSentAnnouncements,
} from './notifications-api';

const get = http.get as ReturnType<typeof vi.fn>;
const post = http.post as ReturnType<typeof vi.fn>;

function beNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notif-1',
    type: 'CUTTING_PROPOSAL_NEEDS_MANUAL_APPROVAL',
    category: 'ACTION_REQUIRED',
    severity: 'WARNING',
    title: 'Đề xuất cắt sắt cho PO-31 đã tính xong - CẦN DUYỆT TAY',
    message: 'Hệ thống không tự duyệt vì...',
    entityType: 'CUTTING_PROPOSAL',
    entityId: '123',
    link: { module: 'production_plan', page: 'lenh-sx', params: { proposalId: '123' } },
    data: { poNumber: 'PO-31' },
    actorId: null,
    audience: null,
    createdBy: null,
    createdAt: '2026-09-25T00:00:00.000Z',
    isRead: false,
    isResolved: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getNotifications', () => {
  it('mặc định gửi page=1&limit=100, không kèm status/category khi không truyền', async () => {
    get.mockResolvedValue({ data: [beNotification()], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });

    const result = await getNotifications();

    expect(get).toHaveBeenCalledWith('/notifications?limit=100&page=1');
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('kèm status + category khi được truyền', async () => {
    get.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } });

    await getNotifications({ status: 'unread', category: 'ACTION_REQUIRED', page: 2, limit: 20 });

    expect(get).toHaveBeenCalledWith('/notifications?limit=20&page=2&status=unread&category=ACTION_REQUIRED');
  });

  it('kèm resolved khi được truyền - KHÁC status (xem "Cần xử lý" của NotificationCenter dùng resolved, không dùng status)', async () => {
    get.mockResolvedValue({ data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 1 } });

    await getNotifications({ resolved: 'false', category: 'ACTION_REQUIRED', limit: 50 });

    expect(get).toHaveBeenCalledWith('/notifications?limit=50&page=1&resolved=false&category=ACTION_REQUIRED');
  });

  it('audience null (mọi thông báo sự kiện, khác ANNOUNCEMENT) map về null - KHÔNG throw vì thiếu khoá trong toFeAudience', async () => {
    get.mockResolvedValue({ data: [beNotification({ audience: null })], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });

    const result = await getNotifications();

    expect(result.data[0].audience).toBeNull();
  });

  it('audience có giá trị (ANNOUNCEMENT) map đúng sang chữ thường snake_case của FE', async () => {
    get.mockResolvedValue({
      data: [beNotification({ category: 'ANNOUNCEMENT', audience: 'WAREHOUSE_STAFF' })],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    const result = await getNotifications();

    expect(result.data[0].audience).toBe('warehouse_staff');
  });

  it('giữ nguyên link/entityType/entityId/isResolved từ BE (NotificationCenter cần để điều hướng + làm mờ)', async () => {
    get.mockResolvedValue({ data: [beNotification({ isResolved: true })], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } });

    const result = await getNotifications();

    expect(result.data[0].link).toEqual({ module: 'production_plan', page: 'lenh-sx', params: { proposalId: '123' } });
    expect(result.data[0].entityType).toBe('CUTTING_PROPOSAL');
    expect(result.data[0].entityId).toBe('123');
    expect(result.data[0].isResolved).toBe(true);
  });
});

describe('getUnreadCount', () => {
  it('gọi đúng endpoint và trả thẳng kết quả (không cần map)', async () => {
    get.mockResolvedValue({ total: 3, byCategory: { ACTION_REQUIRED: 2, ALERT: 1 } });

    const result = await getUnreadCount();

    expect(get).toHaveBeenCalledWith('/notifications/unread-count');
    expect(result).toEqual({ total: 3, byCategory: { ACTION_REQUIRED: 2, ALERT: 1 } });
  });
});

describe('markNotificationRead', () => {
  it('POST đúng path và trả về thông báo đã map isRead=true', async () => {
    post.mockResolvedValue(beNotification({ isRead: true }));

    const result = await markNotificationRead('notif-1');

    expect(post).toHaveBeenCalledWith('/notifications/notif-1/read', {});
    expect(result.isRead).toBe(true);
  });
});

describe('markAllNotificationsRead', () => {
  it('không kèm query khi không truyền category', async () => {
    post.mockResolvedValue({ count: 5 });

    const result = await markAllNotificationsRead();

    expect(post).toHaveBeenCalledWith('/notifications/read-all', {});
    expect(result).toEqual({ count: 5 });
  });

  it('kèm ?category= khi có truyền', async () => {
    post.mockResolvedValue({ count: 2 });

    await markAllNotificationsRead('ACTION_REQUIRED');

    expect(post).toHaveBeenCalledWith('/notifications/read-all?category=ACTION_REQUIRED', {});
  });
});

describe('archiveNotification', () => {
  it('POST đúng path :id/archive', async () => {
    post.mockResolvedValue(undefined);

    await archiveNotification('notif-1');

    expect(post).toHaveBeenCalledWith('/notifications/notif-1/archive', {});
  });
});

describe('createNotification', () => {
  it('dịch audience FE (chữ thường) sang BE (chữ hoa) và bỏ qua createdBy gửi lên', async () => {
    post.mockResolvedValue(beNotification({ category: 'ANNOUNCEMENT', audience: 'BOSS' }));

    await createNotification({ title: 'x', message: 'y', audience: 'boss', createdBy: 'should-be-ignored' });

    expect(post).toHaveBeenCalledWith('/notifications', { title: 'x', message: 'y', audience: 'BOSS' });
  });

  it('audience không hợp lệ/rỗng fallback về ALL - không gửi undefined lên BE', async () => {
    post.mockResolvedValue(beNotification({ category: 'ANNOUNCEMENT', audience: 'ALL' }));

    await createNotification({ title: 'x', message: 'y' });

    expect(post).toHaveBeenCalledWith('/notifications', { title: 'x', message: 'y', audience: 'ALL' });
  });
});

describe('getSentAnnouncements', () => {
  it('gọi /notifications/sent với page/limit và map đúng shape Announcement', async () => {
    get.mockResolvedValue({
      data: [{
        id: 'ann-1', title: 'Nghỉ lễ', message: 'Công ty nghỉ lễ', audience: 'ALL',
        createdBy: 'user-boss', createdAt: '2026-09-25T00:00:00.000Z', recipientCount: 10, readCount: 4,
      }],
      meta: { page: 1, limit: 50, total: 1, totalPages: 1 },
    });

    const result = await getSentAnnouncements();

    expect(get).toHaveBeenCalledWith('/notifications/sent?page=1&limit=50');
    expect(result.data[0]).toEqual({
      id: 'ann-1', title: 'Nghỉ lễ', message: 'Công ty nghỉ lễ', audience: 'all',
      createdBy: 'user-boss', createdAt: '2026-09-25T00:00:00.000Z', recipientCount: 10, readCount: 4,
    });
  });
});

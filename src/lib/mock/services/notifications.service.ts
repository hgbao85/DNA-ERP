import { BaseService } from '../core/base.service';
import type { Notification } from '../../../types/admin';

class NotificationsService extends BaseService<Notification> {
  constructor() { super('notifications'); }

  async create(data: Record<string, unknown>): Promise<Notification> {
    return super.create(data, { createdAt: new Date().toISOString() });
  }
}

const notificationsSvc = new NotificationsService();

export const updateNotification = (id: number | string, data: Record<string, unknown>) => notificationsSvc.update(id, data);
export const deleteNotification = (id: number | string) => notificationsSvc.remove(id);

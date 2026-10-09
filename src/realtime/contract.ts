/**
 * BẢN SAO phía FE của hợp đồng realtime. Nguồn sự thật là
 * D:\DNA-ERP-BE\src\realtime\realtime.contract.ts - KHI ĐỔI tên event/payload BE, sửa file này
 * cùng lúc. Chỉ giữ phần FE thật sự dùng (không có REALTIME_ENTITY_ROUTES: topic đã đi kèm trong
 * payload `entity.changed`, FE không tự map lại).
 */

export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: 'notification.created',
  ENTITY_CHANGED: 'entity.changed',
  NOTIFICATION_CHANGED: 'notification.changed',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export type RealtimeEntity =
  | 'WAREHOUSE_TRANSFER'
  | 'PURCHASE_PROPOSAL'
  | 'STEEL_ISSUE'
  | 'PRODUCTION_BATCH'
  | 'QC_REVIEW'
  | 'MATERIAL_ISSUE'
  | 'PACKAGING_ISSUE'
  | 'MATERIAL_YIELD_ISSUE'
  | 'WEAVING_ISSUE'
  | 'STOCK'
  | 'PRODUCTION_INVOICE'
  | 'CUTTING_PROPOSAL'
  | 'SALES_ORDER'
  | 'SKU'
  | 'MATERIAL_YIELD_RECIPE'
  | 'PRODUCTION_ORDER';

export type RealtimeEntityAction =
  | 'CREATED'
  | 'CONFIRMED'
  | 'REJECTED'
  | 'APPROVED'
  | 'RECEIVED'
  | 'QC_RECORDED'
  | 'ADJUSTED'
  | 'PROGRESS'
  | 'FINISHED';

export interface RealtimeEnvelope<TPayload> {
  eventId: string;
  name: RealtimeEventName;
  occurredAt: string;
  correlationId: string | null;
  payload: TPayload;
}

export interface NotificationCreatedPayload {
  notificationId: string;
  type: string | null;
  category: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  link: unknown;
  entityType: string | null;
  entityId: string | null;
  merged: boolean;
  createdAt: string;
}

export interface EntityChangedPayload {
  entity: RealtimeEntity;
  entityId: string;
  action: RealtimeEntityAction;
  topics: string[];
}

export interface NotificationChangedPayload {
  action: 'READ' | 'READ_ALL' | 'ARCHIVED' | 'RESOLVED';
  notificationIds: string[];
}

export interface RealtimeEventMap {
  [REALTIME_EVENTS.NOTIFICATION_CREATED]: NotificationCreatedPayload;
  [REALTIME_EVENTS.ENTITY_CHANGED]: EntityChangedPayload;
  [REALTIME_EVENTS.NOTIFICATION_CHANGED]: NotificationChangedPayload;
}

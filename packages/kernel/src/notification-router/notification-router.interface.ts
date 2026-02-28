/** K10 — Notification Router interface (Phase 1) */

import type { Sql } from 'postgres';
import type {
  NotificationChannel,
  NotificationTemplate,
  Notification,
  NotificationPreference,
  CreateChannelInput,
  UpdateChannelInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  SendNotificationInput,
  UpdatePreferenceInput,
} from './notification-router.types.js';

export interface INotificationRouter {
  // ─── Channels ───
  createChannel(sql: Sql, tenantId: string, userId: string, input: CreateChannelInput): Promise<NotificationChannel>;
  getChannel(sql: Sql, id: string): Promise<NotificationChannel | null>;
  listChannels(sql: Sql, tenantId: string, channelType?: string): Promise<NotificationChannel[]>;
  updateChannel(sql: Sql, id: string, input: UpdateChannelInput): Promise<NotificationChannel>;
  deleteChannel(sql: Sql, id: string): Promise<void>;

  // ─── Templates ───
  createTemplate(sql: Sql, tenantId: string, userId: string, input: CreateTemplateInput): Promise<NotificationTemplate>;
  getTemplate(sql: Sql, id: string): Promise<NotificationTemplate | null>;
  listTemplates(sql: Sql, tenantId: string, channelType?: string): Promise<NotificationTemplate[]>;
  updateTemplate(sql: Sql, id: string, input: UpdateTemplateInput): Promise<NotificationTemplate>;
  deleteTemplate(sql: Sql, id: string): Promise<void>;

  // ─── Notifications ───
  send(sql: Sql, tenantId: string, userId: string, input: SendNotificationInput): Promise<Notification>;
  getNotification(sql: Sql, id: string): Promise<Notification | null>;
  listNotifications(sql: Sql, tenantId: string, recipientId?: string): Promise<Notification[]>;
  markAs(sql: Sql, id: string, status: 'delivered' | 'failed'): Promise<Notification>;

  // ─── Preferences ───
  getPreferences(sql: Sql, tenantId: string, userId: string): Promise<NotificationPreference[]>;
  upsertPreference(sql: Sql, tenantId: string, userId: string, input: UpdatePreferenceInput): Promise<NotificationPreference>;
}

/** K10 — Notification Router service (Phase 1) */

import type { Sql } from 'postgres';
import { randomUUID } from 'crypto';
import type { INotificationRouter } from './notification-router.interface.js';
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
import { NotFoundError, ConflictError } from '@rasid/shared';

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v ?? '');
}

function toChannel(row: Record<string, unknown>): NotificationChannel {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    channel_type: String(row.channel_type) as NotificationChannel['channel_type'],
    config: (row.config ?? {}) as Record<string, unknown>,
    enabled: Boolean(row.enabled),
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toTemplate(row: Record<string, unknown>): NotificationTemplate {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    name: String(row.name),
    channel_type: String(row.channel_type) as NotificationTemplate['channel_type'],
    subject: String(row.subject),
    body: String(row.body),
    variables: (row.variables ?? []) as string[],
    status: String(row.status) as NotificationTemplate['status'],
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function toNotification(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    channel_type: String(row.channel_type) as Notification['channel_type'],
    template_id: row.template_id ? String(row.template_id) : null,
    recipient_id: String(row.recipient_id),
    subject: String(row.subject),
    body: String(row.body),
    status: String(row.status) as Notification['status'],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    sent_at: row.sent_at ? toIso(row.sent_at) : null,
    created_by: String(row.created_by),
    created_at: toIso(row.created_at),
  };
}

function toPreference(row: Record<string, unknown>): NotificationPreference {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    user_id: String(row.user_id),
    channel_type: String(row.channel_type) as NotificationPreference['channel_type'],
    enabled: Boolean(row.enabled),
    updated_at: toIso(row.updated_at),
  };
}

export class NotificationRouterService implements INotificationRouter {

  // ═══════════════════════════════════════════════
  // ─── Channels ───
  // ═══════════════════════════════════════════════

  async createChannel(sql: Sql, tenantId: string, userId: string, input: CreateChannelInput): Promise<NotificationChannel> {
    const existing = await sql`
      SELECT id FROM kernel.notification_channels WHERE tenant_id = ${tenantId} AND name = ${input.name}
    `;
    if (existing.length > 0) throw new ConflictError(`Channel "${input.name}" already exists`);

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.notification_channels (id, tenant_id, name, channel_type, config, enabled, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.channel_type}, ${JSON.stringify(input.config ?? {})}, ${input.enabled ?? true}, ${userId}, ${now}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert channel');
    return toChannel(row);
  }

  async getChannel(sql: Sql, id: string): Promise<NotificationChannel | null> {
    const rows = await sql`SELECT * FROM kernel.notification_channels WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toChannel(row);
  }

  async listChannels(sql: Sql, _tenantId: string, channelType?: string): Promise<NotificationChannel[]> {
    if (channelType) {
      const rows = await sql`
        SELECT * FROM kernel.notification_channels WHERE channel_type = ${channelType} ORDER BY name ASC
      `;
      return rows.map(toChannel);
    }
    const rows = await sql`SELECT * FROM kernel.notification_channels ORDER BY name ASC`;
    return rows.map(toChannel);
  }

  async updateChannel(sql: Sql, id: string, input: UpdateChannelInput): Promise<NotificationChannel> {
    const existing = await sql`SELECT * FROM kernel.notification_channels WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Channel not found');

    // Check for name conflict if name is being updated
    if (input.name) {
      const tenantId = String(existing[0].tenant_id);
      const conflict = await sql`
        SELECT id FROM kernel.notification_channels WHERE tenant_id = ${tenantId} AND name = ${input.name} AND id != ${id}
      `;
      if (conflict.length > 0) throw new ConflictError(`Channel "${input.name}" already exists`);
    }

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE kernel.notification_channels SET
        name = COALESCE(${input.name ?? null}, name),
        config = COALESCE(${input.config ? JSON.stringify(input.config) : null}::jsonb, config),
        enabled = COALESCE(${input.enabled ?? null}, enabled),
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Channel not found');
    return toChannel(row);
  }

  async deleteChannel(sql: Sql, id: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.notification_channels WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Channel not found');
    await sql`DELETE FROM kernel.notification_channels WHERE id = ${id}`;
  }

  // ═══════════════════════════════════════════════
  // ─── Templates ───
  // ═══════════════════════════════════════════════

  async createTemplate(sql: Sql, tenantId: string, userId: string, input: CreateTemplateInput): Promise<NotificationTemplate> {
    const existing = await sql`
      SELECT id FROM kernel.notification_templates WHERE tenant_id = ${tenantId} AND name = ${input.name}
    `;
    if (existing.length > 0) throw new ConflictError(`Template "${input.name}" already exists`);

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.notification_templates (id, tenant_id, name, channel_type, subject, body, variables, status, created_by, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${input.name}, ${input.channel_type}, ${input.subject}, ${input.body}, ${JSON.stringify(input.variables ?? [])}, 'draft', ${userId}, ${now}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert template');
    return toTemplate(row);
  }

  async getTemplate(sql: Sql, id: string): Promise<NotificationTemplate | null> {
    const rows = await sql`SELECT * FROM kernel.notification_templates WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toTemplate(row);
  }

  async listTemplates(sql: Sql, _tenantId: string, channelType?: string): Promise<NotificationTemplate[]> {
    if (channelType) {
      const rows = await sql`
        SELECT * FROM kernel.notification_templates WHERE channel_type = ${channelType} ORDER BY name ASC
      `;
      return rows.map(toTemplate);
    }
    const rows = await sql`SELECT * FROM kernel.notification_templates ORDER BY name ASC`;
    return rows.map(toTemplate);
  }

  async updateTemplate(sql: Sql, id: string, input: UpdateTemplateInput): Promise<NotificationTemplate> {
    const existing = await sql`SELECT * FROM kernel.notification_templates WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Template not found');

    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE kernel.notification_templates SET
        subject = COALESCE(${input.subject ?? null}, subject),
        body = COALESCE(${input.body ?? null}, body),
        variables = COALESCE(${input.variables ? JSON.stringify(input.variables) : null}::jsonb, variables),
        status = COALESCE(${input.status ?? null}, status),
        updated_at = ${now}
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Template not found');
    return toTemplate(row);
  }

  async deleteTemplate(sql: Sql, id: string): Promise<void> {
    const existing = await sql`SELECT id FROM kernel.notification_templates WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Template not found');
    await sql`DELETE FROM kernel.notification_templates WHERE id = ${id}`;
  }

  // ═══════════════════════════════════════════════
  // ─── Notifications ───
  // ═══════════════════════════════════════════════

  async send(sql: Sql, tenantId: string, userId: string, input: SendNotificationInput): Promise<Notification> {
    // Verify recipient exists within tenant (RLS handles tenant isolation)
    const recipientRows = await sql`SELECT id FROM kernel.users WHERE id = ${input.recipient_id}`;
    if (recipientRows.length === 0) throw new NotFoundError('Recipient not found');

    // If template_id provided, verify it exists
    if (input.template_id) {
      const templateRows = await sql`SELECT id FROM kernel.notification_templates WHERE id = ${input.template_id}`;
      if (templateRows.length === 0) throw new NotFoundError('Template not found');
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO kernel.notifications (id, tenant_id, channel_type, template_id, recipient_id, subject, body, status, metadata, sent_at, created_by, created_at)
      VALUES (${id}, ${tenantId}, ${input.channel_type}, ${input.template_id ?? null}, ${input.recipient_id}, ${input.subject}, ${input.body}, 'pending', ${JSON.stringify(input.metadata ?? {})}, ${now}, ${userId}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert notification');
    return toNotification(row);
  }

  async getNotification(sql: Sql, id: string): Promise<Notification | null> {
    const rows = await sql`SELECT * FROM kernel.notifications WHERE id = ${id}`;
    const row = rows[0];
    if (!row) return null;
    return toNotification(row);
  }

  async listNotifications(sql: Sql, _tenantId: string, recipientId?: string): Promise<Notification[]> {
    if (recipientId) {
      const rows = await sql`
        SELECT * FROM kernel.notifications WHERE recipient_id = ${recipientId} ORDER BY created_at DESC
      `;
      return rows.map(toNotification);
    }
    const rows = await sql`SELECT * FROM kernel.notifications ORDER BY created_at DESC`;
    return rows.map(toNotification);
  }

  async markAs(sql: Sql, id: string, status: 'delivered' | 'failed'): Promise<Notification> {
    const existing = await sql`SELECT * FROM kernel.notifications WHERE id = ${id}`;
    if (existing.length === 0) throw new NotFoundError('Notification not found');

    const sentAt = status === 'delivered' ? new Date().toISOString() : null;
    const rows = await sql`
      UPDATE kernel.notifications SET
        status = ${status},
        sent_at = COALESCE(${sentAt}, sent_at)
      WHERE id = ${id}
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new NotFoundError('Notification not found');
    return toNotification(row);
  }

  // ═══════════════════════════════════════════════
  // ─── Preferences ───
  // ═══════════════════════════════════════════════

  async getPreferences(sql: Sql, _tenantId: string, userId: string): Promise<NotificationPreference[]> {
    const rows = await sql`
      SELECT * FROM kernel.notification_preferences WHERE user_id = ${userId} ORDER BY channel_type ASC
    `;
    return rows.map(toPreference);
  }

  async upsertPreference(sql: Sql, tenantId: string, userId: string, input: UpdatePreferenceInput): Promise<NotificationPreference> {
    const now = new Date().toISOString();

    // Check if preference exists
    const existing = await sql`
      SELECT * FROM kernel.notification_preferences WHERE user_id = ${userId} AND channel_type = ${input.channel_type}
    `;

    if (existing.length > 0) {
      const rows = await sql`
        UPDATE kernel.notification_preferences SET
          enabled = ${input.enabled},
          updated_at = ${now}
        WHERE user_id = ${userId} AND channel_type = ${input.channel_type}
        RETURNING *
      `;
      const row = rows[0];
      if (!row) throw new Error('Failed to update preference');
      return toPreference(row);
    }

    const id = randomUUID();
    const rows = await sql`
      INSERT INTO kernel.notification_preferences (id, tenant_id, user_id, channel_type, enabled, updated_at)
      VALUES (${id}, ${tenantId}, ${userId}, ${input.channel_type}, ${input.enabled}, ${now})
      RETURNING *
    `;
    const row = rows[0];
    if (!row) throw new Error('Failed to insert preference');
    return toPreference(row);
  }
}

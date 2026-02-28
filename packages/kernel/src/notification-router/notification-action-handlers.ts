/** K10 — Notification Router action handlers (routed through K3 pipeline) */

import { actionRegistry } from '../action-registry/action-registry.service.js';
import { NotificationRouterService } from './notification-router.service.js';
import type { ActionManifest, ActionHandler } from '../action-registry/action-registry.types.js';
import type {
  CreateChannelInput,
  UpdateChannelInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  SendNotificationInput,
  UpdatePreferenceInput,
} from './notification-router.types.js';

const service = new NotificationRouterService();

const notificationManifests: Array<{ manifest: ActionManifest; handler: ActionHandler }> = [
  // ─── Channel Actions ───
  {
    manifest: {
      action_id: 'rasid.core.notification.channel.create',
      display_name: 'Create Notification Channel',
      module_id: 'kernel',
      verb: 'create',
      resource: 'notification_channels',
      input_schema: {
        type: 'object',
        required: ['name', 'channel_type'],
        properties: {
          name: { type: 'string' },
          channel_type: { type: 'string' },
          config: { type: 'object' },
          enabled: { type: 'boolean' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_channels.create'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const data = input as CreateChannelInput;
      const channel = await service.createChannel(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: channel,
        object_id: channel.id,
        object_type: 'notification_channel',
        before: null,
        after: channel,
        event_type: 'rasid.core.notification.channel.created',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.notification.channel.update',
      display_name: 'Update Notification Channel',
      module_id: 'kernel',
      verb: 'update',
      resource: 'notification_channels',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          config: { type: 'object' },
          enabled: { type: 'boolean' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_channels.update'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const { id, ...updateData } = input as { id: string } & UpdateChannelInput;
      const before = await service.getChannel(sql, id);
      const channel = await service.updateChannel(sql, id, updateData);
      return {
        data: channel,
        object_id: channel.id,
        object_type: 'notification_channel',
        before,
        after: channel,
        event_type: 'rasid.core.notification.channel.updated',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.notification.channel.delete',
      display_name: 'Delete Notification Channel',
      module_id: 'kernel',
      verb: 'delete',
      resource: 'notification_channels',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_channels.delete'],
      sensitivity: 'medium',
    },
    handler: async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getChannel(sql, id);
      await service.deleteChannel(sql, id);
      return {
        data: { deleted: true },
        object_id: id,
        object_type: 'notification_channel',
        before,
        after: null,
        event_type: 'rasid.core.notification.channel.deleted',
      };
    },
  },

  // ─── Template Actions ───
  {
    manifest: {
      action_id: 'rasid.core.notification.template.create',
      display_name: 'Create Notification Template',
      module_id: 'kernel',
      verb: 'create',
      resource: 'notification_templates',
      input_schema: {
        type: 'object',
        required: ['name', 'channel_type', 'subject', 'body'],
        properties: {
          name: { type: 'string' },
          channel_type: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          variables: { type: 'array' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_templates.create'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const data = input as CreateTemplateInput;
      const template = await service.createTemplate(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: template,
        object_id: template.id,
        object_type: 'notification_template',
        before: null,
        after: template,
        event_type: 'rasid.core.notification.template.created',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.notification.template.update',
      display_name: 'Update Notification Template',
      module_id: 'kernel',
      verb: 'update',
      resource: 'notification_templates',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          variables: { type: 'array' },
          status: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_templates.update'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const { id, ...updateData } = input as { id: string } & UpdateTemplateInput;
      const before = await service.getTemplate(sql, id);
      const template = await service.updateTemplate(sql, id, updateData);
      return {
        data: template,
        object_id: template.id,
        object_type: 'notification_template',
        before,
        after: template,
        event_type: 'rasid.core.notification.template.updated',
      };
    },
  },
  {
    manifest: {
      action_id: 'rasid.core.notification.template.delete',
      display_name: 'Delete Notification Template',
      module_id: 'kernel',
      verb: 'delete',
      resource: 'notification_templates',
      input_schema: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_templates.delete'],
      sensitivity: 'medium',
    },
    handler: async (input, ctx, sql) => {
      const { id } = input as { id: string };
      const before = await service.getTemplate(sql, id);
      await service.deleteTemplate(sql, id);
      return {
        data: { deleted: true },
        object_id: id,
        object_type: 'notification_template',
        before,
        after: null,
        event_type: 'rasid.core.notification.template.deleted',
      };
    },
  },

  // ─── Notification Send Action ───
  {
    manifest: {
      action_id: 'rasid.core.notification.send',
      display_name: 'Send Notification',
      module_id: 'kernel',
      verb: 'create',
      resource: 'notifications',
      input_schema: {
        type: 'object',
        required: ['channel_type', 'recipient_id', 'subject', 'body'],
        properties: {
          channel_type: { type: 'string' },
          template_id: { type: 'string' },
          recipient_id: { type: 'string' },
          subject: { type: 'string' },
          body: { type: 'string' },
          metadata: { type: 'object' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notifications.create'],
      sensitivity: 'medium',
    },
    handler: async (input, ctx, sql) => {
      const data = input as SendNotificationInput;
      const notification = await service.send(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: notification,
        object_id: notification.id,
        object_type: 'notification',
        before: null,
        after: notification,
        event_type: 'rasid.core.notification.sent',
      };
    },
  },

  // ─── Notification Mark Status Action ───
  {
    manifest: {
      action_id: 'rasid.core.notification.mark',
      display_name: 'Mark Notification Status',
      module_id: 'kernel',
      verb: 'update',
      resource: 'notifications',
      input_schema: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notifications.update'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const { id, status } = input as { id: string; status: 'delivered' | 'failed' };
      const before = await service.getNotification(sql, id);
      const notification = await service.markAs(sql, id, status);
      return {
        data: notification,
        object_id: notification.id,
        object_type: 'notification',
        before,
        after: notification,
        event_type: `rasid.core.notification.${status}`,
      };
    },
  },

  // ─── Preference Upsert Action ───
  {
    manifest: {
      action_id: 'rasid.core.notification.preference.upsert',
      display_name: 'Upsert Notification Preference',
      module_id: 'kernel',
      verb: 'update',
      resource: 'notification_preferences',
      input_schema: {
        type: 'object',
        required: ['channel_type', 'enabled'],
        properties: {
          channel_type: { type: 'string' },
          enabled: { type: 'boolean' },
        },
      },
      output_schema: { type: 'object' },
      required_permissions: ['notification_preferences.update'],
      sensitivity: 'low',
    },
    handler: async (input, ctx, sql) => {
      const data = input as UpdatePreferenceInput;
      const preference = await service.upsertPreference(sql, ctx.tenantId, ctx.userId, data);
      return {
        data: preference,
        object_id: preference.id,
        object_type: 'notification_preference',
        before: null,
        after: preference,
        event_type: 'rasid.core.notification.preference.updated',
      };
    },
  },
];

/** Register all notification action handlers */
export function registerNotificationActions(): void {
  for (const { manifest, handler } of notificationManifests) {
    actionRegistry.registerAction(manifest, handler);
  }
}

/** K10 — Notification Router types (Phase 1) */

export type ChannelType = 'email' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';
export type TemplateStatus = 'draft' | 'active' | 'archived';

export interface NotificationChannel {
  id: string;
  tenant_id: string;
  name: string;
  channel_type: ChannelType;
  config: Record<string, unknown>;
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationTemplate {
  id: string;
  tenant_id: string;
  name: string;
  channel_type: ChannelType;
  subject: string;
  body: string;
  variables: string[];
  status: TemplateStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  tenant_id: string;
  channel_type: ChannelType;
  template_id: string | null;
  recipient_id: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  metadata: Record<string, unknown>;
  sent_at: string | null;
  created_by: string;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  tenant_id: string;
  user_id: string;
  channel_type: ChannelType;
  enabled: boolean;
  updated_at: string;
}

// ─── Input types ───

export interface CreateChannelInput {
  name: string;
  channel_type: ChannelType;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateChannelInput {
  name?: string;
  config?: Record<string, unknown>;
  enabled?: boolean;
}

export interface CreateTemplateInput {
  name: string;
  channel_type: ChannelType;
  subject: string;
  body: string;
  variables?: string[];
}

export interface UpdateTemplateInput {
  subject?: string;
  body?: string;
  variables?: string[];
  status?: TemplateStatus;
}

export interface SendNotificationInput {
  channel_type: ChannelType;
  template_id?: string;
  recipient_id: string;
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePreferenceInput {
  channel_type: ChannelType;
  enabled: boolean;
}

import {
  pgSchema,
  uuid,
  varchar,
  boolean,
  integer,
  jsonb,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';

export const kernelSchema = pgSchema('kernel');

// ─── P0.4.1 tenants ───
export const tenants = kernelSchema.table('tenants', {
  id: uuid('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  status: varchar('status', { length: 20 }).notNull().default('active'),
  settings: jsonb('settings').notNull().default('{}'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── P0.4.2 users ───
export const users = kernelSchema.table(
  'users',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    email: varchar('email', { length: 255 }).notNull(),
    password_hash: varchar('password_hash', { length: 255 }).notNull(),
    display_name: varchar('display_name', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('active'),
    last_login_at: timestamp('last_login_at', { withTimezone: true }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('users_tenant_email_idx').on(table.tenant_id, table.email),
    index('users_tenant_status_idx').on(table.tenant_id, table.status),
  ],
);

// ─── P0.4.3 roles ───
export const roles = kernelSchema.table(
  'roles',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    is_system: boolean('is_system').notNull().default(false),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('roles_tenant_name_idx').on(table.tenant_id, table.name),
  ],
);

// ─── P0.4.4 permissions ───
export const permissions = kernelSchema.table(
  'permissions',
  {
    id: uuid('id').primaryKey(),
    resource: varchar('resource', { length: 100 }).notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    description: varchar('description', { length: 500 }),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('permissions_resource_action_idx').on(table.resource, table.action),
  ],
);

// ─── P0.4.5 role_permissions ───
export const rolePermissions = kernelSchema.table(
  'role_permissions',
  {
    role_id: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    permission_id: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
  },
  (table) => [
    primaryKey({ columns: [table.role_id, table.permission_id] }),
  ],
);

// ─── P0.4.6 user_roles ───
export const userRoles = kernelSchema.table(
  'user_roles',
  {
    user_id: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role_id: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    assigned_at: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    assigned_by: uuid('assigned_by').references(() => users.id),
  },
  (table) => [
    primaryKey({ columns: [table.user_id, table.role_id] }),
  ],
);

// ─── P0.4.7 object_types ───
export const objectTypes = kernelSchema.table('object_types', {
  name: varchar('name', { length: 100 }).primaryKey(),
  display_name: varchar('display_name', { length: 255 }).notNull(),
  module_id: varchar('module_id', { length: 100 }).notNull(),
  json_schema: jsonb('json_schema').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── P0.4.8 objects ───
export const objects = kernelSchema.table(
  'objects',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    type: varchar('type', { length: 100 }).notNull(),
    state: varchar('state', { length: 20 }).notNull().default('draft'),
    version: integer('version').notNull().default(1),
    data: jsonb('data').notNull(),
    created_by: uuid('created_by').notNull().references(() => users.id),
    updated_by: uuid('updated_by').references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deleted_at: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('objects_tenant_type_state_idx').on(table.tenant_id, table.type, table.state),
    index('objects_tenant_created_idx').on(table.tenant_id, table.created_at),
  ],
);

// ─── P0.4.9 action_manifests ───
export const actionManifests = kernelSchema.table('action_manifests', {
  action_id: varchar('action_id', { length: 150 }).primaryKey(),
  display_name: varchar('display_name', { length: 255 }).notNull(),
  module_id: varchar('module_id', { length: 100 }).notNull(),
  verb: varchar('verb', { length: 20 }).notNull(),
  resource: varchar('resource', { length: 100 }).notNull(),
  input_schema: jsonb('input_schema').notNull(),
  output_schema: jsonb('output_schema').notNull(),
  required_permissions: jsonb('required_permissions').notNull(),
  sensitivity: varchar('sensitivity', { length: 10 }).notNull().default('low'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── P0.4.10 audit_log ───
export const auditLog = kernelSchema.table(
  'audit_log',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull(), // NO FK — must survive tenant deletion
    actor_id: uuid('actor_id').notNull(),
    actor_type: varchar('actor_type', { length: 20 }).notNull().default('user'),
    action_id: varchar('action_id', { length: 150 }).notNull(),
    object_id: uuid('object_id'),
    object_type: varchar('object_type', { length: 100 }),
    status: varchar('status', { length: 20 }).notNull(),
    payload_before: jsonb('payload_before'),
    payload_after: jsonb('payload_after'),
    error_message: varchar('error_message', { length: 1000 }),
    ip_address: varchar('ip_address', { length: 45 }),
    session_id: uuid('session_id'),
    correlation_id: uuid('correlation_id').notNull(),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_tenant_created_idx').on(table.tenant_id, table.created_at),
    index('audit_tenant_actor_idx').on(table.tenant_id, table.actor_id, table.created_at),
    index('audit_tenant_object_idx').on(table.tenant_id, table.object_id),
    index('audit_tenant_action_idx').on(table.tenant_id, table.action_id, table.created_at),
  ],
);

// ─── K7 lineage_edges (Phase 1) ───
export const lineageEdges = kernelSchema.table(
  'lineage_edges',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    source_id: varchar('source_id', { length: 255 }).notNull(),
    source_type: varchar('source_type', { length: 100 }).notNull(),
    target_id: varchar('target_id', { length: 255 }).notNull(),
    target_type: varchar('target_type', { length: 100 }).notNull(),
    relationship: varchar('relationship', { length: 100 }).notNull(),
    metadata: jsonb('metadata').notNull().default('{}'),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('lineage_edges_unique_idx').on(table.tenant_id, table.source_id, table.target_id, table.relationship),
    index('lineage_edges_source_idx').on(table.tenant_id, table.source_id),
    index('lineage_edges_target_idx').on(table.tenant_id, table.target_id),
  ],
);

// ─── K8 datasets (Phase 1 — Semantic Data Layer) ───
export const datasets = kernelSchema.table(
  'datasets',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    display_name: varchar('display_name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    source_type: varchar('source_type', { length: 20 }).notNull(),
    source_config: jsonb('source_config').notNull().default('{}'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('datasets_tenant_name_idx').on(table.tenant_id, table.name),
    index('datasets_tenant_status_idx').on(table.tenant_id, table.status),
  ],
);

// ─── K8 dataset_fields ───
export const datasetFields = kernelSchema.table(
  'dataset_fields',
  {
    id: uuid('id').primaryKey(),
    dataset_id: uuid('dataset_id').notNull().references(() => datasets.id, { onDelete: 'cascade' }),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    display_name: varchar('display_name', { length: 255 }).notNull(),
    data_type: varchar('data_type', { length: 20 }).notNull(),
    is_dimension: boolean('is_dimension').notNull().default(false),
    is_metric: boolean('is_metric').notNull().default(false),
    expression: varchar('expression', { length: 1000 }),
    description: varchar('description', { length: 1000 }),
    ordinal: integer('ordinal').notNull().default(0),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('dataset_fields_dataset_name_idx').on(table.dataset_id, table.name),
    index('dataset_fields_tenant_idx').on(table.tenant_id),
  ],
);

// ─── K9 design_tokens (Phase 1 — Design System) ───
export const designTokens = kernelSchema.table(
  'design_tokens',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    category: varchar('category', { length: 20 }).notNull(),
    value: varchar('value', { length: 1000 }).notNull(),
    description: varchar('description', { length: 1000 }),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('design_tokens_tenant_name_idx').on(table.tenant_id, table.name),
    index('design_tokens_tenant_category_idx').on(table.tenant_id, table.category),
  ],
);

// ─── K9 design_themes ───
export const designThemes = kernelSchema.table(
  'design_themes',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    display_name: varchar('display_name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    is_default: boolean('is_default').notNull().default(false),
    token_overrides: jsonb('token_overrides').notNull().default('{}'),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('design_themes_tenant_name_idx').on(table.tenant_id, table.name),
    index('design_themes_tenant_status_idx').on(table.tenant_id, table.status),
  ],
);

// ─── K9 design_components ───
export const designComponents = kernelSchema.table(
  'design_components',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    display_name: varchar('display_name', { length: 255 }).notNull(),
    description: varchar('description', { length: 1000 }),
    category: varchar('category', { length: 100 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    variants: jsonb('variants').notNull().default('{}'),
    default_props: jsonb('default_props').notNull().default('{}'),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('design_components_tenant_name_idx').on(table.tenant_id, table.name),
    index('design_components_tenant_category_idx').on(table.tenant_id, table.category),
  ],
);

// ─── K10 notification_channels (Phase 1 — Notification Router) ───
export const notificationChannels = kernelSchema.table(
  'notification_channels',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    channel_type: varchar('channel_type', { length: 20 }).notNull(),
    config: jsonb('config').notNull().default('{}'),
    enabled: boolean('enabled').notNull().default(true),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_channels_tenant_name_idx').on(table.tenant_id, table.name),
    index('notification_channels_tenant_type_idx').on(table.tenant_id, table.channel_type),
  ],
);

// ─── K10 notification_templates ───
export const notificationTemplates = kernelSchema.table(
  'notification_templates',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    channel_type: varchar('channel_type', { length: 20 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    body: varchar('body', { length: 10000 }).notNull(),
    variables: jsonb('variables').notNull().default('[]'),
    status: varchar('status', { length: 20 }).notNull().default('draft'),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_templates_tenant_name_idx').on(table.tenant_id, table.name),
    index('notification_templates_tenant_channel_idx').on(table.tenant_id, table.channel_type),
  ],
);

// ─── K10 notifications ───
export const notifications = kernelSchema.table(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    channel_type: varchar('channel_type', { length: 20 }).notNull(),
    template_id: uuid('template_id').references(() => notificationTemplates.id),
    recipient_id: uuid('recipient_id').notNull().references(() => users.id),
    subject: varchar('subject', { length: 500 }).notNull(),
    body: varchar('body', { length: 10000 }).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    metadata: jsonb('metadata').notNull().default('{}'),
    sent_at: timestamp('sent_at', { withTimezone: true }),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('notifications_tenant_recipient_idx').on(table.tenant_id, table.recipient_id),
    index('notifications_tenant_status_idx').on(table.tenant_id, table.status),
    index('notifications_tenant_created_idx').on(table.tenant_id, table.created_at),
  ],
);

// ─── K10 notification_preferences ───
export const notificationPreferences = kernelSchema.table(
  'notification_preferences',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    user_id: uuid('user_id').notNull().references(() => users.id),
    channel_type: varchar('channel_type', { length: 20 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('notification_preferences_user_channel_idx').on(table.user_id, table.channel_type),
    index('notification_preferences_tenant_idx').on(table.tenant_id),
  ],
);

// ─── K8 metrics ───
export const metrics = kernelSchema.table(
  'metrics',
  {
    id: uuid('id').primaryKey(),
    tenant_id: uuid('tenant_id').notNull().references(() => tenants.id),
    dataset_id: uuid('dataset_id').notNull().references(() => datasets.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    display_name: varchar('display_name', { length: 255 }).notNull(),
    expression: varchar('expression', { length: 1000 }).notNull(),
    aggregation: varchar('aggregation', { length: 20 }).notNull(),
    dimensions: jsonb('dimensions').notNull().default('[]'),
    description: varchar('description', { length: 1000 }),
    created_by: uuid('created_by').notNull().references(() => users.id),
    created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('metrics_tenant_dataset_name_idx').on(table.tenant_id, table.dataset_id, table.name),
    index('metrics_tenant_idx').on(table.tenant_id),
  ],
);

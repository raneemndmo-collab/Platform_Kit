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

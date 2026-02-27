import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { v7 as uuidv7 } from 'uuid';
import { IamService } from './iam.service.js';
import {
  registerSchema,
  loginSchema,
  updateUserSchema,
  createRoleSchema,
  updateRoleSchema,
  roleAssignSchema,
} from './iam.schema.js';
import type {
  RegisterInput,
  LoginInput,
  UpdateUserInput,
  CreateRoleInput,
  UpdateRoleInput,
  RoleAssignInput,
} from './iam.types.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { tenantMiddleware, tenantCleanup } from '../middleware/tenant.middleware.js';
import { buildRequestContext } from '../middleware/request-context.js';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@rasid/shared';
import type postgres from 'postgres';

const iam = new IamService();

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return new Date(val).toISOString();
  return new Date().toISOString();
}

function meta(requestId: string, extra?: Record<string, string>) {
  return {
    request_id: requestId,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

const isTest = process.env.NODE_ENV === 'test';
const authRateLimit = {
  config: {
    rateLimit: {
      max: isTest ? 1000 : 10,
      timeWindow: '1 minute',
    },
  },
};

/** Register auth routes (no JWT required) */
async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    '/api/v1/auth/register',
    { schema: registerSchema, ...authRateLimit },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const input = request.body as RegisterInput;
      const result = await iam.register(input);
      return reply.status(201).send({
        data: { user: result.user, token: result.token },
        meta: meta(request.id as string),
      });
    },
  );

  app.post(
    '/api/v1/auth/login',
    { schema: loginSchema, ...authRateLimit },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const input = request.body as LoginInput;
      const token = await iam.login(input);
      return reply.send({
        data: { token },
        meta: meta(request.id as string),
      });
    },
  );

  app.post(
    '/api/v1/auth/refresh',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Missing refresh token' },
          meta: meta(request.id as string),
        });
      }
      const refreshToken = authHeader.slice(7);
      const token = await iam.refreshToken(refreshToken);
      return reply.send({
        data: { token },
        meta: meta(request.id as string),
      });
    },
  );
}

/** Register user management routes (JWT required) */
async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  app.get(
    '/api/v1/users',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const rows = await sql`SELECT id, tenant_id, email, display_name, status, last_login_at, created_at, updated_at FROM kernel.users WHERE status != 'deleted'`;
      const users = rows.map((r) => ({
        id: r.id,
        tenant_id: r.tenant_id,
        email: r.email,
        display_name: r.display_name,
        status: r.status,
        last_login_at: r.last_login_at ? toIso(r.last_login_at) : null,
        created_at: toIso(r.created_at),
        updated_at: toIso(r.updated_at),
      }));
      return reply.send({
        data: { items: users, next_cursor: null, has_more: false },
        meta: meta(request.id as string),
      });
    },
  );

  app.get(
    '/api/v1/users/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const [row] = await sql`SELECT id, tenant_id, email, display_name, status, last_login_at, created_at, updated_at FROM kernel.users WHERE id = ${id}`;
      if (!row) throw new NotFoundError('User not found');
      return reply.send({
        data: {
          ...row,
          last_login_at: row.last_login_at ? toIso(row.last_login_at) : null,
          created_at: toIso(row.created_at),
          updated_at: toIso(row.updated_at),
        },
        meta: meta(request.id as string),
      });
    },
  );

  app.patch(
    '/api/v1/users/:id',
    { schema: updateUserSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as UpdateUserInput;
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const [row] = await sql`
        UPDATE kernel.users SET
          ${body.display_name !== undefined ? sql`display_name = ${body.display_name},` : sql``}
          ${body.status !== undefined ? sql`status = ${body.status},` : sql``}
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, tenant_id, email, display_name, status, last_login_at, created_at, updated_at
      `;
      if (!row) throw new NotFoundError('User not found');
      return reply.send({
        data: {
          ...row,
          last_login_at: row.last_login_at ? toIso(row.last_login_at) : null,
          created_at: toIso(row.created_at),
          updated_at: toIso(row.updated_at),
        },
        meta: meta(request.id as string),
      });
    },
  );

  app.delete(
    '/api/v1/users/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const [row] = await sql`
        UPDATE kernel.users SET status = 'deleted', updated_at = NOW()
        WHERE id = ${id} AND status != 'deleted'
        RETURNING id
      `;
      if (!row) throw new NotFoundError('User not found');
      return reply.status(204).send();
    },
  );
}

/** Register role management routes (JWT required) */
async function roleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', authMiddleware);
  app.addHook('onRequest', tenantMiddleware);
  app.addHook('onResponse', tenantCleanup);

  app.get(
    '/api/v1/roles',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const rows = await sql`SELECT * FROM kernel.roles`;
      const roles = rows.map((r) => ({
        ...r,
        created_at: toIso(r.created_at),
        updated_at: toIso(r.updated_at),
      }));
      return reply.send({
        data: { items: roles, next_cursor: null, has_more: false },
        meta: meta(request.id as string),
      });
    },
  );

  app.post(
    '/api/v1/roles',
    { schema: createRoleSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as CreateRoleInput;
      const ctx = buildRequestContext(request);
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const roleId = uuidv7();
      try {
        const [row] = await sql`
          INSERT INTO kernel.roles (id, tenant_id, name, description)
          VALUES (${roleId}, ${ctx.tenantId}, ${body.name}, ${body.description || null})
          RETURNING *
        `;
        if (!row) throw new ConflictError('Failed to create role');
        return reply.status(201).send({
          data: { ...row, created_at: toIso(row.created_at), updated_at: toIso(row.updated_at) },
          meta: meta(request.id as string),
        });
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          throw new ConflictError('Role name already exists in this tenant');
        }
        throw err;
      }
    },
  );

  app.patch(
    '/api/v1/roles/:id',
    { schema: updateRoleSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as UpdateRoleInput;
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const [existing] = await sql`SELECT is_system FROM kernel.roles WHERE id = ${id}`;
      if (!existing) throw new NotFoundError('Role not found');
      if (existing.is_system) throw new ValidationError('Cannot modify system role');
      const [row] = await sql`
        UPDATE kernel.roles SET
          ${body.name !== undefined ? sql`name = ${body.name},` : sql``}
          ${body.description !== undefined ? sql`description = ${body.description},` : sql``}
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!row) throw new NotFoundError('Role not found after update');
      return reply.send({
        data: { ...row, created_at: toIso(row.created_at), updated_at: toIso(row.updated_at) },
        meta: meta(request.id as string),
      });
    },
  );

  app.delete(
    '/api/v1/roles/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const [existing] = await sql`SELECT is_system FROM kernel.roles WHERE id = ${id}`;
      if (!existing) throw new NotFoundError('Role not found');
      if (existing.is_system) throw new ValidationError('Cannot delete system role');
      await sql`DELETE FROM kernel.role_permissions WHERE role_id = ${id}`;
      await sql`DELETE FROM kernel.user_roles WHERE role_id = ${id}`;
      await sql`DELETE FROM kernel.roles WHERE id = ${id}`;
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/v1/roles/:id/assign',
    { schema: roleAssignSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: roleId } = request.params as { id: string };
      const { user_id: userId } = request.body as RoleAssignInput;
      const ctx = buildRequestContext(request);
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const [role] = await sql`SELECT id FROM kernel.roles WHERE id = ${roleId}`;
      if (!role) throw new NotFoundError('Role not found');
      const [user] = await sql`SELECT id FROM kernel.users WHERE id = ${userId}`;
      if (!user) throw new NotFoundError('User not found');
      try {
        await sql`
          INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by)
          VALUES (${userId}, ${roleId}, ${ctx.tenantId}, ${ctx.userId})
        `;
      } catch (err: unknown) {
        if ((err as { code?: string }).code === '23505') {
          throw new ConflictError('Role already assigned to user');
        }
        throw err;
      }
      return reply.status(201).send({
        data: { user_id: userId, role_id: roleId },
        meta: meta(request.id as string),
      });
    },
  );

  app.post(
    '/api/v1/roles/:id/unassign',
    { schema: roleAssignSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id: roleId } = request.params as { id: string };
      const { user_id: userId } = request.body as RoleAssignInput;
      const sql = (request as FastifyRequest & { sql: postgres.ReservedSql }).sql;
      const result = await sql`
        DELETE FROM kernel.user_roles WHERE user_id = ${userId} AND role_id = ${roleId}
      `;
      if (result.count === 0) {
        throw new NotFoundError('Role assignment not found');
      }
      return reply.status(204).send();
    },
  );
}

export { authRoutes, userRoutes, roleRoutes };

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v7 as uuidv7 } from 'uuid';
import { adminSql } from '../db/connection.js';
import type { JwtPayload } from '@rasid/shared';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
} from '@rasid/shared';
import type { IIamService } from './iam.interface.js';
import type {
  RegisterInput,
  LoginInput,
  TokenPair,
  User,
  Role,
  Permission,
} from './iam.types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'rasid-dev-secret-key-min-32-chars-ok!!';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN || '24h';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const SALT_ROUNDS = 10;

function parseExpiresIn(val: string): number {
  if (val.endsWith('h')) return parseInt(val) * 3600;
  if (val.endsWith('d')) return parseInt(val) * 86400;
  return parseInt(val);
}

function toIso(val: unknown): string {
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'string') return new Date(val).toISOString();
  return new Date().toISOString();
}

function toUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    email: row.email as string,
    display_name: row.display_name as string,
    status: row.status as string,
    last_login_at: row.last_login_at ? toIso(row.last_login_at) : null,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function generateTokenPair(
  userId: string,
  tenantId: string,
  roleNames: string[],
): TokenPair {
  const sessionId = uuidv7();
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: userId,
    tid: tenantId,
    roles: roleNames,
    sid: sessionId,
  };
  const access_token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_EXPIRES as string,
  } as jwt.SignOptions);
  const refresh_token = jwt.sign(
    { ...payload, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES as string } as jwt.SignOptions,
  );
  return {
    access_token,
    refresh_token,
    expires_in: parseExpiresIn(ACCESS_EXPIRES),
  };
}

export class IamService implements IIamService {
  async register(
    input: RegisterInput,
  ): Promise<{ user: User; token: TokenPair }> {
    // Resolve tenant_slug → tenant_id
    const [tenant] = await adminSql`
      SELECT id FROM kernel.tenants WHERE slug = ${input.tenant_slug} AND status = 'active'
    `;
    if (!tenant) {
      throw new NotFoundError(`Tenant '${input.tenant_slug}' not found`);
    }
    const tenantId = tenant.id as string;

    // Check duplicate email within tenant
    const [existing] = await adminSql`
      SELECT id FROM kernel.users
      WHERE tenant_id = ${tenantId} AND email = ${input.email}
    `;
    if (existing) {
      throw new ConflictError('Email already registered in this tenant');
    }

    const userId = uuidv7();
    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    // Insert user
    const [userRow] = await adminSql`
      INSERT INTO kernel.users (id, tenant_id, email, password_hash, display_name)
      VALUES (${userId}, ${tenantId}, ${input.email}, ${passwordHash}, ${input.display_name})
      RETURNING *
    `;

    // Assign default 'viewer' role
    const [viewerRole] = await adminSql`
      SELECT id FROM kernel.roles WHERE tenant_id = ${tenantId} AND name = 'viewer'
    `;
    if (viewerRole) {
      await adminSql`
        INSERT INTO kernel.user_roles (user_id, role_id, tenant_id, assigned_by)
        VALUES (${userId}, ${viewerRole.id}, ${tenantId}, ${userId})
      `;
    }

    const roleNames = viewerRole ? ['viewer'] : [];
    const token = generateTokenPair(userId, tenantId, roleNames);
    if (!userRow) throw new ConflictError('Failed to create user');
    return { user: toUser(userRow), token };
  }

  async login(input: LoginInput): Promise<TokenPair> {
    // Resolve tenant
    const [tenant] = await adminSql`
      SELECT id FROM kernel.tenants WHERE slug = ${input.tenant_slug} AND status = 'active'
    `;
    if (!tenant) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const tenantId = tenant.id as string;

    // Find user
    const [userRow] = await adminSql`
      SELECT id, password_hash, status FROM kernel.users
      WHERE tenant_id = ${tenantId} AND email = ${input.email}
    `;
    if (!userRow || userRow.status !== 'active') {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const valid = await bcrypt.compare(
      input.password,
      userRow.password_hash as string,
    );
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last_login_at
    await adminSql`
      UPDATE kernel.users SET last_login_at = NOW() WHERE id = ${userRow.id}
    `;

    // Get role names
    const roles = await adminSql`
      SELECT r.name FROM kernel.user_roles ur
      JOIN kernel.roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userRow.id} AND ur.tenant_id = ${tenantId}
    `;
    const roleNames = roles.map((r) => r.name as string);

    return generateTokenPair(
      userRow.id as string,
      tenantId,
      roleNames,
    );
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    let decoded: JwtPayload & { type?: string };
    try {
      decoded = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload & {
        type?: string;
      };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (decoded.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Verify user still exists and is active
    const [userRow] = await adminSql`
      SELECT id, status FROM kernel.users WHERE id = ${decoded.sub}
    `;
    if (!userRow || userRow.status !== 'active') {
      throw new UnauthorizedError('User no longer active');
    }

    // Get current roles
    const roles = await adminSql`
      SELECT r.name FROM kernel.user_roles ur
      JOIN kernel.roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${decoded.sub} AND ur.tenant_id = ${decoded.tid}
    `;
    const roleNames = roles.map((r) => r.name as string);

    return generateTokenPair(decoded.sub, decoded.tid, roleNames);
  }

  async validateToken(accessToken: string): Promise<JwtPayload> {
    try {
      return jwt.verify(accessToken, JWT_SECRET) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Invalid token');
    }
  }

  async getUserRoles(userId: string, tenantId: string): Promise<Role[]> {
    const rows = await adminSql`
      SELECT r.* FROM kernel.user_roles ur
      JOIN kernel.roles r ON r.id = ur.role_id
      WHERE ur.user_id = ${userId} AND ur.tenant_id = ${tenantId}
    `;
    return rows.map((r) => ({
      id: r.id as string,
      tenant_id: r.tenant_id as string,
      name: r.name as string,
      description: (r.description as string) || null,
      is_system: r.is_system as boolean,
      created_at: (r.created_at as Date).toISOString(),
      updated_at: (r.updated_at as Date).toISOString(),
    }));
  }

  async getUserPermissions(
    userId: string,
    tenantId: string,
  ): Promise<Permission[]> {
    const rows = await adminSql`
      SELECT DISTINCT p.id, p.resource, p.action, p.description
      FROM kernel.user_roles ur
      JOIN kernel.role_permissions rp ON rp.role_id = ur.role_id AND rp.tenant_id = ur.tenant_id
      JOIN kernel.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = ${userId} AND ur.tenant_id = ${tenantId}
    `;
    return rows.map((p) => ({
      id: p.id as string,
      resource: p.resource as string,
      action: p.action as string,
      description: (p.description as string) || null,
    }));
  }
}

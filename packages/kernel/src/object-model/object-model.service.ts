import { v7 as uuidv7 } from 'uuid';
import { adminSql } from '../db/connection.js';
import type { IObjectModelService } from './object-model.interface.js';
import type {
  ObjectTypeManifest,
  CreateObjectInput,
  UpdateObjectInput,
  ObjectFilter,
  PlatformObject,
  RequestContext,
  PaginatedResult,
} from './object-model.types.js';
import { ALLOWED_TRANSITIONS } from './object-model.types.js';
import type { ObjectState } from '@rasid/shared';
import {
  NotFoundError,
  ValidationError,
  InvalidStateTransitionError,
} from '@rasid/shared';
import type postgres from 'postgres';

/** Convert a DB row to a PlatformObject */
function toObject(row: Record<string, unknown>): PlatformObject {
  const ts = (v: unknown): string =>
    v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : '';
  const tsNull = (v: unknown): string | null =>
    v == null ? null : ts(v);

  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    type: row.type as string,
    state: row.state as ObjectState,
    version: row.version as number,
    data: row.data as Record<string, unknown>,
    created_by: row.created_by as string,
    updated_by: (row.updated_by as string) ?? null,
    created_at: ts(row.created_at),
    updated_at: ts(row.updated_at),
    deleted_at: tsNull(row.deleted_at),
  };
}

/**
 * K2 Object Model Service.
 *
 * - registerType uses adminSql (global table, no RLS).
 * - All object operations use the request-scoped sql (tenant transaction).
 */
export class ObjectModelService implements IObjectModelService {
  /** Register an object type (global, no RLS) */
  async registerType(manifest: ObjectTypeManifest): Promise<void> {
    await adminSql`
      INSERT INTO kernel.object_types (name, display_name, module_id, json_schema)
      VALUES (
        ${manifest.name},
        ${manifest.display_name},
        ${manifest.module_id},
        ${JSON.stringify(manifest.json_schema)}
      )
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        json_schema  = EXCLUDED.json_schema
    `;
  }

  /** Create a new object */
  async createObject(
    input: CreateObjectInput,
    ctx: RequestContext,
    sql?: postgres.ReservedSql,
  ): Promise<PlatformObject> {
    const conn = this.requireSql(sql);

    // Verify type exists (object_types is global, query via adminSql)
    const [typeRow] = await adminSql`
      SELECT name, json_schema FROM kernel.object_types WHERE name = ${input.type}
    `;
    if (!typeRow) {
      throw new NotFoundError(`Object type '${input.type}' not registered`);
    }

    // Validate data against json_schema (basic required-field check)
    this.validateData(input.data, typeRow.json_schema as Record<string, unknown>);

    const id = uuidv7();
    const rows = await conn`
      INSERT INTO kernel.objects (id, tenant_id, type, state, version, data, created_by)
      VALUES (${id}, ${ctx.tenantId}, ${input.type}, 'draft', 1, ${JSON.stringify(input.data)}, ${ctx.userId})
      RETURNING *
    `;
    return toObject(rows[0] as Record<string, unknown>);
  }

  /** Get a single object by ID */
  async getObject(
    id: string,
    _ctx: RequestContext,
    sql?: postgres.ReservedSql,
  ): Promise<PlatformObject | null> {
    const conn = this.requireSql(sql);
    const [row] = await conn`
      SELECT * FROM kernel.objects WHERE id = ${id} AND deleted_at IS NULL
    `;
    return row ? toObject(row) : null;
  }

  /** Update object data — increments version */
  async updateObject(
    id: string,
    patch: UpdateObjectInput,
    ctx: RequestContext,
    sql?: postgres.ReservedSql,
  ): Promise<PlatformObject> {
    const conn = this.requireSql(sql);

    const [existing] = await conn`
      SELECT * FROM kernel.objects WHERE id = ${id} AND deleted_at IS NULL
    `;
    if (!existing) throw new NotFoundError('Object not found');
    if (existing.state === 'deleted') {
      throw new InvalidStateTransitionError('Cannot update a deleted object');
    }

    const [row] = await conn`
      UPDATE kernel.objects SET
        data = ${JSON.stringify(patch.data)},
        version = version + 1,
        updated_by = ${ctx.userId},
        updated_at = NOW()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *
    `;
    if (!row) throw new NotFoundError('Object not found');
    return toObject(row);
  }

  /** Soft-delete an object */
  async deleteObject(
    id: string,
    ctx: RequestContext,
    sql?: postgres.ReservedSql,
  ): Promise<void> {
    const conn = this.requireSql(sql);

    const [existing] = await conn`
      SELECT state FROM kernel.objects WHERE id = ${id} AND deleted_at IS NULL
    `;
    if (!existing) throw new NotFoundError('Object not found');
    if (existing.state === 'deleted') {
      throw new InvalidStateTransitionError('Object already deleted');
    }

    await conn`
      UPDATE kernel.objects SET
        state = 'deleted',
        deleted_at = NOW(),
        updated_by = ${ctx.userId},
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  /** Transition object state */
  async transitionState(
    id: string,
    newState: ObjectState,
    ctx: RequestContext,
    sql?: postgres.ReservedSql,
  ): Promise<PlatformObject> {
    const conn = this.requireSql(sql);

    const [existing] = await conn`
      SELECT * FROM kernel.objects WHERE id = ${id} AND deleted_at IS NULL
    `;
    if (!existing) throw new NotFoundError('Object not found');

    const currentState = existing.state as ObjectState;
    const allowed = ALLOWED_TRANSITIONS[currentState];
    if (!allowed.includes(newState)) {
      throw new InvalidStateTransitionError(
        `Cannot transition from '${currentState}' to '${newState}'`,
      );
    }

    const deletedAt = newState === 'deleted' ? new Date().toISOString() : null;
    const [row] = await conn`
      UPDATE kernel.objects SET
        state = ${newState},
        deleted_at = ${deletedAt},
        updated_by = ${ctx.userId},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    if (!row) throw new NotFoundError('Object not found');
    return toObject(row);
  }

  /** List objects with optional filters and cursor pagination */
  async listObjects(
    filter: ObjectFilter,
    _ctx: RequestContext,
    sql?: postgres.ReservedSql,
  ): Promise<PaginatedResult<PlatformObject>> {
    const conn = this.requireSql(sql);
    const limit = Math.min(filter.limit ?? 20, 100);

    // Build conditions dynamically
    const rows = await conn`
      SELECT * FROM kernel.objects
      WHERE deleted_at IS NULL
        ${filter.type ? conn`AND type = ${filter.type}` : conn``}
        ${filter.state ? conn`AND state = ${filter.state}` : conn``}
        ${filter.cursor ? conn`AND id < ${filter.cursor}` : conn``}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(toObject);
    const lastItem = items[items.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    return { items, next_cursor: nextCursor, has_more: hasMore };
  }

  /** Basic JSON schema validation (required fields only for Phase 0) */
  private validateData(
    data: Record<string, unknown>,
    schema: Record<string, unknown>,
  ): void {
    const props = schema.properties as Record<string, unknown> | undefined;
    const required = schema.required as string[] | undefined;
    if (!props || !required) return;

    for (const field of required) {
      if (data[field] === undefined || data[field] === null) {
        throw new ValidationError(`Missing required field: ${field}`);
      }
    }
  }

  /** Get the SQL connection — either request-scoped or throw */
  private requireSql(sql?: postgres.ReservedSql): postgres.ReservedSql {
    if (!sql) {
      throw new Error('SQL connection required — pass request.sql');
    }
    return sql;
  }
}

/** Singleton */
export const objectModelService = new ObjectModelService();

/**
 * M21 AI Engine — Memory Layer Service (Step 5)
 *
 * Session-scoped memory only. No cross-session sharing.
 * No automatic injection into other modules.
 * No background cleanup. No timed-jobs. No external storage.
 * No caching. Explicit opt-in usage only.
 * All DB access via tenant-scoped sql (RLS-enforced).
 */
import type postgres from 'postgres';
import { v7 as uuidv7 } from 'uuid';
import { NotFoundError, ValidationError } from '@rasid/shared';
import type {
  MemorySession,
  MemoryEntry,
  CreateMemorySessionInput,
  UpdateMemorySessionInput,
  AddMemoryEntryInput,
  ListMemoryEntriesInput,
} from './memory.types.js';
import { MAX_ENTRIES_PER_SESSION } from './memory.schema.js';

class MemoryService {

  // ═══════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════

  async createSession(
    sql: postgres.Sql,
    tenantId: string,
    userId: string,
    input: CreateMemorySessionInput,
  ): Promise<MemorySession> {
    const id = uuidv7();
    const label = input.label ?? '';
    const metadata = input.metadata ?? {};

    const rows = await sql`
      INSERT INTO mod_ai.memory_sessions (id, tenant_id, user_id, label, metadata)
      VALUES (${id}, ${tenantId}, ${userId}, ${label}, ${JSON.stringify(metadata)}::jsonb)
      RETURNING *
    `;
    return this.mapSession(rows[0]);
  }

  async getSession(
    sql: postgres.Sql,
    tenantId: string,
    sessionId: string,
  ): Promise<MemorySession> {
    const rows = await sql`
      SELECT * FROM mod_ai.memory_sessions
      WHERE id = ${sessionId} AND tenant_id = ${tenantId}
    `;
    if (rows.length === 0) throw new NotFoundError('Memory session not found');
    return this.mapSession(rows[0]);
  }

  async listSessions(
    sql: postgres.Sql,
    tenantId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<{ items: MemorySession[]; total: number }> {
    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM mod_ai.memory_sessions
      WHERE tenant_id = ${tenantId} AND user_id = ${userId}
    `;
    const total = countRows[0].total;

    const rows = await sql`
      SELECT * FROM mod_ai.memory_sessions
      WHERE tenant_id = ${tenantId} AND user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { items: rows.map((r: any) => this.mapSession(r)), total };
  }

  async updateSession(
    sql: postgres.Sql,
    tenantId: string,
    sessionId: string,
    input: UpdateMemorySessionInput,
  ): Promise<MemorySession> {
    // Verify session exists
    await this.getSession(sql, tenantId, sessionId);

    const updates: string[] = [];
    const values: any[] = [];

    if (input.label !== undefined) {
      updates.push('label');
      values.push(input.label);
    }
    if (input.metadata !== undefined) {
      updates.push('metadata');
      values.push(JSON.stringify(input.metadata));
    }
    if (input.status !== undefined) {
      updates.push('status');
      values.push(input.status);
    }

    if (updates.length === 0) {
      return this.getSession(sql, tenantId, sessionId);
    }

    // Build dynamic update using sql tagged template
    let result: any;
    if (updates.length === 1 && updates[0] === 'label') {
      result = await sql`
        UPDATE mod_ai.memory_sessions
        SET label = ${values[0]}, updated_at = now()
        WHERE id = ${sessionId} AND tenant_id = ${tenantId}
        RETURNING *
      `;
    } else if (updates.length === 1 && updates[0] === 'metadata') {
      result = await sql`
        UPDATE mod_ai.memory_sessions
        SET metadata = ${values[0]}::jsonb, updated_at = now()
        WHERE id = ${sessionId} AND tenant_id = ${tenantId}
        RETURNING *
      `;
    } else if (updates.length === 1 && updates[0] === 'status') {
      result = await sql`
        UPDATE mod_ai.memory_sessions
        SET status = ${values[0]}, updated_at = now()
        WHERE id = ${sessionId} AND tenant_id = ${tenantId}
        RETURNING *
      `;
    } else {
      // Multiple fields — build all possible combos
      const label = input.label;
      const metadata = input.metadata !== undefined ? JSON.stringify(input.metadata) : undefined;
      const status = input.status;

      if (label !== undefined && metadata !== undefined && status !== undefined) {
        result = await sql`
          UPDATE mod_ai.memory_sessions
          SET label = ${label}, metadata = ${metadata}::jsonb, status = ${status}, updated_at = now()
          WHERE id = ${sessionId} AND tenant_id = ${tenantId}
          RETURNING *
        `;
      } else if (label !== undefined && metadata !== undefined) {
        result = await sql`
          UPDATE mod_ai.memory_sessions
          SET label = ${label}, metadata = ${metadata}::jsonb, updated_at = now()
          WHERE id = ${sessionId} AND tenant_id = ${tenantId}
          RETURNING *
        `;
      } else if (label !== undefined && status !== undefined) {
        result = await sql`
          UPDATE mod_ai.memory_sessions
          SET label = ${label}, status = ${status}, updated_at = now()
          WHERE id = ${sessionId} AND tenant_id = ${tenantId}
          RETURNING *
        `;
      } else if (metadata !== undefined && status !== undefined) {
        result = await sql`
          UPDATE mod_ai.memory_sessions
          SET metadata = ${metadata}::jsonb, status = ${status}, updated_at = now()
          WHERE id = ${sessionId} AND tenant_id = ${tenantId}
          RETURNING *
        `;
      } else {
        // Fallback — should not reach here
        return this.getSession(sql, tenantId, sessionId);
      }
    }

    return this.mapSession(result[0]);
  }

  async deleteSession(
    sql: postgres.Sql,
    tenantId: string,
    sessionId: string,
  ): Promise<void> {
    // Verify session exists
    await this.getSession(sql, tenantId, sessionId);

    // Delete entries first (no cross-schema FK, manual cascade)
    await sql`
      DELETE FROM mod_ai.memory_entries
      WHERE session_id = ${sessionId} AND tenant_id = ${tenantId}
    `;
    // Delete session
    await sql`
      DELETE FROM mod_ai.memory_sessions
      WHERE id = ${sessionId} AND tenant_id = ${tenantId}
    `;
  }

  // ═══════════════════════════════════════════
  // ENTRY MANAGEMENT
  // ═══════════════════════════════════════════

  async addEntry(
    sql: postgres.Sql,
    tenantId: string,
    userId: string,
    input: AddMemoryEntryInput,
  ): Promise<MemoryEntry> {
    // Verify session exists and is active
    const session = await this.getSession(sql, tenantId, input.session_id);
    if (session.status !== 'active') {
      throw new ValidationError('Cannot add entries to a closed session');
    }

    // Get next sequence number + enforce max entries per session
    const seqRows = await sql`
      SELECT COALESCE(MAX(seq), 0)::int AS max_seq,
             COUNT(*)::int AS entry_count
      FROM mod_ai.memory_entries
      WHERE session_id = ${input.session_id} AND tenant_id = ${tenantId}
    `;
    const entryCount = seqRows[0].entry_count;
    if (entryCount >= MAX_ENTRIES_PER_SESSION) {
      throw new ValidationError(
        `Session has reached the maximum of ${MAX_ENTRIES_PER_SESSION} entries`,
      );
    }
    const nextSeq = seqRows[0].max_seq + 1;

    const id = uuidv7();
    const rows = await sql`
      INSERT INTO mod_ai.memory_entries (id, session_id, tenant_id, user_id, role, content, seq)
      VALUES (${id}, ${input.session_id}, ${tenantId}, ${userId}, ${input.role}, ${JSON.stringify(input.content)}::jsonb, ${nextSeq})
      RETURNING *
    `;
    return this.mapEntry(rows[0]);
  }

  async listEntries(
    sql: postgres.Sql,
    tenantId: string,
    input: ListMemoryEntriesInput,
  ): Promise<{ items: MemoryEntry[]; total: number }> {
    // Verify session exists
    await this.getSession(sql, tenantId, input.session_id);

    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const countRows = await sql`
      SELECT COUNT(*)::int AS total FROM mod_ai.memory_entries
      WHERE session_id = ${input.session_id} AND tenant_id = ${tenantId}
    `;
    const total = countRows[0].total;

    const rows = await sql`
      SELECT * FROM mod_ai.memory_entries
      WHERE session_id = ${input.session_id} AND tenant_id = ${tenantId}
      ORDER BY seq ASC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return { items: rows.map((r: any) => this.mapEntry(r)), total };
  }

  // ═══════════════════════════════════════════
  // MAPPERS
  // ═══════════════════════════════════════════

  private mapSession(row: any): MemorySession {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      label: row.label,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      status: row.status,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapEntry(row: any): MemoryEntry {
    return {
      id: row.id,
      session_id: row.session_id,
      tenant_id: row.tenant_id,
      user_id: row.user_id,
      role: row.role,
      content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
      seq: Number(row.seq),
      created_at: String(row.created_at),
    };
  }
}

export const memoryService = new MemoryService();

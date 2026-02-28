/**
 * M17 File Manager -- Service
 *
 * Metadata-only file management. No binary storage, no object storage,
 * no streaming, no external filesystem. All data in mod_file_manager schema.
 * RLS enforced. All writes via K3 pipeline.
 */
import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  FileMeta, Folder,
  CreateFileInput, UpdateFileInput,
  CreateFolderInput, UpdateFolderInput,
  FileCategory,
} from './file-manager.types.js';
import type { FileManagerServiceInterface } from './file-manager.interface.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class FileManagerService implements FileManagerServiceInterface {

  // ─────────── Folders ───────────

  async createFolder(sql: Sql, tenantId: string, userId: string, input: CreateFolderInput): Promise<Folder> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_file_manager.folders
        (id, tenant_id, parent_id, name, created_by, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, ${input.parent_id || null}, ${input.name},
         ${userId}, ${now}, ${now})
      RETURNING *
    `;
    return this.mapFolder(rows[0]);
  }

  async listFolders(sql: Sql, tenantId: string, parentId: string | null): Promise<Folder[]> {
    const rows = parentId
      ? await sql`
          SELECT * FROM mod_file_manager.folders
          WHERE tenant_id = ${tenantId} AND parent_id = ${parentId}
          ORDER BY name ASC
        `
      : await sql`
          SELECT * FROM mod_file_manager.folders
          WHERE tenant_id = ${tenantId} AND parent_id IS NULL
          ORDER BY name ASC
        `;
    return rows.map(this.mapFolder);
  }

  async getFolder(sql: Sql, tenantId: string, folderId: string): Promise<Folder | null> {
    const rows = await sql`
      SELECT * FROM mod_file_manager.folders
      WHERE id = ${folderId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapFolder(rows[0]) : null;
  }

  async updateFolder(sql: Sql, tenantId: string, folderId: string, input: UpdateFolderInput): Promise<Folder> {
    const existing = await this.getFolder(sql, tenantId, folderId);
    if (!existing) throw new Error('Folder not found');
    const rows = await sql`
      UPDATE mod_file_manager.folders SET
        name = ${input.name ?? existing.name},
        parent_id = ${input.parent_id !== undefined ? input.parent_id : existing.parent_id},
        updated_at = NOW()
      WHERE id = ${folderId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapFolder(rows[0]);
  }

  async deleteFolder(sql: Sql, tenantId: string, folderId: string): Promise<void> {
    await sql`
      DELETE FROM mod_file_manager.folders
      WHERE id = ${folderId} AND tenant_id = ${tenantId}
    `;
  }

  // ─────────── Files (metadata only) ───────────

  async createFile(sql: Sql, tenantId: string, userId: string, input: CreateFileInput): Promise<FileMeta> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const category = input.category || this.inferCategory(input.mime_type);
    const rows = await sql`
      INSERT INTO mod_file_manager.files
        (id, tenant_id, folder_id, name, mime_type, size_bytes,
         category, status, tags, metadata, created_by, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, ${input.folder_id || null}, ${input.name},
         ${input.mime_type}, ${input.size_bytes}, ${category}, 'active',
         ${JSON.stringify(input.tags || [])}::jsonb,
         ${JSON.stringify(input.metadata || {})}::jsonb,
         ${userId}, ${now}, ${now})
      RETURNING *
    `;
    return this.mapFile(rows[0]);
  }

  async listFiles(sql: Sql, tenantId: string, folderId: string | null): Promise<FileMeta[]> {
    const rows = folderId
      ? await sql`
          SELECT * FROM mod_file_manager.files
          WHERE tenant_id = ${tenantId} AND folder_id = ${folderId}
            AND status != 'deleted'
          ORDER BY created_at DESC
        `
      : await sql`
          SELECT * FROM mod_file_manager.files
          WHERE tenant_id = ${tenantId} AND folder_id IS NULL
            AND status != 'deleted'
          ORDER BY created_at DESC
        `;
    return rows.map(this.mapFile);
  }

  async getFile(sql: Sql, tenantId: string, fileId: string): Promise<FileMeta | null> {
    const rows = await sql`
      SELECT * FROM mod_file_manager.files
      WHERE id = ${fileId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapFile(rows[0]) : null;
  }

  async updateFile(sql: Sql, tenantId: string, fileId: string, input: UpdateFileInput): Promise<FileMeta> {
    const existing = await this.getFile(sql, tenantId, fileId);
    if (!existing) throw new Error('File not found');
    const rows = await sql`
      UPDATE mod_file_manager.files SET
        name = ${input.name ?? existing.name},
        folder_id = ${input.folder_id !== undefined ? input.folder_id : existing.folder_id},
        tags = ${JSON.stringify(input.tags ?? existing.tags)}::jsonb,
        metadata = ${JSON.stringify(input.metadata ?? existing.metadata)}::jsonb,
        updated_at = NOW()
      WHERE id = ${fileId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapFile(rows[0]);
  }

  async moveFile(sql: Sql, tenantId: string, fileId: string, folderId: string | null): Promise<FileMeta> {
    const rows = await sql`
      UPDATE mod_file_manager.files SET
        folder_id = ${folderId},
        updated_at = NOW()
      WHERE id = ${fileId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('File not found');
    return this.mapFile(rows[0]);
  }

  async archiveFile(sql: Sql, tenantId: string, fileId: string): Promise<FileMeta> {
    const rows = await sql`
      UPDATE mod_file_manager.files SET
        status = 'archived', updated_at = NOW()
      WHERE id = ${fileId} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('File not found');
    return this.mapFile(rows[0]);
  }

  async deleteFile(sql: Sql, tenantId: string, fileId: string): Promise<void> {
    await sql`
      DELETE FROM mod_file_manager.files
      WHERE id = ${fileId} AND tenant_id = ${tenantId}
    `;
  }

  // ─────────── Helpers ───────────

  private inferCategory(mimeType: string): FileCategory {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
    if (mimeType.includes('presentation') || mimeType.includes('pptx')) return 'presentation';
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('gzip')) return 'archive';
    if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('text')) return 'document';
    return 'other';
  }

  private mapFolder(row: any): Folder {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      parent_id: row.parent_id ? String(row.parent_id) : null,
      name: String(row.name),
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapFile(row: any): FileMeta {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      folder_id: row.folder_id ? String(row.folder_id) : null,
      name: String(row.name),
      mime_type: String(row.mime_type),
      size_bytes: Number(row.size_bytes),
      category: String(row.category) as any,
      status: String(row.status) as any,
      tags: row.tags ?? [],
      metadata: row.metadata ?? {},
      created_by: String(row.created_by),
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }
}

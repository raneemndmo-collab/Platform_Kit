/**
 * M8 SheetForge — Service
 *
 * Data operations for libraries, sheets, compositions, gap analyses.
 * All writes called from K3 action handlers.
 * Schema: mod_sheetforge
 * External connectors: simulated only (no real file I/O).
 */

import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import { ConflictError, NotFoundError } from '@rasid/shared';
import type { ISheetForgeService } from './sheetforge.interface.js';
import type {
  Library,
  Sheet,
  Composition,
  GapAnalysis,
  UploadLibraryInput,
  UpdateLibraryInput,
  CreateCompositionInput,
  UpdateCompositionInput,
  SimulatedSheet,
} from './sheetforge.types.js';

export class SheetForgeService implements ISheetForgeService {

  /* ═══════════════════════════════════════════
   * LIBRARY OPERATIONS
   * ═══════════════════════════════════════════ */

  async uploadLibrary(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
    userId: string,
    input: UploadLibraryInput,
  ): Promise<Library> {
    const id = uuidv7();
    const now = new Date().toISOString();
    try {
      const [row] = await sql`
        INSERT INTO mod_sheetforge.libraries
          (id, tenant_id, name, file_url, file_type, file_size, row_count, column_count, status, created_by, created_at, updated_at)
        VALUES
          (${id}, ${tenantId}, ${input.name}, ${input.file_url ?? null},
           ${input.file_type ?? 'xlsx'}, ${0}, ${0}, ${0},
           'uploaded', ${userId}, ${now}, ${now})
        RETURNING *
      `;
      return this.mapLibrary(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Library with name '${input.name}' already exists`);
      }
      throw err;
    }
  }

  async indexLibrary(
    sql: postgres.Sql | postgres.ReservedSql,
    libraryId: string,
  ): Promise<Library> {
    // Get the library first
    const lib = await this.getLibrary(sql, libraryId);
    if (!lib) throw new NotFoundError('Library not found');

    // Simulate indexing: generate sheet metadata from simulated data
    // In production this would parse the actual file
    const now = new Date().toISOString();

    // Check if simulated sheets were stored (passed via upload input metadata)
    // For simulation: create a default sheet if none exist
    const existingSheets = await this.getSheets(sql, libraryId);
    if (existingSheets.length === 0) {
      // Create a simulated default sheet
      const sheetId = uuidv7();
      const defaultHeaders = ['col_a', 'col_b', 'col_c'];
      const defaultTypes = { col_a: 'text', col_b: 'number', col_c: 'text' };
      const sampleData = [
        { col_a: 'sample1', col_b: 100, col_c: 'data1' },
        { col_a: 'sample2', col_b: 200, col_c: 'data2' },
      ];
      await sql`
        INSERT INTO mod_sheetforge.sheets
          (id, library_id, tenant_id, sheet_name, headers, data_types, row_count, sample_data, created_at)
        VALUES
          (${sheetId}, ${libraryId}, ${lib.tenant_id}, ${'Sheet1'},
           ${JSON.stringify(defaultHeaders)}, ${JSON.stringify(defaultTypes)},
           ${2}, ${JSON.stringify(sampleData)}, ${now})
      `;
    }

    // Count total rows/columns from sheets
    const sheets = await this.getSheets(sql, libraryId);
    const totalRows = sheets.reduce((sum, s) => sum + s.row_count, 0);
    const maxCols = sheets.reduce((max, s) => Math.max(max, s.headers.length), 0);

    // Update library status to indexed
    const [updated] = await sql`
      UPDATE mod_sheetforge.libraries SET
        status = 'indexed',
        row_count = ${totalRows},
        column_count = ${maxCols},
        indexed_at = ${now},
        updated_at = ${now}
      WHERE id = ${libraryId}
      RETURNING *
    `;
    return this.mapLibrary(updated);
  }

  async getLibrary(
    sql: postgres.Sql | postgres.ReservedSql,
    libraryId: string,
  ): Promise<Library | null> {
    const [row] = await sql`
      SELECT * FROM mod_sheetforge.libraries WHERE id = ${libraryId}
    `;
    return row ? this.mapLibrary(row) : null;
  }

  async listLibraries(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
  ): Promise<Library[]> {
    const rows = await sql`
      SELECT * FROM mod_sheetforge.libraries
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map((r) => this.mapLibrary(r));
  }

  async updateLibrary(
    sql: postgres.Sql | postgres.ReservedSql,
    libraryId: string,
    input: Omit<UpdateLibraryInput, 'id'>,
  ): Promise<Library> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_sheetforge.libraries SET
        name       = COALESCE(${input.name ?? null}, name),
        status     = COALESCE(${input.status ?? null}, status),
        updated_at = ${now}
      WHERE id = ${libraryId}
      RETURNING *
    `;
    if (!row) throw new NotFoundError('Library not found');
    return this.mapLibrary(row);
  }

  async deleteLibrary(
    sql: postgres.Sql | postgres.ReservedSql,
    libraryId: string,
  ): Promise<void> {
    // Sheets cascade-delete via FK
    await sql`DELETE FROM mod_sheetforge.libraries WHERE id = ${libraryId}`;
  }

  /* ═══════════════════════════════════════════
   * SHEET OPERATIONS (read-only)
   * ═══════════════════════════════════════════ */

  async getSheets(
    sql: postgres.Sql | postgres.ReservedSql,
    libraryId: string,
  ): Promise<Sheet[]> {
    const rows = await sql`
      SELECT * FROM mod_sheetforge.sheets
      WHERE library_id = ${libraryId}
      ORDER BY sheet_name ASC
    `;
    return rows.map((r) => this.mapSheet(r));
  }

  async getSheet(
    sql: postgres.Sql | postgres.ReservedSql,
    sheetId: string,
  ): Promise<Sheet | null> {
    const [row] = await sql`
      SELECT * FROM mod_sheetforge.sheets WHERE id = ${sheetId}
    `;
    return row ? this.mapSheet(row) : null;
  }

  /* ═══════════════════════════════════════════
   * COMPOSITION OPERATIONS
   * ═══════════════════════════════════════════ */

  async createComposition(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
    userId: string,
    input: CreateCompositionInput,
  ): Promise<Composition> {
    const id = uuidv7();
    const now = new Date().toISOString();

    // Build output schema from source_sheets
    const outputSchema = input.source_sheets.flatMap((ss) =>
      ss.selected_columns.map((col) => ({
        name: `${ss.alias}_${col}`,
        source_sheet_alias: ss.alias,
        source_column: col,
        data_type: 'text',
      })),
    );

    try {
      const [row] = await sql`
        INSERT INTO mod_sheetforge.compositions
          (id, tenant_id, name, description, source_sheets, join_config,
           output_schema, output_data, status, created_by, created_at, updated_at)
        VALUES
          (${id}, ${tenantId}, ${input.name}, ${input.description ?? null},
           ${JSON.stringify(input.source_sheets)}, ${JSON.stringify(input.join_config)},
           ${JSON.stringify(outputSchema)}, ${JSON.stringify([])},
           'draft', ${userId}, ${now}, ${now})
        RETURNING *
      `;
      return this.mapComposition(row);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        throw new ConflictError(`Composition with name '${input.name}' already exists`);
      }
      throw err;
    }
  }

  async getComposition(
    sql: postgres.Sql | postgres.ReservedSql,
    compositionId: string,
  ): Promise<Composition | null> {
    const [row] = await sql`
      SELECT * FROM mod_sheetforge.compositions WHERE id = ${compositionId}
    `;
    return row ? this.mapComposition(row) : null;
  }

  async listCompositions(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
  ): Promise<Composition[]> {
    const rows = await sql`
      SELECT * FROM mod_sheetforge.compositions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map((r) => this.mapComposition(r));
  }

  async updateComposition(
    sql: postgres.Sql | postgres.ReservedSql,
    compositionId: string,
    input: Omit<UpdateCompositionInput, 'id'>,
  ): Promise<Composition> {
    const now = new Date().toISOString();
    const [row] = await sql`
      UPDATE mod_sheetforge.compositions SET
        name          = COALESCE(${input.name ?? null}, name),
        description   = COALESCE(${input.description ?? null}, description),
        source_sheets = COALESCE(${input.source_sheets ? JSON.stringify(input.source_sheets) : null}, source_sheets),
        join_config   = COALESCE(${input.join_config ? JSON.stringify(input.join_config) : null}, join_config),
        status        = COALESCE(${input.status ?? null}, status),
        updated_at    = ${now}
      WHERE id = ${compositionId}
      RETURNING *
    `;
    if (!row) throw new NotFoundError('Composition not found');
    return this.mapComposition(row);
  }

  async deleteComposition(
    sql: postgres.Sql | postgres.ReservedSql,
    compositionId: string,
  ): Promise<void> {
    // gap_analyses cascade-delete via FK
    await sql`DELETE FROM mod_sheetforge.compositions WHERE id = ${compositionId}`;
  }

  async publishComposition(
    sql: postgres.Sql | postgres.ReservedSql,
    compositionId: string,
  ): Promise<Composition> {
    const comp = await this.getComposition(sql, compositionId);
    if (!comp) throw new NotFoundError('Composition not found');

    const now = new Date().toISOString();

    // Simulate composing output data from source sheets
    // In production this would actually join the sheet data
    const simulatedOutput = [
      { row_index: 0, composed: true, source: 'simulated' },
      { row_index: 1, composed: true, source: 'simulated' },
    ];

    const [row] = await sql`
      UPDATE mod_sheetforge.compositions SET
        status       = 'published',
        output_data  = ${JSON.stringify(simulatedOutput)},
        published_at = ${now},
        updated_at   = ${now}
      WHERE id = ${compositionId}
      RETURNING *
    `;
    return this.mapComposition(row);
  }

  /* ═══════════════════════════════════════════
   * GAP ANALYSIS
   * ═══════════════════════════════════════════ */

  async runGapAnalysis(
    sql: postgres.Sql | postgres.ReservedSql,
    tenantId: string,
    compositionId: string,
  ): Promise<GapAnalysis> {
    const comp = await this.getComposition(sql, compositionId);
    if (!comp) throw new NotFoundError('Composition not found');

    const id = uuidv7();
    const now = new Date().toISOString();

    // Simulate gap analysis on the composition output
    const outputData = comp.output_data || [];
    const outputSchema = comp.output_schema || [];

    let missingCells = 0;
    let duplicateRows = 0;
    const missingByColumn: Record<string, number> = {};

    // Simulate: count missing values per column
    for (const col of outputSchema) {
      const missing = outputData.filter((row) => row[col.name] === null || row[col.name] === undefined).length;
      if (missing > 0) {
        missingByColumn[col.name] = missing;
        missingCells += missing;
      }
    }

    // Simulate: detect duplicate rows (by stringified comparison)
    const seen = new Set<string>();
    const duplicateIndices: number[] = [];
    outputData.forEach((row, idx) => {
      const key = JSON.stringify(row);
      if (seen.has(key)) {
        duplicateIndices.push(idx);
        duplicateRows++;
      }
      seen.add(key);
    });

    const details = {
      missing_by_column: missingByColumn,
      duplicate_indices: duplicateIndices,
      mismatch_columns: [],
    };

    const [result] = await sql`
      INSERT INTO mod_sheetforge.gap_analyses
        (id, composition_id, tenant_id, missing_cells, duplicate_rows, type_mismatches, details, created_at)
      VALUES
        (${id}, ${compositionId}, ${tenantId}, ${missingCells}, ${duplicateRows}, ${0},
         ${JSON.stringify(details)}, ${now})
      RETURNING *
    `;
    return this.mapGapAnalysis(result);
  }

  async getGapAnalysis(
    sql: postgres.Sql | postgres.ReservedSql,
    compositionId: string,
  ): Promise<GapAnalysis | null> {
    const [row] = await sql`
      SELECT * FROM mod_sheetforge.gap_analyses
      WHERE composition_id = ${compositionId}
      ORDER BY created_at DESC LIMIT 1
    `;
    return row ? this.mapGapAnalysis(row) : null;
  }

  /* ═══════════════════════════════════════════
   * MAPPERS
   * ═══════════════════════════════════════════ */

  private mapLibrary(row: Record<string, unknown>): Library {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      file_url: row.file_url as string | null,
      file_type: row.file_type as string,
      file_size: Number(row.file_size),
      row_count: Number(row.row_count),
      column_count: Number(row.column_count),
      indexed_at: row.indexed_at ? String(row.indexed_at) : null,
      status: row.status as Library['status'],
      created_by: row.created_by as string,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapSheet(row: Record<string, unknown>): Sheet {
    return {
      id: row.id as string,
      library_id: row.library_id as string,
      tenant_id: row.tenant_id as string,
      sheet_name: row.sheet_name as string,
      headers: typeof row.headers === 'string' ? JSON.parse(row.headers) : row.headers,
      data_types: typeof row.data_types === 'string' ? JSON.parse(row.data_types) : row.data_types,
      row_count: Number(row.row_count),
      sample_data: typeof row.sample_data === 'string' ? JSON.parse(row.sample_data) : row.sample_data,
      created_at: String(row.created_at),
    };
  }

  private mapComposition(row: Record<string, unknown>): Composition {
    return {
      id: row.id as string,
      tenant_id: row.tenant_id as string,
      name: row.name as string,
      description: row.description as string | null,
      source_sheets: typeof row.source_sheets === 'string' ? JSON.parse(row.source_sheets) : row.source_sheets,
      join_config: typeof row.join_config === 'string' ? JSON.parse(row.join_config) : row.join_config,
      output_schema: typeof row.output_schema === 'string' ? JSON.parse(row.output_schema) : row.output_schema,
      output_data: typeof row.output_data === 'string' ? JSON.parse(row.output_data) : (row.output_data || []),
      status: row.status as Composition['status'],
      published_at: row.published_at ? String(row.published_at) : null,
      created_by: row.created_by as string,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    };
  }

  private mapGapAnalysis(row: Record<string, unknown>): GapAnalysis {
    return {
      id: row.id as string,
      composition_id: row.composition_id as string,
      tenant_id: row.tenant_id as string,
      missing_cells: Number(row.missing_cells),
      duplicate_rows: Number(row.duplicate_rows),
      type_mismatches: Number(row.type_mismatches),
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      created_at: String(row.created_at),
    };
  }
}

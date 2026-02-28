/**
 * M10 Reports Engine — Service
 *
 * Metadata-driven report definitions + simulated execution via Semantic Layer.
 * No PDF engine. No export. No scheduling. No caching. No AI.
 * All data in mod_reports schema. RLS enforced. All writes via K3.
 */

import { v7 as uuidv7 } from 'uuid';
import type postgres from 'postgres';
import type {
  ReportDefinition, ReportRun, ReportOutput,
  CreateReportInput, UpdateReportInput,
  ReportType,
} from './reports.types.js';
import type { ReportsServiceInterface } from './reports.interface.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export class ReportsService implements ReportsServiceInterface {

  // ═══════════════════════════════════════
  // Report Definitions CRUD
  // ═══════════════════════════════════════

  async createReport(sql: Sql, tenantId: string, userId: string, input: CreateReportInput): Promise<ReportDefinition> {
    const id = uuidv7();
    const now = new Date().toISOString();
    const rows = await sql`
      INSERT INTO mod_reports.report_definitions
        (id, tenant_id, name, description, report_type, data_source, layout, parameters, status, created_by, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, ${input.name}, ${input.description || null}, ${input.report_type},
         ${JSON.stringify(input.data_source)}, ${JSON.stringify(input.layout || {})},
         ${JSON.stringify(input.parameters || [])}, ${'draft'}, ${userId}, ${now}, ${now})
      RETURNING *
    `;
    return this.mapReport(rows[0]);
  }

  async getReport(sql: Sql, tenantId: string, id: string): Promise<ReportDefinition | null> {
    const rows = await sql`
      SELECT * FROM mod_reports.report_definitions
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapReport(rows[0]) : null;
  }

  async listReports(sql: Sql, tenantId: string): Promise<ReportDefinition[]> {
    const rows = await sql`
      SELECT * FROM mod_reports.report_definitions
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at DESC
    `;
    return rows.map(this.mapReport);
  }

  async updateReport(sql: Sql, tenantId: string, id: string, input: UpdateReportInput): Promise<ReportDefinition> {
    const now = new Date().toISOString();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (input.name !== undefined) { sets.push('name'); vals.push(input.name); }
    if (input.description !== undefined) { sets.push('description'); vals.push(input.description); }
    if (input.report_type !== undefined) { sets.push('report_type'); vals.push(input.report_type); }
    if (input.data_source !== undefined) { sets.push('data_source'); vals.push(JSON.stringify(input.data_source)); }
    if (input.layout !== undefined) { sets.push('layout'); vals.push(JSON.stringify(input.layout)); }
    if (input.parameters !== undefined) { sets.push('parameters'); vals.push(JSON.stringify(input.parameters)); }

    // Build dynamic update using tagged template
    const existing = await this.getReport(sql, tenantId, id);
    if (!existing) throw new Error('Report not found');

    const rows = await sql`
      UPDATE mod_reports.report_definitions SET
        name = ${input.name ?? existing.name},
        description = ${input.description !== undefined ? input.description : existing.description},
        report_type = ${input.report_type ?? existing.report_type},
        data_source = ${JSON.stringify(input.data_source ?? existing.data_source)},
        layout = ${JSON.stringify(input.layout ?? existing.layout)},
        parameters = ${JSON.stringify(input.parameters ?? existing.parameters)},
        updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    return this.mapReport(rows[0]);
  }

  async publishReport(sql: Sql, tenantId: string, id: string): Promise<ReportDefinition> {
    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE mod_reports.report_definitions
      SET status = 'published', updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('Report not found');
    return this.mapReport(rows[0]);
  }

  async archiveReport(sql: Sql, tenantId: string, id: string): Promise<ReportDefinition> {
    const now = new Date().toISOString();
    const rows = await sql`
      UPDATE mod_reports.report_definitions
      SET status = 'archived', updated_at = ${now}
      WHERE id = ${id} AND tenant_id = ${tenantId}
      RETURNING *
    `;
    if (!rows.length) throw new Error('Report not found');
    return this.mapReport(rows[0]);
  }

  async deleteReport(sql: Sql, tenantId: string, id: string): Promise<void> {
    await sql`DELETE FROM mod_reports.report_definitions WHERE id = ${id} AND tenant_id = ${tenantId}`;
  }

  // ═══════════════════════════════════════
  // Report Execution (simulated via Semantic Layer)
  // ═══════════════════════════════════════

  async executeReport(
    sql: Sql, tenantId: string, userId: string,
    reportId: string, params: Record<string, unknown>,
  ): Promise<ReportOutput> {
    const report = await this.getReport(sql, tenantId, reportId);
    if (!report) throw new Error('Report not found');

    const startTime = Date.now();

    // Simulated semantic layer execution — no cross-schema queries
    const result = this.simulateSemanticExecution(report, params);
    const durationMs = Date.now() - startTime;

    // Record the run
    const runId = uuidv7();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO mod_reports.report_runs
        (id, report_id, tenant_id, parameters, output, status, executed_by, executed_at, duration_ms)
      VALUES
        (${runId}, ${reportId}, ${tenantId}, ${JSON.stringify(params)},
         ${JSON.stringify(result)}, ${'completed'}, ${userId}, ${now}, ${durationMs})
    `;

    return {
      report_id: reportId,
      report_name: report.name,
      report_type: report.report_type,
      data_source: report.data_source,
      parameters_applied: params,
      result,
      generated_at: now,
      source: 'semantic_layer_simulated',
    };
  }

  async getRunHistory(sql: Sql, tenantId: string, reportId: string): Promise<ReportRun[]> {
    const rows = await sql`
      SELECT * FROM mod_reports.report_runs
      WHERE report_id = ${reportId} AND tenant_id = ${tenantId}
      ORDER BY executed_at DESC
    `;
    return rows.map(this.mapRun);
  }

  async getRun(sql: Sql, tenantId: string, runId: string): Promise<ReportRun | null> {
    const rows = await sql`
      SELECT * FROM mod_reports.report_runs
      WHERE id = ${runId} AND tenant_id = ${tenantId}
    `;
    return rows.length ? this.mapRun(rows[0]) : null;
  }

  // ═══════════════════════════════════════
  // Simulated Semantic Layer Execution
  // ═══════════════════════════════════════

  private simulateSemanticExecution(report: ReportDefinition, params: Record<string, unknown>): unknown {
    // No direct DB access to other modules. No cross-schema joins.
    // Returns metadata-based simulated result based on report_type.
    const ds = report.data_source;

    switch (report.report_type) {
      case 'tabular':
        return {
          columns: ds.columns || ['col_a', 'col_b', 'col_c'],
          rows: [
            { col_a: 'sample_1', col_b: 0, col_c: null },
            { col_a: 'sample_2', col_b: 0, col_c: null },
          ],
          total_rows: 2,
          filters_applied: params,
          source: 'semantic_layer_simulated',
        };
      case 'summary':
        return {
          aggregations: { total: 0, average: 0, count: 0 },
          group_by: ds.group_by || [],
          filters_applied: params,
          source: 'semantic_layer_simulated',
        };
      case 'crosstab':
        return {
          row_headers: ds.row_dimension || ['Row A', 'Row B'],
          col_headers: ds.col_dimension || ['Col X', 'Col Y'],
          cells: [[0, 0], [0, 0]],
          filters_applied: params,
          source: 'semantic_layer_simulated',
        };
      case 'narrative':
        return {
          sections: [
            { title: 'Overview', content: 'Simulated narrative content based on semantic model.' },
            { title: 'Details', content: 'No data — semantic layer simulation.' },
          ],
          filters_applied: params,
          source: 'semantic_layer_simulated',
        };
      case 'kpi_scorecard':
        return {
          kpis: (ds.kpi_ids as string[] || []).map((kpiId: string) => ({
            kpi_id: kpiId,
            value: 0,
            target: 0,
            trend: 'stable',
          })),
          filters_applied: params,
          source: 'semantic_layer_simulated',
        };
      default:
        return { source: 'semantic_layer_simulated', filters_applied: params };
    }
  }

  // ═══════════════════════════════════════
  // Mappers
  // ═══════════════════════════════════════

  private mapReport(row: any): ReportDefinition {
    return {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      description: row.description,
      report_type: row.report_type,
      data_source: typeof row.data_source === 'string' ? JSON.parse(row.data_source) : row.data_source,
      layout: typeof row.layout === 'string' ? JSON.parse(row.layout) : row.layout,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      status: row.status,
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private mapRun(row: any): ReportRun {
    return {
      id: row.id,
      report_id: row.report_id,
      tenant_id: row.tenant_id,
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters,
      output: typeof row.output === 'string' ? JSON.parse(row.output) : row.output,
      status: row.status,
      executed_by: row.executed_by,
      executed_at: row.executed_at,
      duration_ms: row.duration_ms,
    };
  }
}

import type postgres from 'postgres';
import type {
  ReportDefinition, ReportRun, ReportOutput,
  CreateReportInput, UpdateReportInput,
} from './reports.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export interface ReportsServiceInterface {
  // ─── Report Definitions ───
  createReport(sql: Sql, tenantId: string, userId: string, input: CreateReportInput): Promise<ReportDefinition>;
  getReport(sql: Sql, tenantId: string, id: string): Promise<ReportDefinition | null>;
  listReports(sql: Sql, tenantId: string): Promise<ReportDefinition[]>;
  updateReport(sql: Sql, tenantId: string, id: string, input: UpdateReportInput): Promise<ReportDefinition>;
  publishReport(sql: Sql, tenantId: string, id: string): Promise<ReportDefinition>;
  archiveReport(sql: Sql, tenantId: string, id: string): Promise<ReportDefinition>;
  deleteReport(sql: Sql, tenantId: string, id: string): Promise<void>;

  // ─── Report Execution (simulated) ───
  executeReport(sql: Sql, tenantId: string, userId: string, reportId: string, params: Record<string, unknown>): Promise<ReportOutput>;
  getRunHistory(sql: Sql, tenantId: string, reportId: string): Promise<ReportRun[]>;
  getRun(sql: Sql, tenantId: string, runId: string): Promise<ReportRun | null>;
}

/**
 * M14 Custom Pages — Service Interface
 */
import type { PageRow, CreatePageInput, UpdatePageInput, AddSectionInput, UpdateSectionInput } from './custom-pages.types.js';
import type postgres from 'postgres';

export interface ICustomPagesService {
  createPage(sql: postgres.ReservedSql, tenantId: string, createdBy: string, input: CreatePageInput): Promise<PageRow>;
  listPages(sql: postgres.ReservedSql, tenantId: string): Promise<PageRow[]>;
  getPage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PageRow | null>;
  updatePage(sql: postgres.ReservedSql, tenantId: string, id: string, input: UpdatePageInput): Promise<PageRow | null>;
  deletePage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<boolean>;
  publishPage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PageRow | null>;
  archivePage(sql: postgres.ReservedSql, tenantId: string, id: string): Promise<PageRow | null>;
  addSection(sql: postgres.ReservedSql, tenantId: string, pageId: string, input: AddSectionInput): Promise<PageRow | null>;
  updateSection(sql: postgres.ReservedSql, tenantId: string, pageId: string, sectionId: string, input: UpdateSectionInput): Promise<PageRow | null>;
  removeSection(sql: postgres.ReservedSql, tenantId: string, pageId: string, sectionId: string): Promise<PageRow | null>;
  reorderSections(sql: postgres.ReservedSql, tenantId: string, pageId: string, sectionIds: string[]): Promise<PageRow | null>;
}

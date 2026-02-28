/** M8 SheetForge — Service Interface */

import type postgres from 'postgres';
import type {
  Library,
  Sheet,
  Composition,
  GapAnalysis,
  UploadLibraryInput,
  UpdateLibraryInput,
  CreateCompositionInput,
  UpdateCompositionInput,
} from './sheetforge.types.js';

export interface ISheetForgeService {
  // Library operations
  uploadLibrary(sql: postgres.Sql | postgres.ReservedSql, tenantId: string, userId: string, input: UploadLibraryInput): Promise<Library>;
  indexLibrary(sql: postgres.Sql | postgres.ReservedSql, libraryId: string): Promise<Library>;
  getLibrary(sql: postgres.Sql | postgres.ReservedSql, libraryId: string): Promise<Library | null>;
  listLibraries(sql: postgres.Sql | postgres.ReservedSql, tenantId: string): Promise<Library[]>;
  updateLibrary(sql: postgres.Sql | postgres.ReservedSql, libraryId: string, input: Omit<UpdateLibraryInput, 'id'>): Promise<Library>;
  deleteLibrary(sql: postgres.Sql | postgres.ReservedSql, libraryId: string): Promise<void>;

  // Sheet operations (read-only, created during indexing)
  getSheets(sql: postgres.Sql | postgres.ReservedSql, libraryId: string): Promise<Sheet[]>;
  getSheet(sql: postgres.Sql | postgres.ReservedSql, sheetId: string): Promise<Sheet | null>;

  // Composition operations
  createComposition(sql: postgres.Sql | postgres.ReservedSql, tenantId: string, userId: string, input: CreateCompositionInput): Promise<Composition>;
  getComposition(sql: postgres.Sql | postgres.ReservedSql, compositionId: string): Promise<Composition | null>;
  listCompositions(sql: postgres.Sql | postgres.ReservedSql, tenantId: string): Promise<Composition[]>;
  updateComposition(sql: postgres.Sql | postgres.ReservedSql, compositionId: string, input: Omit<UpdateCompositionInput, 'id'>): Promise<Composition>;
  deleteComposition(sql: postgres.Sql | postgres.ReservedSql, compositionId: string): Promise<void>;
  publishComposition(sql: postgres.Sql | postgres.ReservedSql, compositionId: string): Promise<Composition>;

  // Gap analysis
  runGapAnalysis(sql: postgres.Sql | postgres.ReservedSql, tenantId: string, compositionId: string): Promise<GapAnalysis>;
  getGapAnalysis(sql: postgres.Sql | postgres.ReservedSql, compositionId: string): Promise<GapAnalysis | null>;
}

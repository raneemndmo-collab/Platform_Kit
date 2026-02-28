import type postgres from 'postgres';
import type {
  FileMeta, Folder,
  CreateFileInput, UpdateFileInput,
  CreateFolderInput, UpdateFolderInput,
} from './file-manager.types.js';

type Sql = postgres.Sql | postgres.ReservedSql;

export interface FileManagerServiceInterface {
  // Folders
  createFolder(sql: Sql, tenantId: string, userId: string, input: CreateFolderInput): Promise<Folder>;
  listFolders(sql: Sql, tenantId: string, parentId: string | null): Promise<Folder[]>;
  getFolder(sql: Sql, tenantId: string, folderId: string): Promise<Folder | null>;
  updateFolder(sql: Sql, tenantId: string, folderId: string, input: UpdateFolderInput): Promise<Folder>;
  deleteFolder(sql: Sql, tenantId: string, folderId: string): Promise<void>;

  // Files (metadata only)
  createFile(sql: Sql, tenantId: string, userId: string, input: CreateFileInput): Promise<FileMeta>;
  listFiles(sql: Sql, tenantId: string, folderId: string | null): Promise<FileMeta[]>;
  getFile(sql: Sql, tenantId: string, fileId: string): Promise<FileMeta | null>;
  updateFile(sql: Sql, tenantId: string, fileId: string, input: UpdateFileInput): Promise<FileMeta>;
  moveFile(sql: Sql, tenantId: string, fileId: string, folderId: string | null): Promise<FileMeta>;
  archiveFile(sql: Sql, tenantId: string, fileId: string): Promise<FileMeta>;
  deleteFile(sql: Sql, tenantId: string, fileId: string): Promise<void>;
}

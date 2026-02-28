export type FileStatus = 'active' | 'archived' | 'deleted';
export type FileCategory = 'document' | 'image' | 'spreadsheet' | 'presentation' | 'archive' | 'other';

export interface FileMeta {
  id: string;
  tenant_id: string;
  folder_id: string | null;
  name: string;
  mime_type: string;
  size_bytes: number;
  category: FileCategory;
  status: FileStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: string;
  tenant_id: string;
  parent_id: string | null;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateFileInput {
  name: string;
  mime_type: string;
  size_bytes: number;
  folder_id?: string;
  category?: FileCategory;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateFileInput {
  name?: string;
  folder_id?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface CreateFolderInput {
  name: string;
  parent_id?: string;
}

export interface UpdateFolderInput {
  name?: string;
  parent_id?: string | null;
}

export interface MoveFileInput {
  folder_id: string | null;
}

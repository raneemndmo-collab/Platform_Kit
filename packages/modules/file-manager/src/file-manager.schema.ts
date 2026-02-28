import { z } from 'zod';

const fileCategories = ['document', 'image', 'spreadsheet', 'presentation', 'archive', 'other'] as const;

export const createFileSchema = z.object({
  name: z.string().min(1).max(500),
  mime_type: z.string().min(1).max(200),
  size_bytes: z.number().int().min(0),
  folder_id: z.string().uuid().optional(),
  category: z.enum(fileCategories).optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateFileSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  folder_id: z.string().uuid().nullable().optional(),
  tags: z.array(z.string().max(100)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(300),
  parent_id: z.string().uuid().optional(),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(300).optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export const moveFileSchema = z.object({
  folder_id: z.string().uuid().nullable(),
});

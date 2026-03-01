/**
 * M21 AI Engine — Memory Layer Zod Schemas (Step 5)
 *
 * Validation schemas for Memory Layer inputs.
 * Structured context only. No raw prompts. No PII beyond allowed fields.
 */
import { z } from 'zod';

export const createMemorySessionSchema = z.object({
  label: z.string().max(255).optional().default(''),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateMemorySessionSchema = z.object({
  session_id: z.string().min(1),
  label: z.string().max(255).optional(),
  metadata: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'closed']).optional(),
});

export const addMemoryEntrySchema = z.object({
  session_id: z.string().min(1),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.record(z.unknown()),
});

export const listMemoryEntriesSchema = z.object({
  session_id: z.string().min(1),
  limit: z.number().int().min(1).max(200).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export const deleteMemorySessionSchema = z.object({
  session_id: z.string().min(1),
});

export const getMemorySessionSchema = z.object({
  session_id: z.string().min(1),
});

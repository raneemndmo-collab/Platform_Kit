/**
 * M21 AI Engine — Agent Framework Core Zod Schemas (Step 3)
 *
 * Validation schemas for agent CRUD and execution.
 * No planning schemas. No multi-step schemas.
 */
import { z } from 'zod';

export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  allowed_tool_ids: z.array(z.string().uuid()).optional().default([]),
  system_prompt: z.string().max(5000).optional().default(''),
  metadata: z.record(z.unknown()).optional().default({}),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  allowed_tool_ids: z.array(z.string().uuid()).optional(),
  system_prompt: z.string().max(5000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const executeAgentSchema = z.object({
  agent_id: z.string().uuid(),
  tool_id: z.string().uuid(),
  input: z.record(z.unknown()).default({}),
});

/**
 * M21 AI Engine — Zod Schemas (Step 1: Core)
 */
import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const invokeToolSchema = z.object({
  action_id: z.string().min(1),
  input: z.record(z.unknown()),
});

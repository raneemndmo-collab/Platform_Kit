/**
 * M27 Observability Layer — Zod Validation Schemas
 *
 * All inputs validated before reaching the service layer.
 * Schema: mod_observability
 */
import { z } from 'zod';

/* ── Metric ── */
export const createMetricSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1024).optional().default(''),
  metric_type: z.enum(['counter', 'gauge', 'histogram']),
  labels: z.array(z.string().max(64)).max(20).optional().default([]),
  unit: z.string().max(32).optional().default(''),
  retention_days: z.number().int().min(1).max(3650).optional().default(90),
});

export const updateMetricSchema = z.object({
  description: z.string().max(1024).optional(),
  labels: z.array(z.string().max(64)).max(20).optional(),
  unit: z.string().max(32).optional(),
  retention_days: z.number().int().min(1).max(3650).optional(),
});

/* ── Alert ── */
export const createAlertSchema = z.object({
  metric_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  condition: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']),
  threshold: z.number(),
  channels: z.array(z.string().max(64)).max(10).optional().default([]),
});

export const updateAlertSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  condition: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']).optional(),
  threshold: z.number().optional(),
  channels: z.array(z.string().max(64)).max(10).optional(),
  status: z.enum(['active', 'silenced', 'disabled']).optional(),
});

/* ── SLO ── */
export const createSloSchema = z.object({
  name: z.string().min(1).max(255),
  service: z.string().min(1).max(255),
  metric_id: z.string().uuid(),
  target_percent: z.number().min(0).max(100),
  window_days: z.number().int().min(1).max(365).optional().default(30),
});

export const updateSloSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  target_percent: z.number().min(0).max(100).optional(),
  window_days: z.number().int().min(1).max(365).optional(),
});

/* ── Status Incident ── */
export const createIncidentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(4096).optional().default(''),
  severity: z.enum(['minor', 'major', 'critical']),
});

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(4096).optional(),
  severity: z.enum(['minor', 'major', 'critical']).optional(),
  status: z.enum(['investigating', 'identified', 'monitoring', 'resolved']).optional(),
});

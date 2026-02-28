import { z } from 'zod';

const widgetTypes = ['kpi_card', 'bar_chart', 'line_chart', 'pie_chart', 'table', 'metric', 'text'] as const;
const sharedWithTypes = ['user', 'role', 'tenant'] as const;
const permissionLevels = ['view', 'edit'] as const;

export const createDashboardSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  layout: z.array(z.unknown()).optional(),
  filters: z.array(z.unknown()).optional(),
});

export const updateDashboardSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  layout: z.array(z.unknown()).optional(),
  filters: z.array(z.unknown()).optional(),
});

export const addWidgetSchema = z.object({
  title: z.string().min(1).max(200),
  widget_type: z.enum(widgetTypes),
  config: z.record(z.unknown()).optional(),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }).optional(),
  data_source: z.record(z.unknown()).optional(),
});

export const updateWidgetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  config: z.record(z.unknown()).optional(),
  position: z.object({
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
  }).optional(),
  data_source: z.record(z.unknown()).optional(),
});

export const shareDashboardSchema = z.object({
  shared_with_type: z.enum(sharedWithTypes),
  shared_with_id: z.string().min(1),
  permission_level: z.enum(permissionLevels).optional(),
});

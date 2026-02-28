import { z } from 'zod';

const reportTypes = ['tabular', 'summary', 'crosstab', 'narrative', 'kpi_scorecard'] as const;

const parameterSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'date', 'boolean', 'select']),
  default_value: z.unknown().optional(),
  options: z.array(z.unknown()).optional(),
  required: z.boolean(),
});

export const createReportSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  report_type: z.enum(reportTypes),
  data_source: z.record(z.unknown()),
  layout: z.record(z.unknown()).optional(),
  parameters: z.array(parameterSchema).optional(),
});

export const updateReportSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  report_type: z.enum(reportTypes).optional(),
  data_source: z.record(z.unknown()).optional(),
  layout: z.record(z.unknown()).optional(),
  parameters: z.array(parameterSchema).optional(),
});

export const executeReportSchema = z.object({
  parameters: z.record(z.unknown()).optional(),
});

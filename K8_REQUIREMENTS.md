# K8 — Semantic Data Layer Requirements

## Phase 1 Scope
- Dataset registration
- Dimension and metric definitions
- Semantic queries with tenant-scoped RLS
- Field-level metadata

## Interfaces (Phase 1)
- `registerDataset(tenantId, name, schema, source)` → Dataset
- `defineMetric(tenantId, name, expression, dimensions)` → Metric
- `query(tenantId, datasetId, dimensions, metrics, filters)` → ResultSet
- `getSchema(datasetId)` → DatasetSchema

## Tables (in kernel schema)
1. `datasets` — id, tenant_id, name, description, source_type, source_config JSONB, schema JSONB, status, created_by, created_at, updated_at
2. `dataset_fields` — id, dataset_id, tenant_id, name, display_name, data_type, is_dimension, is_metric, expression, description, ordinal, created_at
3. `metrics` — id, tenant_id, dataset_id, name, display_name, expression, aggregation, dimensions[], description, created_by, created_at, updated_at

## API Routes
- POST /api/v1/datasets — registerDataset
- GET /api/v1/datasets — listDatasets
- GET /api/v1/datasets/:id — getDataset (includes schema)
- GET /api/v1/datasets/:id/schema — getSchema
- PATCH /api/v1/datasets/:id — updateDataset
- DELETE /api/v1/datasets/:id — soft-delete
- POST /api/v1/datasets/:id/metrics — defineMetric
- GET /api/v1/datasets/:id/metrics — listMetrics
- POST /api/v1/datasets/:id/query — semantic query

## Data Boundaries
- Tables in `kernel` schema (K8 is a Kernel subsystem)
- RLS on datasets, dataset_fields, metrics (tenant_id)
- source_type: 'table', 'view', 'query'
- data_type for fields: 'string', 'number', 'boolean', 'date', 'timestamp'
- aggregation for metrics: 'sum', 'avg', 'count', 'min', 'max', 'count_distinct'

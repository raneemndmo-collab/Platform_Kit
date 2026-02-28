# K8 Route Error Analysis

## Failing Routes (2 of 22)

### 1. DELETE /api/v1/datasets/:datasetId/metrics/:metricId → 500
### 2. DELETE /api/v1/datasets/:id → 500

## Error Message (from server logs)
```
FastifyError: Body cannot be empty when content-type is set to 'application/json'
code: FST_ERR_CTP_EMPTY_JSON_BODY
statusCode: 400
```

## Root Cause Analysis

The error is **two-fold**:

### Problem A: Global Error Handler Gap
The `server.ts` global error handler checks for:
1. `PlatformError` instances → correct status
2. `error.validation` → 400
3. `error.statusCode === 429` → 429
4. Everything else → **500**

Fastify's `FST_ERR_CTP_EMPTY_JSON_BODY` has `statusCode: 400` on the error object,
but the handler only checks for `429`, not for other Fastify error status codes.
So it falls through to the catch-all 500 response.

### Problem B: Client sending Content-Type: application/json on DELETE with no body
When a DELETE request is sent with `Content-Type: application/json` header but no body,
Fastify's JSON parser throws `FST_ERR_CTP_EMPTY_JSON_BODY`.

This is a real-world scenario — many HTTP clients (fetch, axios) set Content-Type
automatically. The server MUST handle this gracefully.

## Fix Plan

### Fix 1: Update global error handler in server.ts
Add handling for Fastify errors that have a `statusCode` property.
This catches `FST_ERR_CTP_EMPTY_JSON_BODY` (400) and any other Fastify-native errors.

### Fix 2: No route changes needed
The routes themselves are correct. The issue is purely in the global error handler.

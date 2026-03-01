/**
 * Phase 6 — Production Hardening: Performance & Load Audit Harness
 * 
 * Uses Fastify inject() — no network overhead.
 * NODE_ENV=test to suppress Fastify logging.
 * Measurement only — no code changes.
 */
process.env.NODE_ENV = 'test';

import { buildServer } from '../packages/kernel/src/server.js';
import { adminSql } from '../packages/kernel/src/db/connection.js';
import { writeFileSync } from 'fs';

/* ─── Types ─── */
interface LatencyResult {
  label: string;
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
  errorRate: number;
  errors: number;
  rps: number;
  totalMs: number;
}

interface SystemMetrics {
  cpuUserUs: number;
  cpuSystemUs: number;
  rssStartMB: number;
  rssEndMB: number;
  heapStartMB: number;
  heapEndMB: number;
  rssDeltaMB: number;
  heapDeltaMB: number;
}

/* ─── Helpers ─── */
function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(label: string, latencies: number[], errors: number, totalMs: number): LatencyResult {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    label,
    count: latencies.length,
    p50: +percentile(sorted, 50).toFixed(2),
    p95: +percentile(sorted, 95).toFixed(2),
    p99: +percentile(sorted, 99).toFixed(2),
    min: +(sorted[0] ?? 0).toFixed(2),
    max: +(sorted[sorted.length - 1] ?? 0).toFixed(2),
    mean: +(sum / latencies.length).toFixed(2),
    errorRate: +((errors / latencies.length) * 100).toFixed(2),
    errors,
    rps: +(latencies.length / (totalMs / 1000)).toFixed(1),
    totalMs: +totalMs.toFixed(0),
  };
}

function snap(): { rss: number; heap: number; cpuUser: number; cpuSystem: number } {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  return { rss: mem.rss, heap: mem.heapUsed, cpuUser: cpu.user, cpuSystem: cpu.system };
}

function sysMetrics(m0: ReturnType<typeof snap>, m1: ReturnType<typeof snap>): SystemMetrics {
  const MB = 1024 * 1024;
  return {
    cpuUserUs: m1.cpuUser - m0.cpuUser,
    cpuSystemUs: m1.cpuSystem - m0.cpuSystem,
    rssStartMB: +(m0.rss / MB).toFixed(1),
    rssEndMB: +(m1.rss / MB).toFixed(1),
    heapStartMB: +(m0.heap / MB).toFixed(1),
    heapEndMB: +(m1.heap / MB).toFixed(1),
    rssDeltaMB: +((m1.rss - m0.rss) / MB).toFixed(1),
    heapDeltaMB: +((m1.heap - m0.heap) / MB).toFixed(1),
  };
}

/* ─── Sequential runner ─── */
async function runSeq(
  label: string, count: number, fn: () => Promise<{ statusCode: number }>,
): Promise<LatencyResult> {
  const lats: number[] = [];
  let errs = 0;
  for (let i = 0; i < Math.min(5, count); i++) await fn(); // warmup
  const start = performance.now();
  for (let i = 0; i < count; i++) {
    const t0 = performance.now();
    const res = await fn();
    lats.push(performance.now() - t0);
    if (res.statusCode >= 400) errs++;
  }
  return computeStats(label, lats, errs, performance.now() - start);
}

/* ─── Concurrent runner ─── */
async function runConc(
  label: string, concurrency: number, totalReqs: number,
  fn: () => Promise<{ statusCode: number }>,
): Promise<LatencyResult> {
  const lats: number[] = [];
  let errs = 0;
  let idx = 0;
  const start = performance.now();
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= totalReqs) break;
      const t0 = performance.now();
      try {
        const res = await fn();
        lats.push(performance.now() - t0);
        if (res.statusCode >= 400) errs++;
      } catch {
        lats.push(performance.now() - t0);
        errs++;
      }
    }
  });
  await Promise.all(workers);
  return computeStats(label, lats, errs, performance.now() - start);
}

/* ─── Main ─── */
async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Phase 6 — Performance & Load Audit (Post-Fix)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const app = await buildServer();
  const results: LatencyResult[] = [];
  const sys: Record<string, SystemMetrics> = {};

  // Auth
  const loginRes = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  const token = JSON.parse(loginRes.body).data.token.access_token;
  const H = { authorization: `Bearer ${token}` };

  // ── Seed data for benchmarks ──
  console.log('Seeding benchmark data...');
  await app.inject({ method: 'POST', url: '/api/v1/backup/policies', headers: H,
    payload: { name: 'bench-policy-2', retention_days: 30, strategy: 'full', is_active: true } });
  for (let i = 0; i < 20; i++) {
    await app.inject({ method: 'POST', url: '/api/v1/search/index', headers: H,
      payload: { object_type: 'document', object_id: `00000000-0000-0000-0000-0000000000${String(i + 50).padStart(2, '0')}`,
        title: `Benchmark Doc ${i}`, content: `Performance testing document ${i} alpha beta gamma search terms`, module: 'benchmark' } });
  }
  await app.inject({ method: 'POST', url: '/api/v1/semantic/models', headers: H,
    payload: { name: 'bench-model-2', description: 'Benchmark', source_table: 'kernel.users', status: 'draft' } });
  await app.inject({ method: 'POST', url: '/api/v1/ai/rag/sources', headers: H,
    payload: { name: 'bench-rag-2', source_type: 'document', config: { path: '/bench' }, status: 'active' } });
  console.log('Seeding complete.\n');

  // ══════════════════════════════════════════════════════════════
  //  BENCHMARK 1: K3 executeAction latency (sequential)
  // ══════════════════════════════════════════════════════════════
  console.log('▶ BENCHMARK 1: K3 executeAction latency (sequential)\n');

  const readFn = () => app.inject({ method: 'GET', url: '/api/v1/backup/policies', headers: H });

  for (const n of [100, 1000, 5000]) {
    const m0 = snap();
    const r = await runSeq(`K3 Read (${n})`, n, readFn);
    const m1 = snap();
    results.push(r);
    sys[r.label] = sysMetrics(m0, m1);
    console.log(`  ✓ ${r.label}: p50=${r.p50}ms p95=${r.p95}ms p99=${r.p99}ms rps=${r.rps} err=${r.errors}`);
  }

  const writeFn = async () => {
    const r = await app.inject({ method: 'POST', url: '/api/v1/billing/plans', headers: H,
      payload: { name: `bp-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, slug: `bp-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, tier: 'starter', max_users: 10, max_storage_mb: 1000, max_api_calls_per_month: 10000, is_active: true, features: {} } });
    const id = JSON.parse(r.body).data?.id;
    if (id) await app.inject({ method: 'DELETE', url: `/api/v1/billing/plans/${id}`, headers: H });
    return r;
  };

  for (const n of [100, 1000, 5000]) {
    const m0 = snap();
    const r = await runSeq(`K3 Write (${n})`, n, writeFn);
    const m1 = snap();
    results.push(r);
    sys[r.label] = sysMetrics(m0, m1);
    console.log(`  ✓ ${r.label}: p50=${r.p50}ms p95=${r.p95}ms p99=${r.p99}ms rps=${r.rps} err=${r.errors}`);
  }

  // ══════════════════════════════════════════════════════════════
  //  BENCHMARK 2: Semantic query path (concurrent)
  //  Reduced total requests per tier to fit sandbox timeout
  // ══════════════════════════════════════════════════════════════
  console.log('\n▶ BENCHMARK 2: Semantic query path (concurrent)\n');

  const semFn = () => app.inject({ method: 'GET', url: '/api/v1/semantic/models', headers: H });

  for (const [c, total] of [[50, 500], [100, 1000], [200, 2000]] as const) {
    const m0 = snap();
    const r = await runConc(`Semantic (${c} conc, ${total} reqs)`, c, total, semFn);
    const m1 = snap();
    results.push(r);
    sys[r.label] = sysMetrics(m0, m1);
    console.log(`  ✓ ${r.label}: p50=${r.p50}ms p95=${r.p95}ms p99=${r.p99}ms rps=${r.rps} err%=${r.errorRate}`);
  }

  // ══════════════════════════════════════════════════════════════
  //  BENCHMARK 3: Search full-text query (concurrent)
  // ══════════════════════════════════════════════════════════════
  console.log('\n▶ BENCHMARK 3: Search full-text query (concurrent)\n');

  const searchFn = () => app.inject({ method: 'GET', url: '/api/v1/search?q=benchmark+alpha&limit=10', headers: H });

  for (const [c, total] of [[50, 500], [100, 1000], [200, 2000]] as const) {
    const m0 = snap();
    const r = await runConc(`Search FTS (${c} conc, ${total} reqs)`, c, total, searchFn);
    const m1 = snap();
    results.push(r);
    sys[r.label] = sysMetrics(m0, m1);
    console.log(`  ✓ ${r.label}: p50=${r.p50}ms p95=${r.p95}ms p99=${r.p99}ms rps=${r.rps} err%=${r.errorRate}`);
  }

  // ══════════════════════════════════════════════════════════════
  //  BENCHMARK 4: RAG retrieval path (concurrent)
  // ══════════════════════════════════════════════════════════════
  console.log('\n▶ BENCHMARK 4: RAG retrieval path (concurrent)\n');

  const ragFn = () => app.inject({ method: 'POST', url: '/api/v1/ai/rag/retrieve', headers: H,
    payload: { query: 'benchmark performance test', top_k: 5 } });

  for (const [c, total] of [[50, 500], [100, 1000], [200, 2000]] as const) {
    const m0 = snap();
    const r = await runConc(`RAG Retrieve (${c} conc, ${total} reqs)`, c, total, ragFn);
    const m1 = snap();
    results.push(r);
    sys[r.label] = sysMetrics(m0, m1);
    console.log(`  ✓ ${r.label}: p50=${r.p50}ms p95=${r.p95}ms p99=${r.p99}ms rps=${r.rps} err%=${r.errorRate}`);
  }

  // ══════════════════════════════════════════════════════════════
  //  BENCHMARK 5: Memory session insert stress
  //  Reduced to 50 sessions × 100 entries = 5000 total
  // ══════════════════════════════════════════════════════════════
  console.log('\n▶ BENCHMARK 5: Memory session insert stress\n');

  const SESSIONS = 50;
  const ENTRIES_PER = 50;
  const sessionIds: string[] = [];
  for (let i = 0; i < SESSIONS; i++) {
    const r = await app.inject({ method: 'POST', url: '/api/v1/ai/memory/sessions', headers: H,
      payload: { label: `stress-v2-${i}`, session_type: 'conversation', config: {} } });
    const id = JSON.parse(r.body).data?.id;
    if (id) sessionIds.push(id);
  }
  console.log(`  Created ${sessionIds.length} sessions`);

  let entryIdx = 0;
  const memInsertFn = () => {
    const sid = sessionIds[entryIdx % sessionIds.length];
    entryIdx++;
    return app.inject({ method: 'POST', url: `/api/v1/ai/memory/sessions/${sid}/entries`, headers: H,
      payload: { session_id: sid, role: 'user', content: { text: `Stress entry ${entryIdx} for memory benchmarking` } } });
  };

  const totalInserts = SESSIONS * ENTRIES_PER;
  const m0mem = snap();
  const memR = await runConc(`Memory Insert (${SESSIONS}×${ENTRIES_PER}=${totalInserts})`, SESSIONS, totalInserts, memInsertFn);
  const m1mem = snap();
  results.push(memR);
  sys[memR.label] = sysMetrics(m0mem, m1mem);
  console.log(`  ✓ ${memR.label}: p50=${memR.p50}ms p95=${memR.p95}ms p99=${memR.p99}ms rps=${memR.rps} err%=${memR.errorRate}`);

  // ══════════════════════════════════════════════════════════════
  //  BENCHMARK 6: DB Diagnostics
  // ══════════════════════════════════════════════════════════════
  console.log('\n▶ BENCHMARK 6: DB Diagnostics\n');

  let pgStatAvailable = false;
  try { await adminSql`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`; pgStatAvailable = true; } catch {}

  const tableSizes = await adminSql`
    SELECT schemaname || '.' || relname AS table_name,
           pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
           pg_total_relation_size(relid) AS size_bytes,
           n_live_tup AS row_count
    FROM pg_stat_user_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema','public')
    ORDER BY pg_total_relation_size(relid) DESC LIMIT 20`;

  console.log('  Top tables by size:');
  for (const t of tableSizes) console.log(`    ${t.table_name}: ${t.total_size} (${t.row_count} rows)`);

  const seqScans = await adminSql`
    SELECT schemaname || '.' || relname AS table_name,
           seq_scan, seq_tup_read, idx_scan,
           CASE WHEN seq_scan + idx_scan > 0
                THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 1)
                ELSE 0 END AS seq_pct
    FROM pg_stat_user_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema','public')
      AND seq_scan + idx_scan > 0
    ORDER BY seq_tup_read DESC LIMIT 15`;

  console.log('\n  Tables with high seq scan ratio:');
  for (const s of seqScans) console.log(`    ${s.table_name}: seq=${s.seq_scan} idx=${s.idx_scan} seq%=${s.seq_pct}%`);

  let slowQueries: any[] = [];
  if (pgStatAvailable) {
    try {
      slowQueries = await adminSql`
        SELECT query, calls, mean_exec_time::numeric(10,2) AS mean_ms,
               max_exec_time::numeric(10,2) AS max_ms,
               total_exec_time::numeric(10,2) AS total_ms, rows
        FROM pg_stat_statements
        WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        ORDER BY mean_exec_time DESC LIMIT 10`;
      console.log('\n  Top 10 slowest queries (by mean time):');
      for (const q of slowQueries) {
        const short = (q.query as string).substring(0, 120).replace(/\n/g, ' ');
        console.log(`    [${q.mean_ms}ms avg, ${q.max_ms}ms max, ${q.calls} calls] ${short}`);
      }
    } catch (e) { console.log('  pg_stat_statements query failed:', e); }
  } else {
    console.log('  pg_stat_statements not available');
  }

  const locks = await adminSql`
    SELECT locktype, mode, count(*) AS cnt FROM pg_locks GROUP BY locktype, mode ORDER BY cnt DESC LIMIT 10`;
  console.log('\n  Lock distribution:');
  for (const l of locks) console.log(`    ${l.locktype}/${l.mode}: ${l.cnt}`);

  const connStats = await adminSql`
    SELECT state, count(*) AS cnt FROM pg_stat_activity WHERE datname = current_database() GROUP BY state ORDER BY cnt DESC`;
  console.log('\n  Connection states:');
  for (const c of connStats) console.log(`    ${c.state || 'null'}: ${c.cnt}`);

  const cacheHit = await adminSql`
    SELECT sum(heap_blks_read) AS heap_read, sum(heap_blks_hit) AS heap_hit,
           CASE WHEN sum(heap_blks_hit) + sum(heap_blks_read) > 0
                THEN round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2)
                ELSE 100 END AS ratio
    FROM pg_statio_user_tables`;
  console.log(`\n  Buffer cache hit ratio: ${cacheHit[0].ratio}%`);

  const unusedIdx = await adminSql`
    SELECT schemaname || '.' || relname AS tbl, indexrelname AS idx, idx_scan,
           pg_size_pretty(pg_relation_size(indexrelid)) AS size
    FROM pg_stat_user_indexes
    WHERE schemaname NOT IN ('pg_catalog','information_schema','public')
    ORDER BY idx_scan ASC LIMIT 15`;
  console.log('\n  Least-used indexes:');
  for (const ix of unusedIdx) console.log(`    ${ix.idx} on ${ix.tbl}: ${ix.idx_scan} scans (${ix.size})`);

  const noIdx = await adminSql`
    SELECT s.schemaname || '.' || s.relname AS tbl, s.n_live_tup AS rows,
           count(i.indexrelname) AS idx_count
    FROM pg_stat_user_tables s
    LEFT JOIN pg_stat_user_indexes i ON i.relid = s.relid
    WHERE s.schemaname NOT IN ('pg_catalog','information_schema','public')
    GROUP BY s.schemaname, s.relname, s.n_live_tup
    HAVING count(i.indexrelname) <= 1
    ORDER BY s.n_live_tup DESC`;
  console.log('\n  Tables with only pkey (no secondary indexes):');
  for (const t of noIdx) console.log(`    ${t.tbl}: ${t.rows} rows, ${t.idx_count} index(es)`);

  // ── Write JSON ──
  const report = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: (await import('os')).cpus().length,
      totalMemoryMB: +((await import('os')).totalmem() / 1024 / 1024).toFixed(0),
    },
    benchmarks: results,
    systemMetrics: sys,
    dbDiagnostics: {
      tableSizes: tableSizes.map(t => ({ table: t.table_name, size: t.total_size, rows: t.row_count })),
      seqScans: seqScans.map(s => ({ table: s.table_name, seqScan: s.seq_scan, idxScan: s.idx_scan, seqPct: s.seq_pct })),
      slowQueries: slowQueries.map(q => ({ query: (q.query as string).substring(0, 200), meanMs: q.mean_ms, maxMs: q.max_ms, calls: q.calls, rows: q.rows })),
      cacheHitRatio: cacheHit[0].ratio,
      tablesWithoutSecondaryIndexes: noIdx.map(t => ({ table: t.tbl, rows: t.rows })),
    },
  };

  writeFileSync('/tmp/projects/platform_kit/benchmarks/results.json', JSON.stringify(report, null, 2));
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Results saved to benchmarks/results.json');
  console.log('═══════════════════════════════════════════════════════════════');

  await app.close();
  await adminSql.end();
  process.exit(0);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });

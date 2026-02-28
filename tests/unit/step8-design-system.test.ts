/** K9 — Design System tests */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../../packages/kernel/src/server.js';
import type { FastifyInstance } from 'fastify';
import { reseed } from '../helpers/reseed.js';

let app: FastifyInstance;
let adminToken: string;
let betaToken: string;
let tokenId: string;
let themeId: string;
let componentId: string;

beforeAll(async () => {
  await reseed();
  app = await buildServer();

  // Login as admin@acme.com
  const acmeLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@acme.com', password: 'Admin123!', tenant_slug: 'acme' },
  });
  adminToken = JSON.parse(acmeLogin.body).data.token.access_token;

  // Login as admin@beta.com
  const betaLogin = await app.inject({
    method: 'POST', url: '/api/v1/auth/login',
    payload: { email: 'admin@beta.com', password: 'Admin123!', tenant_slug: 'beta' },
  });
  betaToken = JSON.parse(betaLogin.body).data.token.access_token;
}, 30000);

afterAll(async () => {
  await app?.close();
});

// ═══════════════════════════════════════════════
// ─── Token CRUD ───
// ═══════════════════════════════════════════════

describe('K9 — Token CRUD', () => {
  it('POST /design/tokens → 201 creates token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'color.primary',
        category: 'color',
        value: '#1E40AF',
        description: 'Primary brand color',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('color.primary');
    expect(body.data.category).toBe('color');
    expect(body.data.value).toBe('#1E40AF');
    tokenId = body.data.id;
  });

  it('POST /design/tokens → 201 creates another token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'spacing.base',
        category: 'spacing',
        value: '8px',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('spacing.base');
    expect(body.data.category).toBe('spacing');
  });

  it('GET /design/tokens → lists all tokens', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /design/tokens?category=color → filters by category', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/tokens?category=color',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].category).toBe('color');
  });

  it('GET /design/tokens/:id → returns single token', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/design/tokens/${tokenId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(tokenId);
  });

  it('GET /design/tokens/:id → 404 nonexistent', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/tokens/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('PATCH /design/tokens/:id → updates token', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/design/tokens/${tokenId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { value: '#2563EB', description: 'Updated primary color' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.value).toBe('#2563EB');
    expect(body.data.description).toBe('Updated primary color');
  });

  it('POST /design/tokens → 409 duplicate name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'color.primary',
        category: 'color',
        value: '#FF0000',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('POST /design/tokens → 400 invalid category', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'bad.token',
        category: 'invalid_category',
        value: 'x',
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('no auth → 401', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/tokens',
    });
    expect(res.statusCode).toBe(401);
  });
});

// ═══════════════════════════════════════════════
// ─── Theme CRUD ───
// ═══════════════════════════════════════════════

describe('K9 — Theme CRUD', () => {
  it('POST /design/themes → 201 creates theme', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/themes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'light',
        display_name: 'Light Theme',
        description: 'Default light theme',
        is_default: true,
        token_overrides: { 'color.primary': '#3B82F6' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('light');
    expect(body.data.is_default).toBe(true);
    expect(body.data.status).toBe('draft');
    themeId = body.data.id;
  });

  it('POST /design/themes → 201 creates second theme (unsets previous default)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/themes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'dark',
        display_name: 'Dark Theme',
        is_default: true,
        token_overrides: { 'color.primary': '#1E3A5F' },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.is_default).toBe(true);

    // Verify previous default was unset
    const lightRes = await app.inject({
      method: 'GET', url: `/api/v1/design/themes/${themeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const lightBody = JSON.parse(lightRes.body);
    expect(lightBody.data.is_default).toBe(false);
  });

  it('GET /design/themes → lists all themes', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/themes',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /design/themes/:id → returns single theme', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/design/themes/${themeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(themeId);
  });

  it('PATCH /design/themes/:id → updates theme', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/design/themes/${themeId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { display_name: 'Light Theme v2', status: 'active' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.display_name).toBe('Light Theme v2');
    expect(body.data.status).toBe('active');
  });

  it('POST /design/themes → 409 duplicate name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/themes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'light',
        display_name: 'Duplicate',
      },
    });
    expect(res.statusCode).toBe(409);
  });

  it('GET /design/themes/:id/resolve → resolves tokens with overrides', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/design/themes/${themeId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.theme_id).toBe(themeId);
    expect(body.data.theme_name).toBe('light');
    // Override should take precedence over base token
    expect(body.data.tokens['color.primary']).toBe('#3B82F6');
    // Base token should be present
    expect(body.data.tokens['spacing.base']).toBe('8px');
  });
});

// ═══════════════════════════════════════════════
// ─── Component CRUD ───
// ═══════════════════════════════════════════════

describe('K9 — Component CRUD', () => {
  it('POST /design/components → 201 creates component', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/components',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'button',
        display_name: 'Button',
        description: 'Standard button component',
        category: 'input',
        variants: {
          primary: { bg: 'color.primary', text: '#FFFFFF' },
          secondary: { bg: '#E5E7EB', text: '#374151' },
        },
        default_props: { size: 'md', disabled: false },
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe('button');
    expect(body.data.category).toBe('input');
    expect(body.data.status).toBe('draft');
    expect(body.data.variants).toHaveProperty('primary');
    componentId = body.data.id;
  });

  it('POST /design/components → 201 creates another component', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/components',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'card',
        display_name: 'Card',
        category: 'layout',
        variants: { elevated: { shadow: 'shadow.md' }, flat: { shadow: 'none' } },
      },
    });
    expect(res.statusCode).toBe(201);
  });

  it('GET /design/components → lists all components', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/components',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /design/components?category=input → filters by category', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/components?category=input',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.length).toBe(1);
    expect(body.data[0].name).toBe('button');
  });

  it('GET /design/components/:id → returns single component', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/design/components/${componentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.id).toBe(componentId);
  });

  it('PATCH /design/components/:id → updates component', async () => {
    const res = await app.inject({
      method: 'PATCH', url: `/api/v1/design/components/${componentId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        display_name: 'Button v2',
        status: 'active',
        default_props: { size: 'lg', disabled: false },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.display_name).toBe('Button v2');
    expect(body.data.status).toBe('active');
    expect(body.data.default_props).toEqual({ size: 'lg', disabled: false });
  });

  it('POST /design/components → 409 duplicate name', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/design/components',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'button',
        display_name: 'Duplicate',
        category: 'input',
      },
    });
    expect(res.statusCode).toBe(409);
  });
});

// ═══════════════════════════════════════════════
// ─── Tenant Isolation ───
// ═══════════════════════════════════════════════

describe('K9 — Tenant Isolation', () => {
  it('Beta cannot see Acme tokens', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const acmeTokens = body.data.filter((t: { name: string }) => t.name === 'color.primary');
    expect(acmeTokens.length).toBe(0);
  });

  it('Beta cannot see Acme themes', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/themes',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const acmeThemes = body.data.filter((t: { name: string }) => t.name === 'light');
    expect(acmeThemes.length).toBe(0);
  });

  it('Beta cannot see Acme components', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/design/components',
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    const acmeComponents = body.data.filter((c: { name: string }) => c.name === 'button');
    expect(acmeComponents.length).toBe(0);
  });

  it('Beta cannot access Acme token by ID', async () => {
    const res = await app.inject({
      method: 'GET', url: `/api/v1/design/tokens/${tokenId}`,
      headers: { authorization: `Bearer ${betaToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ═══════════════════════════════════════════════
// ─── Deletion ───
// ═══════════════════════════════════════════════

describe('K9 — Deletion', () => {
  it('DELETE /design/tokens/:id → 204', async () => {
    // Create a token to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/design/tokens',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'to_delete_token', category: 'opacity', value: '0.5' },
    });
    const delId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/design/tokens/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/design/tokens/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /design/tokens/:id → 404 nonexistent', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/design/tokens/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /design/themes/:id → 204', async () => {
    // Create a theme to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/design/themes',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'to_delete_theme', display_name: 'To Delete' },
    });
    const delId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/design/themes/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/design/themes/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /design/components/:id → 204', async () => {
    // Create a component to delete
    const createRes = await app.inject({
      method: 'POST', url: '/api/v1/design/components',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { name: 'to_delete_comp', display_name: 'To Delete', category: 'misc' },
    });
    const delId = JSON.parse(createRes.body).data.id;

    const res = await app.inject({
      method: 'DELETE', url: `/api/v1/design/components/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(204);

    // Verify gone
    const getRes = await app.inject({
      method: 'GET', url: `/api/v1/design/components/${delId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('DELETE /design/components/:id → 404 nonexistent', async () => {
    const res = await app.inject({
      method: 'DELETE', url: '/api/v1/design/components/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

import pino from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import type { OfferUpProvider } from '../../src/provider/types.js';
import { UnavailableOfferUpProvider } from '../../src/provider/unavailable.js';
import { createHttpServer } from '../../src/server/http.js';
import { createServices } from '../../src/services/index.js';
import { createToolRegistry } from '../../src/tools/registry.js';
import { testConfig } from '../helpers/config.js';

const servers: ReturnType<typeof createHttpServer>[] = [];
const apiKey = 'test-api-key-that-is-at-least-32-characters';

const server = (
  overrides: Record<string, unknown> = {},
  provider: OfferUpProvider = new UnavailableOfferUpProvider(),
) => {
  const config = testConfig(overrides);
  const app = createHttpServer({
    config,
    logger: pino({ level: 'silent' }),
    services: createServices(provider),
    registry: createToolRegistry(),
  });
  servers.push(app);
  return app;
};

afterEach(async () => Promise.all(servers.splice(0).map((app) => app.close())));

describe('HTTP API', () => {
  it('separates process health from provider availability', async () => {
    const response = await server().inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      checks: { process: 'healthy', deployment: 'ready', provider: 'unavailable' },
      provider: { configured: false, marketplaceCapabilitiesAvailable: false },
    });
  });

  it('reports truthful capabilities and request IDs', async () => {
    const response = await server().inject({
      method: 'GET',
      url: '/version',
      headers: { 'x-request-id': 'caller-id' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBe('caller-id');
    expect(response.json().capabilities).toMatchObject({
      tools: ['offerup_integration_status'],
      marketplaceOperations: [],
      mutationsAvailable: false,
      provider: { status: 'unavailable', configured: false },
    });
    const generated = await server().inject({
      method: 'GET',
      url: '/version',
      headers: { 'x-request-id': 'x'.repeat(201) },
    });
    expect(generated.headers['x-request-id']).not.toBe('x'.repeat(201));
  });

  it('authenticates tool and MCP routes without exposing credentials', async () => {
    expect((await server().inject({ method: 'GET', url: '/tools' })).statusCode).toBe(401);
    expect(
      (
        await server().inject({
          method: 'GET',
          url: '/tools',
          headers: { authorization: ['Bearer', 'wrong-key'].join(' ') },
        })
      ).statusCode,
    ).toBe(401);
    const response = await server().inject({
      method: 'GET',
      url: '/tools',
      headers: { authorization: ['Bearer', apiKey].join(' ') },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ tools: Array<{ name: string }> }>();
    expect(body.tools.map((tool) => tool.name)).toEqual(['offerup_integration_status']);
    expect(response.body).not.toContain(apiKey);
  });

  it('invokes only the integration-status tool and maps errors safely', async () => {
    const success = await server().inject({
      method: 'POST',
      url: '/tools/offerup_integration_status',
      headers: { 'x-api-key': apiKey },
      payload: {},
    });
    expect(success.statusCode).toBe(200);
    expect(success.json().result.status).toBe('unavailable');

    const missing = await server().inject({
      method: 'POST',
      url: '/tools/offerup_search_listings',
      headers: { 'x-api-key': apiKey },
      payload: {},
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe('not_found');

    const failingProvider: OfferUpProvider = {
      getAvailability: () => Promise.reject(new Error('private upstream detail')),
    };
    const failed = await server({ NODE_ENV: 'production' }, failingProvider).inject({
      method: 'POST',
      url: '/tools/offerup_integration_status',
      headers: { 'x-api-key': apiKey },
      payload: {},
    });
    expect(failed.statusCode).toBe(500);
    expect(failed.body).not.toContain('private upstream detail');
  });

  it('rate limits authenticated and unauthenticated callers', async () => {
    const unauthenticated = server({ RATE_LIMIT_MAX: 1 });
    expect((await unauthenticated.inject({ method: 'GET', url: '/tools' })).statusCode).toBe(401);
    expect((await unauthenticated.inject({ method: 'GET', url: '/tools' })).statusCode).toBe(401);
    expect((await unauthenticated.inject({ method: 'GET', url: '/tools' })).statusCode).toBe(429);

    const authenticated = server({ RATE_LIMIT_MAX: 1 });
    expect(
      (
        await authenticated.inject({
          method: 'GET',
          url: '/tools',
          headers: { 'x-api-key': apiKey },
        })
      ).statusCode,
    ).toBe(200);
    const limited = await authenticated.inject({
      method: 'GET',
      url: '/tools',
      headers: { 'x-api-key': apiKey },
    });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('supports disabled authentication only outside production', async () => {
    expect(
      (
        await server({ AUTH_MODE: 'disabled' }).inject({
          method: 'GET',
          url: '/tools',
        })
      ).statusCode,
    ).toBe(200);
  });

  it('serves complete OpenAPI without marketplace operations', async () => {
    const response = await server().inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);
    const document = response.json<{
      openapi: string;
      paths: Record<string, unknown>;
    }>();
    expect(document.openapi).toBe('3.1.0');
    expect(document.paths['/tools/offerup_integration_status']).toBeDefined();
    expect(document.paths['/tools/offerup_search_listings']).toBeUndefined();
    expect(document.paths['/mcp']).toBeDefined();
  });

  it('serves stateless Streamable HTTP MCP', async () => {
    const response = await server().inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        'x-api-key': apiKey,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"serverInfo"');
  });
});

# OfferUp Agent Tool Server

An integration-ready, self-hosted member of the `agent-tool-server` family. It provides typed
HTTP, OpenAPI, stdio MCP, and stateless Streamable HTTP MCP interfaces while making no
unauthorized OfferUp marketplace requests.

This independent project is not affiliated with, endorsed by, or sponsored by OfferUp.

## Current integration status

**Provider unavailable (Outcome B).** Research performed on 2026-08-11 did not find a public,
self-service OfferUp API that authorizes third parties to search or retrieve marketplace
listings.

Official sources reviewed:

- [OfferUp Terms of Service](https://offerup.com/terms) describe restrictions on unauthorized
  automated access.
- [OfferUp Partner Program Terms](https://about.offerup.com/partnerterms) describe private
  partner connectors governed by an agreement and partner-specific technical requirements.
- [OfferUp Shopify integration](https://business.offerup.com/storefronts/integrations/shopify)
  documents a business seller inventory integration, not a public marketplace search API.
- [OfferUp Automotive Advertising Service Terms](https://about.offerup.com/autos-terms/) and
  [Reseller Dealer Terms](https://about.offerup.com/reseller-dealer-terms/) cover gated,
  vertical-specific business programs rather than general listing retrieval.

The project therefore does not scrape pages, automate the consumer site or app, call private
endpoints, reverse-engineer APIs, or bypass access controls. It does not invent endpoints,
credentials, or marketplace results.

## Available capability

The sole tool is:

| Tool                         | Classification                           | Result                                                                                                   |
| ---------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `offerup_integration_status` | Read-only server/integration information | Reports that the provider and marketplace capabilities are unavailable and lists enablement requirements |

No listing search, listing retrieval, messaging, purchasing, posting, account, or mutation tool
is registered. `/tools`, OpenAPI, and both MCP transports are generated from the same typed tool
registry and cannot advertise absent operations.

## Health meanings

These states are intentionally distinct:

- **Process health:** `/health.status=ok` and `checks.process=healthy` mean this process can serve.
- **Deployment health:** `checks.deployment=ready` means the instance is ready for traffic; Azure
  liveness and readiness probes use this endpoint.
- **Provider availability:** `checks.provider=unavailable` means no authorized provider adapter is
  configured.
- **Marketplace capability availability:** `provider.marketplaceCapabilitiesAvailable=false`
  means the server cannot access OfferUp marketplace data.

Provider unavailability does not make the server process unhealthy.

## Architecture

```text
HTTP / OpenAPI ─┐
HTTP MCP ───────┼─> typed ToolRegistry ─> IntegrationService ─> OfferUpProvider port
stdio MCP ──────┘                                      └──────> unavailable adapter
```

- Node.js 22, strict TypeScript, Fastify, Zod, Pino, and the official MCP TypeScript SDK.
- Zod validates every tool input and output; JSON Schema is derived from those schemas.
- Provider types contain no transport or future SDK-specific types.
- The unavailable adapter has no marketplace methods.
- The HTTP MCP route creates and closes a stateless transport per request.

## Interfaces

| Interface            | Route/entry point               | Authentication         |
| -------------------- | ------------------------------- | ---------------------- |
| Health               | `GET /health`                   | Public                 |
| Version/capabilities | `GET /version`                  | Public                 |
| OpenAPI 3.1          | `GET /openapi.json`             | Public                 |
| Tool discovery       | `GET /tools`                    | Hosted auth            |
| Tool invocation      | `POST /tools/{toolName}`        | Hosted auth            |
| Streamable HTTP MCP  | `POST /mcp`                     | Hosted auth            |
| Local MCP            | `npm run mcp:stdio` after build | Local process boundary |

`GET` and `DELETE /mcp` are also wired for protocol compatibility. There is no server-side MCP
session or credential store.

## Authentication and security

Hosted routes accept an API key through either the standard bearer-token authentication scheme
or the `x-api-key` header.
API keys must
be at least 32 characters. Comparisons use fixed-size keyed digests and constant-time comparison.
Credentials and authorization headers are redacted from structured logs and are never persisted.

Production startup rejects `AUTH_MODE=disabled`. Disabled auth exists only for local development
and stdio. Requests have configurable body, duration, and fixed-window rate bounds. Protected
routes apply pre-auth IP rate limiting and post-auth principal rate limiting. Caller request IDs
are accepted only up to 200 characters; every response returns an `x-request-id`. Public errors
exclude stack traces and production 5xx details. The container runs as the non-root `node` user.

The in-process rate limiter is per replica, not a global distributed quota. Use an API gateway
when a deployment needs a cross-replica quota.

## Configuration

Copy `.env.example`; it contains names and safe empty placeholders only.

| Variable                      | Required          | Default                     | Purpose                                      |
| ----------------------------- | ----------------- | --------------------------- | -------------------------------------------- |
| `NODE_ENV`                    | No                | `development`               | `development`, `test`, or `production`       |
| `PORT` / `HOST`               | No                | `8080` / `0.0.0.0`          | Listener                                     |
| `LOG_LEVEL`                   | No                | `info`                      | Structured log level                         |
| `SERVICE_NAME`                | No                | `agent-tool-server-offerup` | Service identity                             |
| `SERVICE_VERSION` / `GIT_SHA` | No                | development values          | Build metadata                               |
| `PUBLIC_BASE_URL`             | No                | unset                       | OpenAPI server URL                           |
| `AUTH_MODE`                   | Hosted            | `api-key`                   | `api-key` or non-production `disabled`       |
| `API_KEYS`                    | With API-key auth | unset                       | Comma-separated secrets, each 32+ characters |
| `RATE_LIMIT_MAX`              | No                | `120`                       | Requests per window; `0` disables locally    |
| `RATE_LIMIT_WINDOW_MS`        | No                | `60000`                     | Rate window                                  |
| `REQUEST_TIMEOUT_MS`          | No                | `15000`                     | HTTP request timeout, max 120 seconds        |
| `BODY_LIMIT_BYTES`            | No                | `262144`                    | Request body limit, max 1 MB                 |

Blank optional variables are removed before validation.

There are no OfferUp credential variables because no authorized provider contract is implemented.

## Local development

```bash
npm ci
cp .env.example .env
AUTH_MODE=disabled npm run dev
```

Build and run stdio MCP:

```bash
npm run build
npm run mcp:stdio
```

For hosted local testing, set `AUTH_MODE=api-key` and provide a random key of at least 32
characters in `API_KEYS`.

## Container

```bash
docker build -t agent-tool-server-offerup:local .
docker run --rm -p 8080:8080 \
  -e API_KEYS='use-a-random-secret-with-at-least-32-characters' \
  agent-tool-server-offerup:local
```

The multi-stage Node 22 Alpine image installs from the lockfile, removes development
dependencies, includes a health check, and runs as `node`.

## Azure Container Apps

`infra/` provides subscription-scope Bicep for:

- a user-assigned managed identity;
- an admin-disabled Basic Azure Container Registry and least-privilege `AcrPull`;
- an RBAC-enabled Key Vault with purge protection and identity-based secret references;
- Log Analytics and workspace-based Application Insights;
- TLS-only external Container Apps ingress;
- 0.25 vCPU, 0.5 GiB, single-revision deployment, liveness/readiness probes, and scale-to-zero;
- optional availability monitoring/alert configuration.

`scripts/bootstrap/provision.sh` performs two idempotent passes: provision prerequisites, place the
generated or caller-supplied API key in Key Vault, build the image, resolve its digest, then deploy
the app using an immutable `@sha256:` reference. It does not print the key or embed credentials in
files. Review [docs/deployment.md](docs/deployment.md) before running it.

No Azure deployment has been performed by this repository. Scale-to-zero minimizes idle compute
but the registry, Key Vault, Log Analytics, and Application Insights can still incur cost.

## Monitoring

Pino emits JSON logs with request IDs and tool event names. Azure routes container logs to Log
Analytics and provisions Application Insights. `/health` is suitable for platform probes and an
external availability test. Alerts should target process/deployment failure; provider
`unavailable` is the expected current business status, not an outage.

## Testing and validation

Tests use mocks, Fastify injection, an in-memory MCP transport, and a spawned stdio MCP process.
They never contact OfferUp or require live credentials.

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run openapi:emit
npm run metadata:validate
```

CI additionally builds and smoke-tests the non-root container, builds/lints Bicep, audits
dependencies, reviews dependency changes, scans secrets, and runs CodeQL.

## Metadata and registration

`server.json` follows the official MCP Registry schema and deliberately contains empty `packages`
and `remotes`: no npm package or stable hosted endpoint is published. The local source still
implements stdio and Streamable HTTP transports.

`examples/central-registry-entry.json` is the prepared artifact for
`ashergarland/agent-tool-server-registry`. After this repository merges:

1. update `entries/agent-tool-server-offerup.json` in a separate registry PR from that artifact;
2. set `provenance.lastVerifiedCommit` to the merged 40-character commit;
3. run the registry's `npm run catalog:generate`, `npm run verify`, and `npm run verify:online`;
4. commit the regenerated `catalog.json`.

Do not add npm, container, official MCP Registry, Docker catalog, hosted endpoint, or active
provider claims until each is independently published and verified.

## Enabling a provider later

Implementation can proceed only after OfferUp supplies:

1. a written agreement authorizing the exact use case;
2. official API base URL, versioned documentation, and permitted operations;
3. documented authentication flow, scopes, quotas, timeout, and pagination rules;
4. sandbox credentials and representative response schemas;
5. data retention, privacy, logging, attribution, and branding requirements.

Then add the narrowest read-only provider method, validate upstream responses, cap pagination and
results, map timeouts and upstream errors safely, use mock fixtures in tests, and update discovery
and metadata only for verified capabilities.

## Known limitations

- No OfferUp marketplace capability is available.
- No hosted endpoint, package publication, or container publication exists.
- Rate limiting is in-memory per replica.
- Provider status is static until an authorized adapter is implemented.
- The infrastructure is supplied for validation and deployment; it is not deployed automatically.

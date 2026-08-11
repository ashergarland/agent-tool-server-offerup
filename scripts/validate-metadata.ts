import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const repositoryUrl = z.literal(
  'https://github.com/ashergarland/agent-tool-server-offerup',
);
const serverSchema = z
  .object({
    $schema: z.literal(
      'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
    ),
    name: z.literal('io.github.ashergarland/agent-tool-server-offerup'),
    description: z.string().min(3).max(200),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    repository: z.object({ url: repositoryUrl, source: z.literal('github') }),
    packages: z.array(z.never()).max(0),
    remotes: z.array(z.never()).max(0),
  })
  .strict();

const claim = z.union([z.boolean(), z.literal('not-documented')]);
const registrySchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    id: z.literal('agent-tool-server-offerup'),
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(300),
    lifecycle: z.enum(['planned', 'development', 'active', 'deprecated', 'archived']),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    repository: repositoryUrl,
    license: z.string().min(1),
    maintainer: z.string().regex(/^@[A-Za-z0-9]/),
    categories: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string().min(1)).min(1),
    interfaces: z.object({
      transports: z.array(z.enum(['stdio', 'streamable-http', 'openapi-http'])).min(1),
      hosting: z.enum(['self-hosted', 'hosted', 'planned', 'unavailable']),
      authentication: z
        .array(
          z.enum([
            'api-key',
            'bearer-token',
            'entra-jwt',
            'managed-identity',
            'oauth2',
            'none',
          ]),
        )
        .min(1),
      requiredConfiguration: z.array(
        z.object({
          name: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
          required: z.boolean(),
          secret: z.boolean(),
          description: z.string().min(1),
        }),
      ),
    }),
    capabilities: z.object({
      tools: z.array(
        z.object({
          name: z.string().regex(/^[a-z][a-z0-9_]*$/),
          summary: z.string().min(1).max(200),
          safety: z.enum(['low', 'moderate', 'high']),
          behavior: z.enum(['read-only', 'mutation']),
          consequential: z.boolean(),
          availability: z.enum(['available', 'planned', 'blocked', 'unavailable']),
          notes: z.string().optional(),
        }),
      ),
    }),
    operations: z.object({
      leastPrivilege: claim,
      scopeAllowLists: claim,
      mutationsDisabledByDefault: claim,
      explicitMutationConfirmation: claim,
      dryRun: claim,
      auditLogging: claim,
      credentialPersistence: z.enum([
        'none',
        'memory-only',
        'external-store',
        'not-documented',
      ]),
      inputValidation: claim,
      outputValidation: claim,
      rateLimiting: claim,
      healthMonitoring: claim,
    }),
    provenance: z.object({
      sourceMetadata: z.object({
        kind: z.enum(['server-json', 'readme', 'repository']),
        location: z.string().min(1),
      }),
      reviewStatus: z.enum(['pending', 'reviewed', 'mismatch', 'blocked']),
      notes: z.array(z.string().min(1)).min(1),
    }),
  })
  .strict();

const load = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, 'utf8'));

const server = serverSchema.parse(await load('server.json'));
const registry = registrySchema.parse(await load('examples/central-registry-entry.json'));
if (server.version !== registry.version) throw new Error('Metadata versions do not match');

process.stdout.write('Metadata is valid and contains no publication or hosted endpoint claims.\n');

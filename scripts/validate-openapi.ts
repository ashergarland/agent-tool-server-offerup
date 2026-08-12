import { readFile } from 'node:fs/promises';
import { z } from 'zod';

const operation = z.object({
  operationId: z.string().min(1),
  summary: z.string().min(1),
  responses: z.record(z.string(), z.unknown()),
});
const pathItem = z.object({ get: operation.optional(), post: operation.optional() });
const documentSchema = z.object({
  openapi: z.literal('3.1.0'),
  info: z.object({
    title: z.literal('OfferUp Agent Tool Server'),
    version: z.string().min(1),
    description: z.string().min(1),
  }),
  servers: z.array(z.object({ url: z.url() })).min(1),
  security: z.array(z.record(z.string(), z.array(z.string()))),
  components: z.object({
    schemas: z.object({ Error: z.record(z.string(), z.unknown()) }),
    securitySchemes: z.object({ bearerAuth: z.record(z.string(), z.unknown()) }),
  }),
  paths: z.record(z.string(), pathItem),
});

const path = process.argv[2] ?? 'openapi.json';
const document = documentSchema.parse(JSON.parse(await readFile(path, 'utf8')));
const requiredPaths = [
  '/health',
  '/version',
  '/openapi.json',
  '/tools',
  '/tools/offerup_integration_status',
  '/mcp',
];
for (const requiredPath of requiredPaths) {
  if (!(requiredPath in document.paths)) throw new Error(`Missing OpenAPI path: ${requiredPath}`);
}
if (Object.keys(document.paths).some((value) => /listing|message|purchase|post/i.test(value))) {
  throw new Error('OpenAPI advertises an unavailable marketplace operation');
}

process.stdout.write('OpenAPI document is complete and advertises no marketplace operations.\n');

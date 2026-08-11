import { z } from 'zod';
import type { Services } from '../services/index.js';

export interface ToolInvocationContext {
  readonly requestId: string;
  readonly principal: string;
}

export type ToolKind = 'read' | 'write';

export interface ToolDefinition<
  InputSchema extends z.ZodType = z.ZodType,
  OutputSchema extends z.ZodType = z.ZodType,
> {
  readonly name: string;
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly kind: ToolKind;
  readonly inputSchema: InputSchema;
  readonly outputSchema: OutputSchema;
  readonly handler: (
    input: z.output<InputSchema>,
    services: Services,
    context: ToolInvocationContext,
  ) => Promise<z.output<OutputSchema>>;
}

export const defineTool = <InputSchema extends z.ZodType, OutputSchema extends z.ZodType>(
  definition: ToolDefinition<InputSchema, OutputSchema>,
): ToolDefinition<InputSchema, OutputSchema> => definition;

const integrationStatusSchema = z.object({
  status: z.literal('unavailable'),
  configured: z.literal(false),
  authorizedApiFound: z.literal(false),
  marketplaceCapabilitiesAvailable: z.literal(false),
  reason: z.string(),
  enablementRequirements: z.array(z.string()),
});

export const integrationStatusTool = defineTool({
  name: 'offerup_integration_status',
  title: 'OfferUp integration status',
  summary: 'Report whether an authorized OfferUp provider integration is available.',
  description:
    'Returns server integration status only. It does not access OfferUp marketplace data.',
  kind: 'read',
  inputSchema: z.object({}),
  outputSchema: integrationStatusSchema,
  handler: (_input, services) => services.integration.status(),
});

export const toolDefinitions = [integrationStatusTool] as const satisfies readonly ToolDefinition[];

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';

const clients: Client[] = [];

afterEach(async () => Promise.all(clients.splice(0).map((client) => client.close())));

describe('stdio MCP entry point', () => {
  it('starts as a local process and discovers only the integration-status tool', async () => {
    const client = new Client({ name: 'stdio-test', version: '1.0.0' });
    clients.push(client);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['node_modules/tsx/dist/cli.mjs', 'src/mcp/stdio.ts'],
      cwd: process.cwd(),
      stderr: 'pipe',
    });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(['offerup_integration_status']);
    const result = await client.callTool({
      name: 'offerup_integration_status',
      arguments: {},
    });
    expect(result.isError).not.toBe(true);
  });
});

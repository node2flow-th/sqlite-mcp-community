/**
 * Cloudflare Worker entry — Stateless Streamable HTTP MCP
 *
 * Supports remote databases only (SQLITE_DB_URL) — CF Workers have no local filesystem.
 * Directly imports LibSqlClient to avoid bundling better-sqlite3.
 */

import {
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { LibSqlClient } from './libsql-client.js';
import { createServer } from './server.js';
import { TOOLS } from './tools.js';

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, Accept, mcp-protocol-version',
    'Access-Control-Expose-Headers': 'mcp-session-id',
  };
}

function addCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders())) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Health check
    if (url.pathname === '/' && request.method === 'GET') {
      return addCors(Response.json({
        name: 'sqlite-mcp',
        version: '2.0.0',
        status: 'ok',
        tools: TOOLS.length,
        transport: 'streamable-http',
        mode: 'remote-only (Turso/libSQL)',
        endpoints: { mcp: '/mcp' },
      }));
    }

    // Only /mcp endpoint
    if (url.pathname !== '/mcp') {
      return addCors(new Response('Not Found', { status: 404 }));
    }

    if (request.method !== 'POST') {
      return addCors(Response.json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed. Use POST.' }, id: null },
        { status: 405 }
      ));
    }

    // Only SQLITE_DB_URL is supported in CF Workers (no local filesystem)
    const dbUrl = url.searchParams.get('SQLITE_DB_URL') || '';
    const authToken = url.searchParams.get('SQLITE_AUTH_TOKEN') || '';

    if (!dbUrl) {
      return addCors(Response.json(
        { jsonrpc: '2.0', error: { code: -32000, message: 'SQLITE_DB_URL query parameter is required (e.g. libsql://db-name.turso.io)' }, id: null },
        { status: 400 }
      ));
    }

    try {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      const server = createServer({
        clientFactory: async () => new LibSqlClient({
          url: dbUrl,
          authToken: authToken || undefined,
        }),
        connectionType: 'remote',
        connectionTarget: dbUrl,
      });
      await server.connect(transport);

      const response = await transport.handleRequest(request);
      return addCors(response);
    } catch (error: any) {
      return addCors(Response.json(
        { jsonrpc: '2.0', error: { code: -32603, message: error.message || 'Internal server error' }, id: null },
        { status: 500 }
      ));
    }
  },
};

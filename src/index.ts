#!/usr/bin/env node
/**
 * SQLite MCP Server
 *
 * Community edition — connects to local SQLite files or remote Turso/libSQL databases.
 *
 * Usage (local - stdio):
 *   SQLITE_DB_PATH=/path/to/database.db npx @node2flow/sqlite-mcp
 *
 * Usage (remote - stdio):
 *   SQLITE_DB_URL=libsql://db-name.turso.io SQLITE_AUTH_TOKEN=xxx npx @node2flow/sqlite-mcp
 *
 * Usage (HTTP - Streamable HTTP transport):
 *   SQLITE_DB_URL=libsql://... SQLITE_AUTH_TOKEN=xxx npx @node2flow/sqlite-mcp --http
 */

import { randomUUID } from 'node:crypto';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  StreamableHTTPServerTransport,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { createServer } from './server.js';
import { TOOLS } from './tools.js';

function getConfig() {
  const url = process.env.SQLITE_DB_URL;
  const dbPath = process.env.SQLITE_DB_PATH;

  if (url) {
    return {
      url,
      authToken: process.env.SQLITE_AUTH_TOKEN,
    };
  }

  if (dbPath) {
    return {
      dbPath,
      timeout: process.env.SQLITE_TIMEOUT
        ? parseInt(process.env.SQLITE_TIMEOUT, 10)
        : undefined,
    };
  }

  return null;
}

async function startStdio() {
  const config = getConfig();
  const server = createServer(config ?? undefined);
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const mode = config?.url ? `remote: ${config.url}` : config?.dbPath ? `local: ${config.dbPath}` : '(not configured yet)';
  console.error('SQLite MCP Server running on stdio');
  console.error(`Database: ${mode}`);
  console.error(`Tools available: ${TOOLS.length}`);
  console.error('Ready for MCP client\n');
}

async function startHttp() {
  const port = parseInt(process.env.PORT || '3000', 10);
  const app = createMcpExpressApp({ host: '0.0.0.0' });

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post('/mcp', async (req: any, res: any) => {
    // Accept config from query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qUrl = url.searchParams.get('SQLITE_DB_URL');
    const qAuthToken = url.searchParams.get('SQLITE_AUTH_TOKEN');
    const qDbPath = url.searchParams.get('SQLITE_DB_PATH');
    if (qUrl) process.env.SQLITE_DB_URL = qUrl;
    if (qAuthToken) process.env.SQLITE_AUTH_TOKEN = qAuthToken;
    if (qDbPath) process.env.SQLITE_DB_PATH = qDbPath;

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            transports[sid] = transport;
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
          }
        };

        const config = getConfig();
        const server = createServer(config ?? undefined);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.delete('/mcp', async (req: any, res: any) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.get('/', (_req: any, res: any) => {
    res.json({
      name: 'sqlite-mcp',
      version: '2.0.0',
      status: 'ok',
      tools: TOOLS.length,
      transport: 'streamable-http',
      endpoints: { mcp: '/mcp' },
    });
  });

  const config = getConfig();
  const mode = config?.url ? `remote: ${config.url}` : config?.dbPath ? `local: ${config.dbPath}` : '(not configured yet)';
  app.listen(port, () => {
    console.log(`SQLite MCP Server (HTTP) listening on port ${port}`);
    console.log(`Database: ${mode}`);
    console.log(`Tools available: ${TOOLS.length}`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  });

  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    for (const sessionId in transports) {
      try {
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch {
        /* ignore */
      }
    }
    process.exit(0);
  });
}

async function main() {
  const useHttp = process.argv.includes('--http');
  if (useHttp) {
    await startHttp();
  } else {
    await startStdio();
  }
}

/**
 * Smithery default export
 */
export default function createSmitheryServer(opts?: {
  config?: {
    SQLITE_DB_PATH?: string;
    SQLITE_DB_URL?: string;
    SQLITE_AUTH_TOKEN?: string;
    SQLITE_TIMEOUT?: number;
  };
}) {
  if (opts?.config?.SQLITE_DB_PATH)
    process.env.SQLITE_DB_PATH = opts.config.SQLITE_DB_PATH;
  if (opts?.config?.SQLITE_DB_URL)
    process.env.SQLITE_DB_URL = opts.config.SQLITE_DB_URL;
  if (opts?.config?.SQLITE_AUTH_TOKEN)
    process.env.SQLITE_AUTH_TOKEN = opts.config.SQLITE_AUTH_TOKEN;
  if (opts?.config?.SQLITE_TIMEOUT)
    process.env.SQLITE_TIMEOUT = String(opts.config.SQLITE_TIMEOUT);
  const config = getConfig();
  return createServer(config ?? undefined);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

/**
 * Shared MCP Server — used by stdio, HTTP, and CF Worker modes
 *
 * Accepts a clientFactory function to avoid bundling both clients.
 * Worker.ts passes LibSqlClient factory, index.ts passes SqliteClient or LibSqlClient factory.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { TOOLS } from './tools.js';
import type { SqliteClientInterface, ColumnDefinition } from './types.js';

export interface ServerOptions {
  clientFactory?: () => Promise<SqliteClientInterface>;
  connectionType?: string;
  connectionTarget?: string;
}

export async function handleToolCall(
  toolName: string,
  args: Record<string, unknown>,
  client: SqliteClientInterface
) {
  switch (toolName) {
    // ========== Query & Execute ==========
    case 'sqlite_query':
      return client.query(
        args.sql as string,
        args.params as unknown[] | undefined
      );
    case 'sqlite_execute':
      return client.execute(
        args.sql as string,
        args.params as unknown[] | undefined
      );
    case 'sqlite_run_script':
      return client.runScript(args.sql as string);

    // ========== Schema Inspection ==========
    case 'sqlite_list_tables':
      return client.listTables();
    case 'sqlite_describe_table':
      return client.describeTable(args.table as string);
    case 'sqlite_list_indexes':
      return client.listIndexes(args.table as string);
    case 'sqlite_list_foreign_keys':
      return client.listForeignKeys(args.table as string);

    // ========== Schema Management ==========
    case 'sqlite_create_table': {
      await client.createTable(
        args.table as string,
        args.columns as ColumnDefinition[],
        args.ifNotExists as boolean | undefined
      );
      return { success: true, table: args.table };
    }
    case 'sqlite_alter_table': {
      await client.alterTable(
        args.table as string,
        args.action as string,
        args as Record<string, unknown>
      );
      return { success: true, table: args.table, action: args.action };
    }
    case 'sqlite_drop_table': {
      await client.dropTable(
        args.table as string,
        args.ifExists as boolean | undefined
      );
      return { success: true, table: args.table, dropped: true };
    }

    // ========== Index Management ==========
    case 'sqlite_create_index': {
      await client.createIndex(
        args.table as string,
        args.columns as string[],
        args.indexName as string | undefined,
        args.unique as boolean | undefined,
        args.ifNotExists as boolean | undefined
      );
      return {
        success: true,
        table: args.table,
        indexName:
          args.indexName ||
          `idx_${args.table}_${(args.columns as string[]).join('_')}`,
      };
    }
    case 'sqlite_drop_index': {
      await client.dropIndex(
        args.indexName as string,
        args.ifExists as boolean | undefined
      );
      return { success: true, indexName: args.indexName, dropped: true };
    }

    // ========== Database Management ==========
    case 'sqlite_get_info':
      return client.getInfo();
    case 'sqlite_vacuum':
      return client.vacuum();
    case 'sqlite_integrity_check':
      return client.integrityCheck();

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

export function createServer(opts?: ServerOptions) {
  const server = new McpServer({
    name: 'sqlite-mcp',
    version: '2.0.0',
  });

  let client: SqliteClientInterface | null = null;

  // Register all 15 tools with annotations
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema as any,
        annotations: tool.annotations,
      },
      async (args: Record<string, unknown>) => {
        if (!opts?.clientFactory) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: Database not configured. Set SQLITE_DB_URL (remote) or SQLITE_DB_PATH (local).',
              },
            ],
            isError: true,
          };
        }

        if (!client) {
          try {
            client = await opts.clientFactory();
          } catch (error) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Error connecting to database: ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              isError: true,
            };
          }
        }

        try {
          const result = await handleToolCall(tool.name, args, client);
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: false,
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // Register prompts
  server.prompt(
    'explore-database',
    'Guide for exploring and querying a SQLite database',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'You are a SQLite database assistant.',
              '',
              'Available exploration actions:',
              '1. **List tables** — Use sqlite_list_tables to see all tables with row counts',
              '2. **Describe table** — Use sqlite_describe_table to see columns, types, constraints',
              '3. **List indexes** — Use sqlite_list_indexes to see indexes on a table',
              '4. **List foreign keys** — Use sqlite_list_foreign_keys to see relationships',
              '5. **Query data** — Use sqlite_query with SELECT statements',
              '6. **Database info** — Use sqlite_get_info for metadata (size, version, journal mode)',
              '7. **Health check** — Use sqlite_integrity_check to verify database health',
              '',
              'Start by listing tables with sqlite_list_tables, then describe tables of interest.',
            ].join('\n'),
          },
        },
      ],
    })
  );

  server.prompt(
    'manage-schema',
    'Guide for managing SQLite tables, columns, and indexes',
    async () => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: [
              'You are a SQLite schema management assistant.',
              '',
              'Available schema actions:',
              '1. **Create table** — Use sqlite_create_table with column definitions',
              '2. **Alter table** — Use sqlite_alter_table to add/rename columns or rename table',
              '3. **Drop table** — Use sqlite_drop_table to delete a table (irreversible)',
              '4. **Create index** — Use sqlite_create_index for query performance',
              '5. **Drop index** — Use sqlite_drop_index to remove an index',
              '6. **Run script** — Use sqlite_run_script for multi-statement migrations',
              '7. **Execute** — Use sqlite_execute for INSERT, UPDATE, DELETE statements',
              '',
              'Column types: INTEGER, TEXT, REAL, BLOB, NUMERIC',
              'Constraints: PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT',
              '',
              'What would you like to manage?',
            ].join('\n'),
          },
        },
      ],
    })
  );

  // Register resources
  const connectionType = opts?.connectionType ?? 'not configured';
  const connectionTarget = opts?.connectionTarget ?? '(not configured)';

  server.resource(
    'server-info',
    'sqlite://server-info',
    {
      description:
        'Connection status and available tools for this SQLite MCP server',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'sqlite://server-info',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              name: 'sqlite-mcp',
              version: '2.0.0',
              connected: !!opts?.clientFactory,
              connection_type: connectionType,
              database: connectionTarget,
              tools_available: TOOLS.length,
              tool_categories: {
                query_and_execute: 3,
                schema_inspection: 4,
                schema_management: 3,
                index_management: 2,
                database_management: 3,
              },
            },
            null,
            2
          ),
        },
      ],
    })
  );

  // Override tools/list handler to return raw JSON Schema with property descriptions.
  (server as any).server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    })),
  }));

  return server;
}

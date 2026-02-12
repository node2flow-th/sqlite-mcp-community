/**
 * SQLite MCP - Tool Definitions (15 tools)
 */

export interface ToolAnnotation {
  title: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface MCPToolDefinition {
  name: string;
  description: string;
  annotations: ToolAnnotation;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: MCPToolDefinition[] = [
  // ========== Query & Execute (3) ==========
  {
    name: 'sqlite_query',
    description:
      'Execute a SELECT query on the SQLite database and return rows as a JSON array. Use this for reading data — supports any valid SELECT statement with optional parameter binding for safe queries.',
    annotations: {
      title: 'Query Database',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description:
            'SQL SELECT query to execute (e.g., "SELECT * FROM users WHERE age > ?")',
        },
        params: {
          type: 'array',
          items: {},
          description:
            'Array of bind parameter values for ? placeholders (e.g., [25])',
        },
      },
      required: ['sql'],
    },
  },
  {
    name: 'sqlite_execute',
    description:
      'Execute a write statement (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP) on the SQLite database. Returns the number of rows changed and the last inserted row ID. Use parameter binding for safe writes.',
    annotations: {
      title: 'Execute Statement',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description:
            'SQL write statement to execute (e.g., "INSERT INTO users (name, age) VALUES (?, ?)")',
        },
        params: {
          type: 'array',
          items: {},
          description:
            'Array of bind parameter values for ? placeholders (e.g., ["Alice", 30])',
        },
      },
      required: ['sql'],
    },
  },
  {
    name: 'sqlite_run_script',
    description:
      'Execute multiple SQL statements in a single transaction. All statements succeed or all fail (atomic). Separate statements with semicolons. Use for migrations, seed data, or batch operations.',
    annotations: {
      title: 'Run SQL Script',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description:
            'Multiple SQL statements separated by semicolons (e.g., "CREATE TABLE t1 (id INTEGER); INSERT INTO t1 VALUES (1);")',
        },
      },
      required: ['sql'],
    },
  },

  // ========== Schema Inspection (4) ==========
  {
    name: 'sqlite_list_tables',
    description:
      'List all tables and views in the database with their row counts. Use this as the first step to explore an unfamiliar database. Returns table name, type (table or view), and row count.',
    annotations: {
      title: 'List Tables',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sqlite_describe_table',
    description:
      'Get the column schema of a table — column names, data types, NOT NULL constraints, default values, and primary key flags. Also returns the CREATE TABLE SQL statement.',
    annotations: {
      title: 'Describe Table',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table name to describe (e.g., "users")',
        },
      },
      required: ['table'],
    },
  },
  {
    name: 'sqlite_list_indexes',
    description:
      'List all indexes on a table — index name, uniqueness, origin (manual or auto-created), and whether it is a partial index.',
    annotations: {
      title: 'List Indexes',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table name to list indexes for (e.g., "users")',
        },
      },
      required: ['table'],
    },
  },
  {
    name: 'sqlite_list_foreign_keys',
    description:
      'List foreign key constraints on a table — referenced table, local and remote columns, ON UPDATE and ON DELETE actions.',
    annotations: {
      title: 'List Foreign Keys',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description:
            'Table name to list foreign keys for (e.g., "orders")',
        },
      },
      required: ['table'],
    },
  },

  // ========== Schema Management (3) ==========
  {
    name: 'sqlite_create_table',
    description:
      'Create a new table with column definitions. Each column has a name, type, and optional constraints (PRIMARY KEY, NOT NULL, UNIQUE, DEFAULT). Use ifNotExists to skip if the table already exists.',
    annotations: {
      title: 'Create Table',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Name for the new table (e.g., "users")',
        },
        columns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Column name (e.g., "id", "email")',
              },
              type: {
                type: 'string',
                description:
                  'Column data type (e.g., "INTEGER", "TEXT", "REAL", "BLOB")',
              },
              primaryKey: {
                type: 'boolean',
                description: 'Set as PRIMARY KEY (default: false)',
              },
              notNull: {
                type: 'boolean',
                description: 'Add NOT NULL constraint (default: false)',
              },
              default: {
                description:
                  'Default value for the column (string or number)',
              },
              unique: {
                type: 'boolean',
                description: 'Add UNIQUE constraint (default: false)',
              },
            },
            required: ['name', 'type'],
          },
          description:
            'Array of column definitions with name, type, and optional constraints',
        },
        ifNotExists: {
          type: 'boolean',
          description:
            'Skip creation if table already exists (default: false)',
        },
      },
      required: ['table', 'columns'],
    },
  },
  {
    name: 'sqlite_alter_table',
    description:
      'Alter an existing table — add a new column, rename a column, or rename the table. SQLite does not support dropping columns via ALTER TABLE.',
    annotations: {
      title: 'Alter Table',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Current table name to alter (e.g., "users")',
        },
        action: {
          type: 'string',
          enum: ['add_column', 'rename_column', 'rename_table'],
          description:
            'Alter action: "add_column" to add a new column, "rename_column" to rename a column, "rename_table" to rename the table',
        },
        column: {
          type: 'string',
          description:
            'New column name (for add_column action)',
        },
        type: {
          type: 'string',
          description:
            'Column data type (for add_column action, e.g., "TEXT", "INTEGER")',
        },
        notNull: {
          type: 'boolean',
          description:
            'Add NOT NULL constraint to new column (for add_column, default: false)',
        },
        default: {
          description:
            'Default value for new column (for add_column)',
        },
        oldName: {
          type: 'string',
          description:
            'Current column name to rename (for rename_column action)',
        },
        newName: {
          type: 'string',
          description:
            'New column name (for rename_column action)',
        },
        newTableName: {
          type: 'string',
          description: 'New table name (for rename_table action)',
        },
      },
      required: ['table', 'action'],
    },
  },
  {
    name: 'sqlite_drop_table',
    description:
      'Drop (delete) a table and all its data permanently. This action is irreversible. Use ifExists to avoid errors if the table does not exist.',
    annotations: {
      title: 'Drop Table',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table name to drop (e.g., "old_users")',
        },
        ifExists: {
          type: 'boolean',
          description:
            'Skip if table does not exist instead of throwing error (default: false)',
        },
      },
      required: ['table'],
    },
  },

  // ========== Index Management (2) ==========
  {
    name: 'sqlite_create_index',
    description:
      'Create an index on one or more columns to speed up queries. Optionally create a UNIQUE index to enforce uniqueness. Index name is auto-generated if not provided.',
    annotations: {
      title: 'Create Index',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        table: {
          type: 'string',
          description: 'Table to create the index on (e.g., "users")',
        },
        columns: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Array of column names to index (e.g., ["email"] or ["last_name", "first_name"])',
        },
        indexName: {
          type: 'string',
          description:
            'Custom index name (auto-generated as idx_table_col1_col2 if omitted)',
        },
        unique: {
          type: 'boolean',
          description:
            'Create a UNIQUE index to enforce uniqueness (default: false)',
        },
        ifNotExists: {
          type: 'boolean',
          description:
            'Skip if index already exists (default: false)',
        },
      },
      required: ['table', 'columns'],
    },
  },
  {
    name: 'sqlite_drop_index',
    description:
      'Drop (delete) an index by name. Does not affect the table data, only removes the index. Use ifExists to avoid errors if the index does not exist.',
    annotations: {
      title: 'Drop Index',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        indexName: {
          type: 'string',
          description: 'Name of the index to drop (e.g., "idx_users_email")',
        },
        ifExists: {
          type: 'boolean',
          description:
            'Skip if index does not exist instead of throwing error (default: false)',
        },
      },
      required: ['indexName'],
    },
  },

  // ========== Database Management (3) ==========
  {
    name: 'sqlite_get_info',
    description:
      'Get database metadata — file path, file size, table count, page count, page size, journal mode, WAL status, encoding, and SQLite version. Use this to understand the database state.',
    annotations: {
      title: 'Get Database Info',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sqlite_vacuum',
    description:
      'Optimize and compact the database file by rebuilding it. Reclaims space from deleted rows and defragments the file. Returns file size before and after. May take time on large databases.',
    annotations: {
      title: 'Vacuum Database',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'sqlite_integrity_check',
    description:
      'Run PRAGMA integrity_check to verify the database is not corrupted. Returns "ok" if the database is healthy, or a list of issues found. Use after crashes or suspicious behavior.',
    annotations: {
      title: 'Integrity Check',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

# SQLite MCP Server

[![smithery badge](https://smithery.ai/badge/node2flow/sqlite)](https://smithery.ai/server/node2flow/sqlite)
[![npm version](https://img.shields.io/npm/v/@node2flow/sqlite-mcp.svg)](https://www.npmjs.com/package/@node2flow/sqlite-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for SQLite databases — query, manage schema, indexes, and optimize through 15 tools.

## Quick Start

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@node2flow/sqlite-mcp"],
      "env": {
        "SQLITE_DB_PATH": "/path/to/your/database.db"
      }
    }
  }
}
```

### HTTP Mode

```bash
SQLITE_DB_PATH=/path/to/database.db npx @node2flow/sqlite-mcp --http
# MCP endpoint: http://localhost:3000/mcp
```

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `SQLITE_DB_PATH` | Yes | Path to SQLite database file (creates if not exists) |
| `SQLITE_TIMEOUT` | No | Database busy timeout in milliseconds (default: 5000) |

## Tools (15)

### Query & Execute (3)

| Tool | Description |
|------|-------------|
| `sqlite_query` | Execute SELECT query, return rows as JSON |
| `sqlite_execute` | Execute write statement (INSERT/UPDATE/DELETE/CREATE) |
| `sqlite_run_script` | Execute multiple statements in transaction |

### Schema Inspection (4)

| Tool | Description |
|------|-------------|
| `sqlite_list_tables` | List all tables with row counts |
| `sqlite_describe_table` | Get columns, types, constraints |
| `sqlite_list_indexes` | List indexes for a table |
| `sqlite_list_foreign_keys` | List foreign key constraints |

### Schema Management (3)

| Tool | Description |
|------|-------------|
| `sqlite_create_table` | Create new table with column definitions |
| `sqlite_alter_table` | Add column, rename column, rename table |
| `sqlite_drop_table` | Drop a table |

### Index Management (2)

| Tool | Description |
|------|-------------|
| `sqlite_create_index` | Create index on columns |
| `sqlite_drop_index` | Drop an index |

### Database Management (3)

| Tool | Description |
|------|-------------|
| `sqlite_get_info` | Database metadata (size, tables, journal mode) |
| `sqlite_vacuum` | Optimize and compact database |
| `sqlite_integrity_check` | Check database health |

## Docker

```bash
docker compose up -d
# Endpoint: http://localhost:3025/mcp
```

Mount your database files via volumes:

```yaml
services:
  sqlite-mcp-community:
    build: .
    ports:
      - "127.0.0.1:3025:3000"
    environment:
      - SQLITE_DB_PATH=/data/database.db
    volumes:
      - ./data:/data
```

## License

MIT License - see [LICENSE](LICENSE)

Copyright (c) 2026 [Node2Flow](https://node2flow.net)

## Links

- [npm Package](https://www.npmjs.com/package/@node2flow/sqlite-mcp)
- [SQLite Documentation](https://sqlite.org/docs.html)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Node2Flow](https://node2flow.net)

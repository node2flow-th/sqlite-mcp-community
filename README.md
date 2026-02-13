# SQLite MCP Server

[![smithery badge](https://smithery.ai/badge/node2flow/sqlite)](https://smithery.ai/server/node2flow/sqlite)
[![npm version](https://img.shields.io/npm/v/@node2flow/sqlite-mcp.svg)](https://www.npmjs.com/package/@node2flow/sqlite-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

MCP server for SQLite databases — local files or remote Turso/libSQL via URL. 15 tools for query, schema, indexes, and optimization.

## Quick Start

### Local Database (Claude Desktop / Cursor)

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

### Remote Database (Turso/libSQL)

```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@node2flow/sqlite-mcp"],
      "env": {
        "SQLITE_DB_URL": "libsql://your-db-name.turso.io",
        "SQLITE_AUTH_TOKEN": "your-auth-token"
      }
    }
  }
}
```

### HTTP Mode

```bash
# Local
SQLITE_DB_PATH=/path/to/database.db npx @node2flow/sqlite-mcp --http

# Remote
SQLITE_DB_URL=libsql://your-db.turso.io SQLITE_AUTH_TOKEN=xxx npx @node2flow/sqlite-mcp --http
```

MCP endpoint: `http://localhost:3000/mcp`

### Cloudflare Worker (Remote Only)

Available at: `https://sqlite-mcp-community.node2flow.net/mcp`

```
POST https://sqlite-mcp-community.node2flow.net/mcp?SQLITE_DB_URL=libsql://your-db.turso.io&SQLITE_AUTH_TOKEN=xxx
```

> CF Workers have no filesystem — only `SQLITE_DB_URL` is supported.

---

## Configuration

| Variable | Required | Mode | Description |
|----------|----------|------|-------------|
| `SQLITE_DB_PATH` | No | Local | Path to SQLite file (creates if not exists) |
| `SQLITE_DB_URL` | No | Remote | Turso/libSQL URL (e.g. `libsql://db.turso.io`) |
| `SQLITE_AUTH_TOKEN` | No | Remote | Auth token for Turso (required with URL) |
| `SQLITE_TIMEOUT` | No | Local | Busy timeout in ms (default: 5000) |

**Priority:** `SQLITE_DB_URL` > `SQLITE_DB_PATH` (if both set, URL wins)

---

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

---

## Turso Setup

1. Install Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash`
2. Sign up: `turso auth signup`
3. Create database: `turso db create my-database`
4. Get URL: `turso db show my-database --url`
5. Get token: `turso db tokens create my-database`

Free tier: 500 databases, 9GB storage, 25M reads/month.

---

## Docker

```bash
docker compose up -d
# Endpoint: http://localhost:3025/mcp
```

Mount database files or use remote URL:

```yaml
services:
  sqlite-mcp-community:
    build: .
    ports:
      - "127.0.0.1:3025:3000"
    environment:
      # Local mode:
      - SQLITE_DB_PATH=/data/database.db
      # OR Remote mode:
      # - SQLITE_DB_URL=libsql://your-db.turso.io
      # - SQLITE_AUTH_TOKEN=your-token
    volumes:
      - ./data:/data
```

---

## License

MIT License - see [LICENSE](LICENSE)

Copyright (c) 2026 [Node2Flow](https://node2flow.net)

## Links

- [npm Package](https://www.npmjs.com/package/@node2flow/sqlite-mcp)
- [Turso](https://turso.tech/) — Hosted SQLite databases
- [libSQL](https://github.com/tursodatabase/libsql) — Open source SQLite fork
- [SQLite Documentation](https://sqlite.org/docs.html)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Node2Flow](https://node2flow.net)

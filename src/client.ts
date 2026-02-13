/**
 * SQLite Client (Local)
 * Wraps better-sqlite3 with typed async methods matching SqliteClientInterface
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  SqliteConfig,
  SqliteClientInterface,
  ColumnInfo,
  IndexInfo,
  ForeignKeyInfo,
  TableInfo,
  DatabaseInfo,
  ColumnDefinition,
  QueryResult,
  ExecuteResult,
} from './types.js';

export class SqliteClient implements SqliteClientInterface {
  private db: Database.Database;
  private config: SqliteConfig;

  constructor(config: SqliteConfig) {
    this.config = config;
    this.db = new Database(config.dbPath, {
      readonly: config.readonly ?? false,
      timeout: config.timeout ?? 5000,
    });
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');
  }

  // ========== Query & Execute ==========

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const stmt = this.db.prepare(sql);
    const rows = params
      ? (stmt.all(...params) as Record<string, unknown>[])
      : (stmt.all() as Record<string, unknown>[]);
    const columns =
      rows.length > 0
        ? Object.keys(rows[0])
        : stmt.columns().map((c) => c.name);
    return { columns, rows, rowCount: rows.length };
  }

  async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
    const stmt = this.db.prepare(sql);
    const result = params ? stmt.run(...params) : stmt.run();
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }

  async runScript(sql: string): Promise<{ statementsRun: number }> {
    const transaction = this.db.transaction(() => {
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      let count = 0;
      for (const stmt of statements) {
        this.db.exec(stmt);
        count++;
      }
      return count;
    });
    const statementsRun = transaction();
    return { statementsRun };
  }

  // ========== Schema Inspection ==========

  async listTables(): Promise<TableInfo[]> {
    const tables = this.db
      .prepare(
        "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as { name: string; type: string }[];

    return tables.map((t) => {
      let rowCount = 0;
      try {
        const result = this.db
          .prepare(`SELECT COUNT(*) as count FROM "${t.name}"`)
          .get() as { count: number };
        rowCount = result.count;
      } catch {
        // View or inaccessible table
      }
      return { name: t.name, type: t.type, rowCount };
    });
  }

  async describeTable(table: string): Promise<{ columns: ColumnInfo[]; sql: string }> {
    const columns = this.db
      .prepare(`PRAGMA table_info("${table}")`)
      .all() as ColumnInfo[];
    const schemaRow = this.db
      .prepare('SELECT sql FROM sqlite_master WHERE name = ?')
      .get(table) as { sql: string } | undefined;
    return { columns, sql: schemaRow?.sql ?? '' };
  }

  async listIndexes(table: string): Promise<IndexInfo[]> {
    return this.db
      .prepare(`PRAGMA index_list("${table}")`)
      .all() as IndexInfo[];
  }

  async listForeignKeys(table: string): Promise<ForeignKeyInfo[]> {
    return this.db
      .prepare(`PRAGMA foreign_key_list("${table}")`)
      .all() as ForeignKeyInfo[];
  }

  // ========== Schema Management ==========

  async createTable(
    table: string,
    columns: ColumnDefinition[],
    ifNotExists?: boolean
  ): Promise<void> {
    const colDefs = columns.map((col) => {
      let def = `"${col.name}" ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.notNull) def += ' NOT NULL';
      if (col.unique) def += ' UNIQUE';
      if (col.default !== undefined && col.default !== null) {
        def += ` DEFAULT ${typeof col.default === 'string' ? `'${col.default}'` : col.default}`;
      }
      return def;
    });
    const exists = ifNotExists ? ' IF NOT EXISTS' : '';
    this.db.exec(
      `CREATE TABLE${exists} "${table}" (${colDefs.join(', ')})`
    );
  }

  async alterTable(
    table: string,
    action: string,
    params: Record<string, unknown>
  ): Promise<void> {
    switch (action) {
      case 'add_column': {
        let sql = `ALTER TABLE "${table}" ADD COLUMN "${params.column}" ${params.type}`;
        if (params.notNull) sql += ' NOT NULL';
        if (params.default !== undefined) {
          sql += ` DEFAULT ${typeof params.default === 'string' ? `'${params.default}'` : params.default}`;
        }
        this.db.exec(sql);
        break;
      }
      case 'rename_column':
        this.db.exec(
          `ALTER TABLE "${table}" RENAME COLUMN "${params.oldName}" TO "${params.newName}"`
        );
        break;
      case 'rename_table':
        this.db.exec(
          `ALTER TABLE "${table}" RENAME TO "${params.newTableName}"`
        );
        break;
      default:
        throw new Error(`Unknown alter action: ${action}`);
    }
  }

  async dropTable(table: string, ifExists?: boolean): Promise<void> {
    const exists = ifExists ? ' IF EXISTS' : '';
    this.db.exec(`DROP TABLE${exists} "${table}"`);
  }

  // ========== Index Management ==========

  async createIndex(
    table: string,
    columns: string[],
    indexName?: string,
    unique?: boolean,
    ifNotExists?: boolean
  ): Promise<void> {
    const name = indexName || `idx_${table}_${columns.join('_')}`;
    const uniqueStr = unique ? ' UNIQUE' : '';
    const exists = ifNotExists ? ' IF NOT EXISTS' : '';
    const cols = columns.map((c) => `"${c}"`).join(', ');
    this.db.exec(
      `CREATE${uniqueStr} INDEX${exists} "${name}" ON "${table}" (${cols})`
    );
  }

  async dropIndex(indexName: string, ifExists?: boolean): Promise<void> {
    const exists = ifExists ? ' IF EXISTS' : '';
    this.db.exec(`DROP INDEX${exists} "${indexName}"`);
  }

  // ========== Database Management ==========

  async getInfo(): Promise<DatabaseInfo> {
    const pageCount = (
      this.db.prepare('PRAGMA page_count').get() as Record<string, unknown>
    ).page_count as number;
    const pageSize = (
      this.db.prepare('PRAGMA page_size').get() as Record<string, unknown>
    ).page_size as number;
    const journalMode = (
      this.db.prepare('PRAGMA journal_mode').get() as Record<string, unknown>
    ).journal_mode as string;
    const encoding = (
      this.db.prepare('PRAGMA encoding').get() as Record<string, unknown>
    ).encoding as string;
    const sqliteVersion = (
      this.db
        .prepare('SELECT sqlite_version() as version')
        .get() as Record<string, unknown>
    ).version as string;

    let fileSize = 0;
    try {
      const stats = fs.statSync(this.config.dbPath);
      fileSize = stats.size;
    } catch {
      // In-memory database
    }

    const tables = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
      )
      .get() as { count: number };

    return {
      filePath: path.resolve(this.config.dbPath),
      fileSize,
      tableCount: tables.count,
      pageCount,
      pageSize,
      journalMode,
      walMode: journalMode === 'wal',
      encoding,
      sqliteVersion,
    };
  }

  async vacuum(): Promise<{ sizeBefore: number; sizeAfter: number }> {
    let sizeBefore = 0;
    try {
      sizeBefore = fs.statSync(this.config.dbPath).size;
    } catch {
      // In-memory database
    }
    this.db.exec('VACUUM');
    let sizeAfter = 0;
    try {
      sizeAfter = fs.statSync(this.config.dbPath).size;
    } catch {
      // In-memory database
    }
    return { sizeBefore, sizeAfter };
  }

  async integrityCheck(): Promise<{ ok: boolean; results: string[] }> {
    const results = this.db
      .prepare('PRAGMA integrity_check')
      .all() as { integrity_check: string }[];
    const messages = results.map((r) => r.integrity_check);
    return {
      ok: messages.length === 1 && messages[0] === 'ok',
      results: messages,
    };
  }

  close(): void {
    this.db.close();
  }
}

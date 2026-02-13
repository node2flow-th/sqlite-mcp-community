/**
 * LibSQL Client (Remote)
 * Wraps @libsql/client for remote SQLite databases (Turso, libSQL server)
 * Implements the same SqliteClientInterface as SqliteClient
 */

import { createClient, type Client } from '@libsql/client';
import type {
  LibSqlConfig,
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

export class LibSqlClient implements SqliteClientInterface {
  private client: Client;
  private config: LibSqlConfig;

  constructor(config: LibSqlConfig) {
    this.config = config;
    this.client = createClient({
      url: config.url,
      authToken: config.authToken,
    });
  }

  // ========== Query & Execute ==========

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    const result = await this.client.execute({
      sql,
      args: (params as any[]) ?? [],
    });
    const columns = result.columns;
    const rows = result.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i];
      }
      return obj;
    });
    return { columns, rows, rowCount: rows.length };
  }

  async execute(sql: string, params?: unknown[]): Promise<ExecuteResult> {
    const result = await this.client.execute({
      sql,
      args: (params as any[]) ?? [],
    });
    return {
      changes: result.rowsAffected,
      lastInsertRowid: result.lastInsertRowid ?? 0,
    };
  }

  async runScript(sql: string): Promise<{ statementsRun: number }> {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const batch = statements.map((stmt) => ({ sql: stmt, args: [] as any[] }));
    await this.client.batch(batch, 'write');
    return { statementsRun: statements.length };
  }

  // ========== Schema Inspection ==========

  async listTables(): Promise<TableInfo[]> {
    const result = await this.client.execute({
      sql: "SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY name",
      args: [],
    });

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const name = row[0] as string;
      const type = row[1] as string;
      let rowCount = 0;
      try {
        const countResult = await this.client.execute({
          sql: `SELECT COUNT(*) as count FROM "${name}"`,
          args: [],
        });
        rowCount = countResult.rows[0][0] as number;
      } catch {
        // View or inaccessible table
      }
      tables.push({ name, type, rowCount });
    }
    return tables;
  }

  async describeTable(table: string): Promise<{ columns: ColumnInfo[]; sql: string }> {
    const colResult = await this.client.execute({
      sql: `PRAGMA table_info("${table}")`,
      args: [],
    });
    const columns: ColumnInfo[] = colResult.rows.map((row) => ({
      cid: row[0] as number,
      name: row[1] as string,
      type: row[2] as string,
      notnull: row[3] as number,
      dflt_value: row[4] as string | null,
      pk: row[5] as number,
    }));

    const schemaResult = await this.client.execute({
      sql: 'SELECT sql FROM sqlite_master WHERE name = ?',
      args: [table],
    });
    const sql = schemaResult.rows.length > 0 ? (schemaResult.rows[0][0] as string) : '';
    return { columns, sql };
  }

  async listIndexes(table: string): Promise<IndexInfo[]> {
    const result = await this.client.execute({
      sql: `PRAGMA index_list("${table}")`,
      args: [],
    });
    return result.rows.map((row) => ({
      seq: row[0] as number,
      name: row[1] as string,
      unique: row[2] as number,
      origin: row[3] as string,
      partial: row[4] as number,
    }));
  }

  async listForeignKeys(table: string): Promise<ForeignKeyInfo[]> {
    const result = await this.client.execute({
      sql: `PRAGMA foreign_key_list("${table}")`,
      args: [],
    });
    return result.rows.map((row) => ({
      id: row[0] as number,
      seq: row[1] as number,
      table: row[2] as string,
      from: row[3] as string,
      to: row[4] as string,
      on_update: row[5] as string,
      on_delete: row[6] as string,
      match: row[7] as string,
    }));
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
    await this.client.execute({
      sql: `CREATE TABLE${exists} "${table}" (${colDefs.join(', ')})`,
      args: [],
    });
  }

  async alterTable(
    table: string,
    action: string,
    params: Record<string, unknown>
  ): Promise<void> {
    let sql: string;
    switch (action) {
      case 'add_column': {
        sql = `ALTER TABLE "${table}" ADD COLUMN "${params.column}" ${params.type}`;
        if (params.notNull) sql += ' NOT NULL';
        if (params.default !== undefined) {
          sql += ` DEFAULT ${typeof params.default === 'string' ? `'${params.default}'` : params.default}`;
        }
        break;
      }
      case 'rename_column':
        sql = `ALTER TABLE "${table}" RENAME COLUMN "${params.oldName}" TO "${params.newName}"`;
        break;
      case 'rename_table':
        sql = `ALTER TABLE "${table}" RENAME TO "${params.newTableName}"`;
        break;
      default:
        throw new Error(`Unknown alter action: ${action}`);
    }
    await this.client.execute({ sql, args: [] });
  }

  async dropTable(table: string, ifExists?: boolean): Promise<void> {
    const exists = ifExists ? ' IF EXISTS' : '';
    await this.client.execute({
      sql: `DROP TABLE${exists} "${table}"`,
      args: [],
    });
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
    await this.client.execute({
      sql: `CREATE${uniqueStr} INDEX${exists} "${name}" ON "${table}" (${cols})`,
      args: [],
    });
  }

  async dropIndex(indexName: string, ifExists?: boolean): Promise<void> {
    const exists = ifExists ? ' IF EXISTS' : '';
    await this.client.execute({
      sql: `DROP INDEX${exists} "${indexName}"`,
      args: [],
    });
  }

  // ========== Database Management ==========

  async getInfo(): Promise<DatabaseInfo> {
    const [pageCountR, pageSizeR, journalR, encodingR, versionR, tablesR] =
      await Promise.all([
        this.client.execute({ sql: 'PRAGMA page_count', args: [] }),
        this.client.execute({ sql: 'PRAGMA page_size', args: [] }),
        this.client.execute({ sql: 'PRAGMA journal_mode', args: [] }),
        this.client.execute({ sql: 'PRAGMA encoding', args: [] }),
        this.client.execute({ sql: 'SELECT sqlite_version() as version', args: [] }),
        this.client.execute({
          sql: "SELECT COUNT(*) as count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
          args: [],
        }),
      ]);

    const pageCount = pageCountR.rows[0][0] as number;
    const pageSize = pageSizeR.rows[0][0] as number;
    const journalMode = journalR.rows[0][0] as string;
    const encoding = encodingR.rows[0][0] as string;
    const sqliteVersion = versionR.rows[0][0] as string;
    const tableCount = tablesR.rows[0][0] as number;

    return {
      filePath: this.config.url,
      fileSize: pageCount * pageSize, // Estimate from pages
      tableCount,
      pageCount,
      pageSize,
      journalMode,
      walMode: journalMode === 'wal',
      encoding,
      sqliteVersion,
    };
  }

  async vacuum(): Promise<{ sizeBefore: number; sizeAfter: number }> {
    const beforeR = await this.client.execute({ sql: 'PRAGMA page_count', args: [] });
    const pageSizeR = await this.client.execute({ sql: 'PRAGMA page_size', args: [] });
    const sizeBefore = (beforeR.rows[0][0] as number) * (pageSizeR.rows[0][0] as number);

    await this.client.execute({ sql: 'VACUUM', args: [] });

    const afterR = await this.client.execute({ sql: 'PRAGMA page_count', args: [] });
    const sizeAfter = (afterR.rows[0][0] as number) * (pageSizeR.rows[0][0] as number);

    return { sizeBefore, sizeAfter };
  }

  async integrityCheck(): Promise<{ ok: boolean; results: string[] }> {
    const result = await this.client.execute({
      sql: 'PRAGMA integrity_check',
      args: [],
    });
    const messages = result.rows.map((row) => row[0] as string);
    return {
      ok: messages.length === 1 && messages[0] === 'ok',
      results: messages,
    };
  }

  close(): void {
    this.client.close();
  }
}

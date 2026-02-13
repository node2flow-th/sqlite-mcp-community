/**
 * SQLite MCP - Type Definitions
 */

export interface SqliteConfig {
  dbPath: string;
  readonly?: boolean;
  timeout?: number;
}

export interface LibSqlConfig {
  url: string;
  authToken?: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

export interface IndexInfo {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

export interface ForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_update: string;
  on_delete: string;
  match: string;
}

export interface TableInfo {
  name: string;
  type: string;
  rowCount: number;
}

export interface DatabaseInfo {
  filePath: string;
  fileSize: number;
  tableCount: number;
  pageCount: number;
  pageSize: number;
  journalMode: string;
  walMode: boolean;
  encoding: string;
  sqliteVersion: string;
}

export interface ColumnDefinition {
  name: string;
  type: string;
  primaryKey?: boolean;
  notNull?: boolean;
  default?: string | number | null;
  unique?: boolean;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface ExecuteResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Common interface for both SqliteClient (better-sqlite3) and LibSqlClient (@libsql/client)
 */
export interface SqliteClientInterface {
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  execute(sql: string, params?: unknown[]): Promise<ExecuteResult>;
  runScript(sql: string): Promise<{ statementsRun: number }>;
  listTables(): Promise<TableInfo[]>;
  describeTable(table: string): Promise<{ columns: ColumnInfo[]; sql: string }>;
  listIndexes(table: string): Promise<IndexInfo[]>;
  listForeignKeys(table: string): Promise<ForeignKeyInfo[]>;
  createTable(table: string, columns: ColumnDefinition[], ifNotExists?: boolean): Promise<void>;
  alterTable(table: string, action: string, params: Record<string, unknown>): Promise<void>;
  dropTable(table: string, ifExists?: boolean): Promise<void>;
  createIndex(table: string, columns: string[], indexName?: string, unique?: boolean, ifNotExists?: boolean): Promise<void>;
  dropIndex(indexName: string, ifExists?: boolean): Promise<void>;
  getInfo(): Promise<DatabaseInfo>;
  vacuum(): Promise<{ sizeBefore: number; sizeAfter: number }>;
  integrityCheck(): Promise<{ ok: boolean; results: string[] }>;
  close(): void;
}

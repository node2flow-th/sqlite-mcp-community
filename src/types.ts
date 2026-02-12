/**
 * SQLite MCP - Type Definitions
 */

export interface SqliteConfig {
  dbPath: string;
  readonly?: boolean;
  timeout?: number;
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

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Create a D1-compatible database wrapper for testing.
 * Uses better-sqlite3 under the hood.
 */
export function createTestDb(): D1Database {
  const db = new Database(':memory:');

  // Apply migrations
  const migrationPath = path.join(process.cwd(), 'migrations', '001_initial.sql');
  const migration = fs.readFileSync(migrationPath, 'utf-8');
  db.exec(migration);

  // Return D1-compatible interface
  return {
    prepare(sql: string) {
      return createStatement(db, sql);
    },
    dump() {
      throw new Error('Not implemented');
    },
    batch(statements: D1PreparedStatement[]) {
      return Promise.all(statements.map((stmt) => (stmt as any).run()));
    },
    exec(sql: string) {
      db.exec(sql);
      return Promise.resolve({ count: 0, duration: 0 });
    },
  } as D1Database;
}

function createStatement(db: Database.Database, sql: string) {
  let boundParams: any[] = [];

  const stmt: D1PreparedStatement = {
    bind(...params: any[]) {
      boundParams = params;
      return stmt;
    },
    async first<T>(column?: string): Promise<T | null> {
      const statement = db.prepare(sql);
      const row = statement.get(...boundParams) as Record<string, unknown> | undefined;
      if (!row) return null;
      if (column) return row[column] as T;
      return row as T;
    },
    async run() {
      const statement = db.prepare(sql);
      const result = statement.run(...boundParams);
      return {
        success: true,
        results: [],
        meta: {
          duration: 0,
          changes: result.changes,
          last_row_id: result.lastInsertRowid as number,
          changed_db: result.changes > 0,
          size_after: 0,
          rows_read: 0,
          rows_written: result.changes,
        },
      };
    },
    async all<T>(): Promise<D1Result<T>> {
      const statement = db.prepare(sql);
      const results = statement.all(...boundParams) as T[];
      return {
        success: true,
        results,
        meta: {
          duration: 0,
          changes: 0,
          last_row_id: 0,
          changed_db: false,
          size_after: 0,
          rows_read: results.length,
          rows_written: 0,
        },
      };
    },
    async raw<T>(): Promise<T[]> {
      const statement = db.prepare(sql);
      return statement.raw().all(...boundParams) as T[];
    },
  };

  return stmt;
}

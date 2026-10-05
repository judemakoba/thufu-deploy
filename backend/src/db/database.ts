import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DATABASE_URL?.replace('sqlite:', '').replace('./', '') || 'data/thufu_deploy.db';
const resolvedPath = path.resolve(process.cwd(), dbPath);
const dataDir = path.dirname(resolvedPath);

let db: SqlJsDatabase;
let initPromise: Promise<void>;

// Synchronous guard — throws if db not ready
function withDb<T>(fn: (database: SqlJsDatabase) => T): T {
  if (!db) {
    throw new Error('Database not yet initialized. Call initializeDatabase() first.');
  }
  return fn(db);
}

function getParams(params: unknown[]): (string | number | null | Uint8Array)[] {
  return params as (string | number | null | Uint8Array)[];
}

function persist() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(resolvedPath, Buffer.from(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)));
  } catch (e) {
    console.error('[DB] Persist failed:', e);
  }
}

export function initializeDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const SQL = await initSqlJs();

    if (fs.existsSync(resolvedPath)) {
      const buffer = fs.readFileSync(resolvedPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    // Auto-save every 30 seconds
    setInterval(() => persist(), 30000);

    // Save on exit
    process.on('exit', () => persist());
  })();

  return initPromise.then(() => {
    const schemaPath = path.resolve(__dirname, '..', '..', 'src', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    // Split by 'CREATE' keyword as boundary — handles indexes after tables correctly
    const rawStatements = schema
      .split(/(?=CREATE\s+(?:TABLE|INDEX))/i)
      .map(s => s.replace(/^--.*$/gm, '').trim())
      .filter(s => s.length > 0 && /\bCREATE\b/i.test(s));

    for (const stmt of rawStatements) {
      try {
        db.run(stmt);
      } catch (e) {
        console.error(`[DB Schema] Error on: ${stmt.slice(0, 60)}...`, e);
      }
    }
    persist();
    console.log('[DB] Schema initialized');
  });
}

export function getOne<T>(sql: string, params: unknown[] = []): T | undefined {
  return withDb(database => {
    const stmt = database.prepare(sql);
    stmt.bind(getParams(params));
    if (stmt.step()) {
      const row = stmt.getAsObject() as T;
      stmt.free();
      return row;
    }
    stmt.free();
    return undefined;
  });
}

export function getAll<T>(sql: string, params: unknown[] = []): T[] {
  return withDb(database => {
    const results: T[] = [];
    const stmt = database.prepare(sql);
    stmt.bind(getParams(params));
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  });
}

export function run(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  return withDb(database => {
    database.run(sql, getParams(params));
    persist();
    return { changes: database.getRowsModified(), lastInsertRowid: 0 };
  });
}

export function runMany(sql: string, paramSets: unknown[][]): void {
  withDb(database => {
    for (const params of paramSets) {
      database.run(sql, getParams(params));
    }
    persist();
  });
}

export default { run, getOne, getAll, runMany };

// DB 연결. 운영(Vercel)은 Supabase Postgres, 로컬은 DATABASE_URL이 없으면 임베디드 Postgres(PGlite)를 쓴다.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

export type Row = Record<string, any>;

export interface Sql {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

function connectSupabase(url: string): Db {
  // Supabase 트랜잭션 풀러(6543 포트)는 prepared statement를 지원하지 않는다.
  const sql = postgres(url, { prepare: false, max: 5 });
  const wrap = (s: postgres.Sql | postgres.TransactionSql): Sql => ({
    query: (text, params = []) => s.unsafe(text, params as postgres.ParameterOrJSON<never>[]) as never,
  });
  return {
    ...wrap(sql),
    transaction: (fn) => sql.begin((tx) => fn(wrap(tx))) as never,
  };
}

async function connectLocal(): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const db = new PGlite(process.env.PGLITE_DIR || path.join(process.cwd(), '.pglite'));
  await db.exec(await readFile(path.join(process.cwd(), 'db', 'schema.sql'), 'utf8'));
  type Querier = { query(text: string, params?: unknown[]): Promise<{ rows: unknown[] }> };
  const wrap = (s: Querier): Sql => ({
    query: async (text, params) => (await s.query(text, params)).rows as never,
  });
  return {
    ...wrap(db),
    transaction: (fn) => db.transaction((tx) => fn(wrap(tx))),
  };
}

function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return Promise.resolve(connectSupabase(url));
  if (process.env.VERCEL) throw new Error('DATABASE_URL 환경 변수가 설정되지 않았습니다.');
  return connectLocal();
}

// 개발 서버의 핫 리로드 사이에도 연결을 하나만 유지한다.
const g = globalThis as typeof globalThis & { __bbggDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  g.__bbggDb ??= connect().catch((err) => {
    g.__bbggDb = undefined;
    throw err;
  });
  return g.__bbggDb;
}

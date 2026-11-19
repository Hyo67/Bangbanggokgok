// db/schema.sql을 DATABASE_URL의 Postgres(Supabase)에 적용한다. 여러 번 실행해도 안전하다.
//   npm run db:migrate

import { readFile } from 'node:fs/promises';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 비어 있어요. .env에 Supabase 연결 문자열을 넣어 주세요.');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
try {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  await sql.begin((tx) => tx.unsafe(schema));
  const tables = await sql`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`;
  console.log('스키마 적용 완료:', tables.map((t) => t.table_name).join(', '));
} catch (err) {
  console.error('스키마 적용 실패:', err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}

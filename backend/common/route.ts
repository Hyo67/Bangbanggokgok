// Route Handler 공통 처리: 본문 읽기, JSON 응답, 오류 → 상태 코드 변환

import { HttpError } from './errors';
import type { Body } from './validate';

type Handler<P> = (req: Request, params: P) => Promise<unknown>;

export function route<P = Record<string, never>>(fn: Handler<P>, { status = 200 } = {}) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const data = await fn(req, await ctx.params);
      if (data === null) return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
      const code = err instanceof HttpError ? err.status : 500;
      if (code === 500) console.error(err);
      return Response.json({ error: code === 500 ? '서버 오류가 발생했어요.' : (err as Error).message }, { status: code });
    }
  };
}

export async function readBody(req: Request): Promise<Body> {
  const raw = await req.text();
  if (raw.length > 100_000) throw new HttpError(413, '요청이 너무 커요.');
  if (!raw) return {};
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === 'object' && !Array.isArray(body)) return body;
  } catch {}
  throw new HttpError(400, '요청 형식이 올바르지 않아요.');
}

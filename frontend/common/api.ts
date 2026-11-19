// 백엔드(Route Handlers) 호출. 실패하면 서버가 보낸 안내 문구로 예외를 던진다.

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || '요청을 처리하지 못했어요.');
  return data as T;
}

export const errorText = (err: unknown) => (err instanceof Error ? err.message : '요청을 처리하지 못했어요.');

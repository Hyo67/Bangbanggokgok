// 요청 본문 검증. 실패하면 화면에 그대로 보여 줄 문구로 400을 던진다.

import { randomBytes } from 'node:crypto';
import { HttpError } from './errors';

export type Body = Record<string, unknown>;

export function text(value: unknown, label: string, max: number, required = true): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s && required) throw new HttpError(400, `${label} 항목을 입력해 주세요.`);
  if (s.length > max) throw new HttpError(400, `${label} 항목은 ${max}자 이내로 입력해 주세요.`);
  return s;
}

export function dateStr(value: unknown, label: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${label} 값이 올바르지 않아요.`);
  }
  return value;
}

export const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

// NFR-3: 24바이트(192비트) 랜덤 값 → base64url 32자. 초대 링크에 그대로 들어간다.
export const newTripId = () => randomBytes(24).toString('base64url');
export const newId = () => randomBytes(6).toString('base64url');

// 한국 시각 기준 오늘(±일)의 YYYY-MM-DD
export const kstDate = (offsetDays = 0) =>
  new Date(Date.now() + 9 * 3600e3 + offsetDays * 864e5).toISOString().slice(0, 10);

// 금액·날짜 표시

import { currencyOf, type Trip } from '@/shared/domain';

export const sum = (nums: number[]) => nums.reduce((a, b) => a + b, 0);

export const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

export const localMoney = (trip: Trip, amount: number, currency: string) =>
  currency === 'KRW' ? won(amount) : `${currencyOf(trip.currencyCode).symbol}${amount.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`;

// ฿1 = 39.14원 형식. 1원 미만 통화(IDR 등)도 유효숫자 4자리까지 보여 준다.
export const rateLabel = (currencyCode: string, rate: number) => {
  const opts = rate >= 100 ? { maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 };
  return `${currencyOf(currencyCode).symbol}1 = ${rate.toLocaleString('ko-KR', opts)}원`;
};

export const rateText = (trip: Trip) => rateLabel(trip.currencyCode, trip.fixedExchangeRate ?? 0);

export const parseAmount = (str: string) => Number(String(str).replace(/,/g, '').trim());

const DAYS = '일월화수목금토';
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => iso(new Date());

export function addDays(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  return iso(new Date(y, m - 1, d + days));
}

// 'short' → 8.10 (토), 'long' → 8월 12일 (월)
export function fmtDate(date: string, style: 'short' | 'long' = 'short') {
  const [y, m, d] = date.split('-').map(Number);
  const day = DAYS[new Date(y, m - 1, d).getDay()];
  return style === 'long' ? `${m}월 ${d}일 (${day})` : `${m}.${d} (${day})`;
}

// Currency 모듈 — ExchangeRateService: 네이버 환율 검색으로 실시간 환율을 가져온다 (SS-3)
// 여행방을 만들 때 이 값을 한 번 조회해 fixedExchangeRate로 고정한다 (FR-3.1).

import { CURRENCIES, type Currency } from '@/shared/domain';
import { getDb } from '../common/db';
import { HttpError } from '../common/errors';
import { kstDate } from '../common/validate';
import { findTripRef, loadTrip } from '../trip/tripRepository';

// 네이버 검색의 환율 계산기가 쓰는 엔드포인트. 공식 API가 아니라서 응답 형식이 바뀔 수 있다.
const NAVER_URL = 'https://m.search.naver.com/p/csearch/content/qapirender.nhn';
// 1단위로 조회하면 원화가 소수 둘째 자리에서 잘리므로(IDR 0.07원) 100단위로 조회해 나눈다.
const QUERY_UNITS = 100;
const CACHE_MS = 60_000;

export type FetchedCurrency = Currency & { currencyRate: number; fetchedAt: string };

const cache = new Map<string, FetchedCurrency>();

async function queryNaver(currencyCode: string): Promise<number> {
  const params = new URLSearchParams({
    key: 'calculator',
    pkid: '141',
    q: '환율',
    where: 'm',
    u1: 'keb', // 하나은행 고시 기준
    u6: 'standardUnit',
    u7: '0',
    u3: currencyCode,
    u4: 'KRW',
    u8: 'down',
    u2: String(QUERY_UNITS),
  });
  let body: { country?: { value: string }[] };
  try {
    const res = await fetch(`${NAVER_URL}?${params}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    body = await res.json();
  } catch {
    throw new HttpError(502, '실시간 환율을 불러오지 못했어요.');
  }
  // [0]은 입력한 외화 금액, [1]은 원화 환산 금액('1,331.20' 형식)
  const krw = Number(body.country?.[1]?.value?.replaceAll(',', ''));
  if (!(krw > 0)) throw new HttpError(502, `${currencyCode} 환율 정보를 찾지 못했어요.`);
  return krw / QUERY_UNITS;
}

// 원화 / 현지 통화 1단위. 같은 통화는 1분 동안 다시 조회하지 않는다.
export async function fetchRate(nationName: string): Promise<FetchedCurrency> {
  const currency = CURRENCIES.find((c) => c.nationName === nationName);
  if (!currency) throw new HttpError(400, '지원하지 않는 여행 국가예요.');
  const hit = cache.get(currency.currencyCode);
  if (hit && Date.now() - Date.parse(hit.fetchedAt) < CACHE_MS) return hit;
  const fetched: FetchedCurrency = {
    currencyCode: currency.currencyCode,
    nationName,
    currencyRate: await queryNaver(currency.currencyCode),
    fetchedAt: new Date().toISOString(),
  };
  cache.set(currency.currencyCode, fetched);
  return fetched;
}

export function fetchRateByCode(currencyCode: string) {
  const currency = CURRENCIES.find((c) => c.currencyCode === currencyCode);
  if (!currency) throw new HttpError(404, '지원하지 않는 통화예요.');
  return fetchRate(currency.nationName);
}

// 여행방을 만들 때 환율 조회에 실패했다면 다시 시도한다.
// FR-3.2: 한 번 저장된 환율은 다시 조회해 덮어쓰지 않는다.
export async function refetchTripRate(tripId: string) {
  const db = await getDb();
  const trip = await findTripRef(db, tripId);
  if (trip.fixedExchangeRate != null) throw new HttpError(409, '이미 고정된 환율이 있어요.');
  const { currencyRate } = await fetchRateByCode(trip.currencyCode);
  const updated = await db.query(
    `update trips set fixed_exchange_rate = $2, rate_date = $3, version = version + 1
      where trip_id = $1 and fixed_exchange_rate is null returning trip_id`,
    [tripId, currencyRate, kstDate()],
  );
  if (updated.length === 0) throw new HttpError(409, '이미 고정된 환율이 있어요.');
  return { trip: await loadTrip(tripId) };
}

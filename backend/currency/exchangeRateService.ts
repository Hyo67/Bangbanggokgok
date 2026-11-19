// Currency 모듈 — ExchangeRateService: 한국수출입은행 환율 API로 고정 환율을 가져온다 (SS-3)

import { CURRENCIES, type Currency } from '@/shared/domain';
import { getDb } from '../common/db';
import { HttpError } from '../common/errors';
import { kstDate } from '../common/validate';
import { findTripRef, loadTrip } from '../trip/tripRepository';

const EXIM_URL = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';

interface EximRow {
  result: number; // 1 성공, 2 DATA 코드 오류, 3 인증키 오류, 4 일일 호출 제한 초과
  cur_unit: string; // 'THB', 'JPY(100)' …
  deal_bas_r: string; // 매매 기준율, '1,234.56'
}

export type FetchedCurrency = Currency & { currencyRate: number; rateDate: string };

// 나라 이름으로 통화를 찾아 오늘(없으면 직전 영업일) 매매 기준율을 조회한다.
// 조회에 실패하면 임의 값을 쓰지 않고 예외를 던진다.
export async function fetchRate(nationName: string): Promise<FetchedCurrency> {
  const currency = CURRENCIES.find((c) => c.nationName === nationName);
  if (!currency) throw new HttpError(400, '지원하지 않는 여행 국가예요.');
  const key = process.env.EXIM_API_KEY;
  if (!key) throw new HttpError(502, '환율 API 키(EXIM_API_KEY)가 서버에 설정되지 않았어요.');

  // 주말·공휴일이나 영업일 오전 11시 이전에는 빈 배열이 내려오므로 직전 영업일까지 거슬러 올라간다.
  for (let back = 0; back < 7; back++) {
    const date = kstDate(-back);
    const url = `${EXIM_URL}?authkey=${encodeURIComponent(key)}&searchdate=${date.replaceAll('-', '')}&data=AP01`;
    let rows: EximRow[];
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      rows = await res.json();
    } catch {
      throw new HttpError(502, '한국수출입은행 환율 서버에 연결하지 못했어요.');
    }
    if (!Array.isArray(rows) || rows.length === 0) continue;
    if (rows[0].result !== 1) {
      const why = ({ 3: '인증키가 올바르지 않아요.', 4: '일일 호출 한도를 초과했어요.' } as Record<number, string>)[rows[0].result];
      throw new HttpError(502, `환율을 조회하지 못했어요. ${why ?? ''}`.trim());
    }
    const code = currency.currencyCode;
    const row = rows.find((r) => r.cur_unit === code || r.cur_unit?.startsWith(`${code}(`));
    if (!row) throw new HttpError(502, `${code} 환율 정보를 찾지 못했어요.`);
    // JPY(100), IDR(100)처럼 100단위로 고시되는 통화는 1단위로 환산한다.
    const unit = Number(/\((\d+)\)/.exec(row.cur_unit)?.[1] ?? 1);
    const currencyRate = Number(row.deal_bas_r.replaceAll(',', '')) / unit;
    if (!(currencyRate > 0)) throw new HttpError(502, '환율 값이 올바르지 않아요.');
    return { currencyCode: code, nationName, currencyRate, rateDate: date };
  }
  throw new HttpError(502, '최근 영업일의 환율 고시를 찾지 못했어요.');
}

// 여행방을 만들 때 환율 조회에 실패했다면 다시 시도한다.
// FR-3.2: 한 번 저장된 환율은 다시 조회해 덮어쓰지 않는다.
export async function refetchTripRate(tripId: string) {
  const db = await getDb();
  const trip = await findTripRef(db, tripId);
  if (trip.fixedExchangeRate != null) throw new HttpError(409, '이미 고정된 환율이 있어요.');
  const fetched = await fetchRate(CURRENCIES.find((c) => c.currencyCode === trip.currencyCode)!.nationName);
  const updated = await db.query(
    `update trips set fixed_exchange_rate = $2, rate_date = $3, version = version + 1
      where trip_id = $1 and fixed_exchange_rate is null returning trip_id`,
    [tripId, fetched.currencyRate, fetched.rateDate],
  );
  if (updated.length === 0) throw new HttpError(409, '이미 고정된 환율이 있어요.');
  return { trip: await loadTrip(tripId) };
}

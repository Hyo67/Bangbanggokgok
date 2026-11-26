// Trip 모듈 — 여행방 읽기와 잠금. 다른 모듈의 서비스가 여행방에 접근할 때 쓴다.

import { convertToKRW, generateInviteLink, TRIP_ID_RE, type Trip } from '@/shared/domain';
import { getDb, type Sql } from '../common/db';
import { HttpError } from '../common/errors';

export interface TripRef {
  tripId: string;
  currencyCode: string;
  fixedExchangeRate: number | null;
}

const NOT_FOUND = '여행방을 찾을 수 없어요. 링크를 다시 확인해 주세요.';
// 다른 서비스가 여행방에 쓰기 전에 여행방을 찾는다.
// lock이면 트랜잭션이 끝날 때까지 같은 여행방에 대한 다른 쓰기를 기다리게 한다.
export async function findTripRef(sql: Sql, tripId: string, { lock = false } = {}): Promise<TripRef> {
  const [row] = TRIP_ID_RE.test(tripId)
    ? await sql.query<{ currency_code: string; fixed_exchange_rate: string | null }>(
        `select currency_code, fixed_exchange_rate from trips where trip_id = $1${lock ? ' for update' : ''}`,
        [tripId],
      )
    : [];
  if (!row) throw new HttpError(404, NOT_FOUND);
  return {
    tripId,
    currencyCode: row.currency_code,
    fixedExchangeRate: row.fixed_exchange_rate == null ? null : Number(row.fixed_exchange_rate),
  };
}

// 여행방을 잠근 채로 쓰기 작업을 한 뒤, 바뀐 여행방 전체와 작업 결과를 돌려준다.
export async function withLockedTrip<T>(tripId: string, fn: (tx: Sql, trip: TripRef) => Promise<T>) {
  const db = await getDb();
  const result = await db.transaction(async (tx) => fn(tx, await findTripRef(tx, tripId, { lock: true })));
  return { trip: await loadTrip(tripId), result };
}

// 여행방 전체 상태를 한 번의 쿼리로 JSON으로 만든다.
const SNAPSHOT = `
select json_build_object(
  'tripId', t.trip_id, 'version', t.version, 'title', t.title, 'currencyCode', t.currency_code,
  'fixedExchangeRate', t.fixed_exchange_rate, 'rateDate', t.rate_date::text, 'rateSample', t.rate_sample,
  'startDate', t.start_date::text, 'endDate', t.end_date::text, 'createdAt', t.created_at,
  'members', coalesce((
    select json_agg(json_build_object('memberId', m.member_id, 'tripId', m.trip_id, 'name', m.name) order by m.created_at)
      from members m where m.trip_id = t.trip_id), '[]'),
  'categories', coalesce((
    select json_agg(json_build_object(
             'categoryId', c.category_id, 'tripId', c.trip_id, 'name', c.name,
             'sortOrder', c.sort_order, 'isDefault', c.is_default)
           order by c.sort_order)
      from trip_categories c where c.trip_id = t.trip_id), '[]'),
  'expenses', coalesce((
    select json_agg(json_build_object(
             'expenseId', e.expense_id, 'tripId', e.trip_id, 'memberId', e.member_id, 'categoryId', e.category_id,
             'caption', e.caption, 'amount', e.amount, 'currency', e.currency, 'date', e.spent_on::text,
             'memo', e.memo, 'createdAt', e.created_at, 'exchangeRate', e.exchange_rate,
             'isSettled', exists (
               select 1 from settlement_expenses se join settlements s on s.settlement_id = se.settlement_id
                where se.expense_id = e.expense_id and s.status <> 'CANCELLED'))
           order by e.position)
      from expenses e where e.trip_id = t.trip_id), '[]'),
  'settlements', coalesce((
    select json_agg(json_build_object(
             'settlementId', s.settlement_id, 'tripId', s.trip_id, 'requesterId', s.requester_id,
             'totalAmount', s.total_amount, 'status', s.status, 'createdAt', s.created_at,
             'selectedExpenses', (
               select json_agg(json_build_object(
                        'expenseId', se.expense_id, 'caption', se.caption, 'amount', se.amount,
                        'currency', se.currency, 'date', se.spent_on::text, 'krw', se.krw)
                      order by se.position)
                 from settlement_expenses se where se.settlement_id = s.settlement_id),
             'targets', (
               select json_agg(json_build_object(
                        'targetId', st.target_id, 'settlementId', st.settlement_id, 'memberId', st.member_id,
                        'amount', st.amount, 'status', st.status)
                      order by st.position)
                 from settlement_targets st where st.settlement_id = s.settlement_id))
           order by s.created_at desc)
      from settlements s where s.trip_id = t.trip_id), '[]')
) as trip, t.version
from trips t where t.trip_id = $1`;

// knownVersion이 현재 버전과 같으면 본문 없이 null을 돌려준다(폴링).
export async function loadTrip(tripId: string): Promise<Trip>;
export async function loadTrip(tripId: string, knownVersion: number | null): Promise<Trip | null>;
export async function loadTrip(tripId: string, knownVersion: number | null = null): Promise<Trip | null> {
  const db = await getDb();
  const [row] = TRIP_ID_RE.test(tripId)
    ? await db.query<{ trip: Omit<Trip, 'inviteLink' | 'totalExpense'>; version: number }>(SNAPSHOT, [tripId])
    : [];
  if (!row) throw new HttpError(404, NOT_FOUND);
  if (knownVersion === row.version) return null;
  const trip = row.trip;
  const krw = trip.expenses.map((e) => convertToKRW(trip, e));
  return {
    ...trip,
    inviteLink: generateInviteLink(trip.tripId),
    totalExpense: krw.includes(null) ? null : krw.reduce<number>((a, b) => a + b!, 0),
  };
}

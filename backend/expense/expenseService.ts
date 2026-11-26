// Expense 모듈 — ExpenseService: 지출 추가(Trip.addExpense)·수정·삭제·순서 변경 (SS-2, SS-4)

import type { Sql } from '../common/db';
import { HttpError } from '../common/errors';
import { dateStr, newId, strings, text, type Body } from '../common/validate';
import { assertMember } from '../trip/memberService';
import { withLockedTrip, type TripRef } from '../trip/tripRepository';

// 응답에는 바뀐 여행방 전체만 담는다.
const mutate = async (tripId: string, fn: (tx: Sql, trip: TripRef) => Promise<void>) => ({
  trip: (await withLockedTrip(tripId, fn)).trip,
});

async function parseExpense(tx: Sql, trip: TripRef, body: Body) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new HttpError(400, '금액을 올바르게 입력해 주세요.');
  if (body.currency !== trip.currencyCode && body.currency !== 'KRW') throw new HttpError(400, '통화가 올바르지 않아요.');
  const [category] =
    typeof body.categoryId === 'string'
      ? await tx.query('select 1 from trip_categories where trip_id = $1 and category_id = $2', [trip.tripId, body.categoryId])
      : [];
  if (!category) throw new HttpError(400, '카테고리를 선택해 주세요.');
  return {
    caption: text(body.caption, '내용', 40),
    amount: Math.round(amount * 100) / 100,
    currency: body.currency,
    categoryId: body.categoryId as string,
    date: dateStr(body.date, '날짜'),
    memberId: await assertMember(tx, trip.tripId, body.memberId, '지출한 사람'),
    memo: text(body.memo, '메모', 200, false),
  };
}

// 지출별 실시간 환율. 원화 지출이면 쓰지 않는다.
// undefined: 지금 값 유지(수정할 때만), null: 여행방 고정 환율, 숫자: 화면에서 조회한 실시간 환율
function parseRate(body: Body): number | null | undefined {
  if (body.currency === 'KRW') return null;
  if (body.exchangeRate === undefined) return undefined;
  if (body.exchangeRate === null) return null;
  const rate = Number(body.exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1e6) throw new HttpError(400, '환율이 올바르지 않아요.');
  return rate;
}

export const createExpense = (tripId: string, body: Body) =>
  mutate(tripId, async (tx, trip) => {
    const e = await parseExpense(tx, trip, body);
    // 새 내역은 목록 맨 위에 둔다.
    await tx.query(
      `insert into expenses (expense_id, trip_id, member_id, category_id, caption, amount, currency, spent_on, memo, exchange_rate, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               (select coalesce(min(position), 0) - 1 from expenses where trip_id = $2))`,
      [newId(), tripId, e.memberId, e.categoryId, e.caption, e.amount, e.currency, e.date, e.memo, parseRate(body) ?? null],
    );
  });

export const updateExpense = (tripId: string, expenseId: string, body: Body) =>
  mutate(tripId, async (tx, trip) => {
    const e = await parseExpense(tx, trip, body);
    const rate = parseRate(body);
    const rows = await tx.query(
      `update expenses set member_id = $3, category_id = $4, caption = $5, amount = $6, currency = $7, spent_on = $8, memo = $9,
              exchange_rate = case when $10::text = 'keep' then exchange_rate else $11::numeric end
        where trip_id = $1 and expense_id = $2 returning 1`,
      [tripId, expenseId, e.memberId, e.categoryId, e.caption, e.amount, e.currency, e.date, e.memo, rate === undefined ? 'keep' : 'set', rate ?? null],
    );
    if (rows.length === 0) throw new HttpError(404, '이미 삭제된 내역이에요.');
  });

export const deleteExpense = (tripId: string, expenseId: string) =>
  mutate(tripId, async (tx) => {
    const rows = await tx.query('delete from expenses where trip_id = $1 and expense_id = $2 returning 1', [tripId, expenseId]);
    if (rows.length === 0) throw new HttpError(404, '이미 삭제된 내역이에요.');
  });

// FR-4.6: 화면에서 바꾼 전체 순서를 받아 그대로 저장한다.
export const reorderExpenses = (tripId: string, body: Body) =>
  mutate(tripId, async (tx) => {
    const ids = strings(body.ids);
    const current = await tx.query<{ expense_id: string }>('select expense_id from expenses where trip_id = $1', [tripId]);
    const known = new Set(current.map((r) => r.expense_id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || !ids.every((id) => known.has(id))) {
      throw new HttpError(409, '그 사이 목록이 바뀌었어요. 다시 시도해 주세요.');
    }
    await tx.query(
      `update expenses e set position = o.ord
         from json_array_elements_text($2::text::json) with ordinality as o(id, ord)
        where e.trip_id = $1 and e.expense_id = o.id and e.position <> o.ord`,
      [tripId, JSON.stringify(ids)],
    );
  });

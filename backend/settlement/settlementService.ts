// Settlement 모듈 — SettlementService: 정산 요청·취소, 정산 대상별 상태 변경 (SS-5)

import { calculateTotal, convertToKRW, SETTLEMENT_STATUSES, type SelectedExpense, type SettlementStatus } from '@/shared/domain';
import type { Sql } from '../common/db';
import { HttpError } from '../common/errors';
import { newId, strings, type Body } from '../common/validate';
import { assertMember } from '../trip/memberService';
import { withLockedTrip, type TripRef } from '../trip/tripRepository';

const mutate = async (tripId: string, fn: (tx: Sql, trip: TripRef) => Promise<void>) => ({
  trip: (await withLockedTrip(tripId, fn)).trip,
});

// FR-5.6: 요청 시점의 항목과 금액을 복사해 두어 원본이 바뀌어도 소급되지 않게 한다.
async function selectExpenses(tx: Sql, trip: TripRef, expenseIds: string[]): Promise<SelectedExpense[]> {
  const ids = [...new Set(expenseIds)];
  if (ids.length === 0) throw new HttpError(400, '정산할 내역을 선택해 주세요.');
  const rows = await tx.query<{
    expense_id: string;
    caption: string;
    amount: string;
    currency: string;
    exchange_rate: string | null;
    date: string;
    settled: boolean;
  }>(
    `select e.expense_id, e.caption, e.amount, e.currency, e.exchange_rate, e.spent_on::text as date,
            exists (select 1 from settlement_expenses se join settlements s on s.settlement_id = se.settlement_id
                     where se.expense_id = e.expense_id and s.status <> 'CANCELLED') as settled
       from expenses e
      where e.trip_id = $1 and e.expense_id in (select json_array_elements_text($2::text::json))`,
    [trip.tripId, JSON.stringify(ids)],
  );
  return ids.map((id) => {
    const e = rows.find((r) => r.expense_id === id);
    if (!e) throw new HttpError(409, '선택한 내역 중 삭제된 항목이 있어요. 다시 선택해 주세요.');
    if (e.settled) throw new HttpError(409, `'${e.caption}'은(는) 이미 정산 요청에 들어간 내역이에요.`);
    const amount = Number(e.amount);
    const exchangeRate = e.exchange_rate == null ? null : Number(e.exchange_rate);
    const krw = convertToKRW(trip, { amount, currency: e.currency, exchangeRate });
    if (krw == null) throw new HttpError(409, '고정 환율이 저장된 뒤에 정산을 요청할 수 있어요.');
    return { expenseId: e.expense_id, caption: e.caption, amount, currency: e.currency, date: e.date, krw };
  });
}

// body: { expenseIds, requesterId, targets: [{ memberId, amount }] }
export const requestSettlement = (tripId: string, body: Body) =>
  mutate(tripId, async (tx, trip) => {
    const selected = await selectExpenses(tx, trip, strings(body.expenseIds));
    const totalAmount = calculateTotal(selected);
    const requesterId = await assertMember(tx, tripId, body.requesterId, '받을 사람');

    const seen = new Set<string>();
    const targets: { memberId: string; amount: number }[] = [];
    for (const t of Array.isArray(body.targets) ? body.targets : []) {
      const memberId = await assertMember(tx, tripId, t?.memberId, '정산 대상');
      if (seen.has(memberId)) throw new HttpError(400, '정산 대상이 중복됐어요.');
      seen.add(memberId);
      if (!Number.isInteger(t.amount) || t.amount < 0) throw new HttpError(400, '분담 금액이 올바르지 않아요.');
      targets.push({ memberId, amount: t.amount });
    }
    if (!targets.some((t) => t.memberId !== requesterId)) throw new HttpError(400, '정산을 요청할 멤버를 선택해 주세요.');
    if (targets.reduce((sum, t) => sum + t.amount, 0) !== totalAmount) throw new HttpError(400, '분담 금액의 합이 총액과 같아야 해요.');

    const settlementId = newId();
    await tx.query(
      'insert into settlements (settlement_id, trip_id, requester_id, total_amount) values ($1, $2, $3, $4)',
      [settlementId, tripId, requesterId, totalAmount],
    );
    for (const [i, e] of selected.entries()) {
      await tx.query(
        `insert into settlement_expenses (settlement_id, position, expense_id, caption, amount, currency, spent_on, krw)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [settlementId, i, e.expenseId, e.caption, e.amount, e.currency, e.date, e.krw],
      );
    }
    for (const [i, t] of targets.entries()) {
      // 받는 사람 몫은 처음부터 정산 완료로 본다.
      await tx.query(
        'insert into settlement_targets (target_id, settlement_id, member_id, amount, status, position) values ($1, $2, $3, $4, $5, $6)',
        [newId(), settlementId, t.memberId, t.amount, t.memberId === requesterId ? 'COMPLETED' : 'PENDING', i],
      );
    }
  });

async function openSettlement(tx: Sql, tripId: string, settlementId: string) {
  const [st] = await tx.query<{ status: SettlementStatus; requester_id: string }>(
    'select status, requester_id from settlements where trip_id = $1 and settlement_id = $2',
    [tripId, settlementId],
  );
  if (!st) throw new HttpError(404, '정산 요청을 찾을 수 없어요.');
  if (st.status === 'CANCELLED') throw new HttpError(409, '이미 취소된 정산 요청이에요.');
  return st;
}

export const cancelSettlement = (tripId: string, settlementId: string) =>
  mutate(tripId, async (tx) => {
    await openSettlement(tx, tripId, settlementId);
    await tx.query(`update settlements set status = 'CANCELLED' where settlement_id = $1`, [settlementId]);
    await tx.query(`update settlement_targets set status = 'CANCELLED' where settlement_id = $1`, [settlementId]);
  });

// SettlementTarget.updateStatus: 보냄 확인(COMPLETED) 또는 되돌리기(PENDING).
// 모든 대상이 완료되면 정산 요청도 완료된다.
export const updateTargetStatus = (tripId: string, settlementId: string, targetId: string, body: Body) =>
  mutate(tripId, async (tx) => {
    const status = body.status as SettlementStatus;
    if (!SETTLEMENT_STATUSES.includes(status) || status === 'CANCELLED') throw new HttpError(400, '지원하지 않는 상태예요.');
    const st = await openSettlement(tx, tripId, settlementId);
    const rows = await tx.query(
      'update settlement_targets set status = $3 where settlement_id = $1 and target_id = $2 and member_id <> $4 returning 1',
      [settlementId, targetId, status, st.requester_id],
    );
    if (rows.length === 0) throw new HttpError(400, '정산 대상이 아니에요.');
    await tx.query(
      `update settlements set status = case
          when (select bool_and(status = 'COMPLETED') from settlement_targets where settlement_id = $1) then 'COMPLETED'
          else 'PENDING' end
        where settlement_id = $1`,
      [settlementId],
    );
  });

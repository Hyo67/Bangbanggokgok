// Trip 모듈 — TripService: 여행방 생성·조회, 초대 링크, 멤버·카테고리 추가 (SS-1)

import { currencyOf } from '@/shared/domain';
import { getDb, type Sql } from '../common/db';
import { HttpError } from '../common/errors';
import { dateStr, kstDate, newId, newTripId, text, type Body } from '../common/validate';
import { fetchRate, type FetchedCurrency } from '../currency/exchangeRateService';
import { createDefaultCategories, MAX_CATEGORIES } from './categoryService';
import { loadTrip, withLockedTrip } from './tripRepository';

const MAX_MEMBERS = 20;

/* ---------- Trip.addMember / removeMember ---------- */

// 같은 이름이 이미 있으면 그 멤버로 참여한다.
export async function addMember(tx: Sql, tripId: string, rawName: unknown): Promise<string> {
  const name = text(rawName, '이름', 12);
  const [existing] = await tx.query<{ member_id: string }>('select member_id from members where trip_id = $1 and name = $2', [tripId, name]);
  if (existing) return existing.member_id;
  const [{ count }] = await tx.query<{ count: number }>('select count(*)::int as count from members where trip_id = $1', [tripId]);
  if (count >= MAX_MEMBERS) throw new HttpError(400, `멤버는 ${MAX_MEMBERS}명까지 참여할 수 있어요.`);
  const memberId = newId();
  await tx.query('insert into members (member_id, trip_id, name) values ($1, $2, $3)', [memberId, tripId, name]);
  return memberId;
}

// 지출이나 정산에 이름이 남아 있는 멤버는 기록이 어긋나지 않도록 뺄 수 없다.
export async function removeMember(tx: Sql, tripId: string, memberId: string) {
  const [row] = await tx.query<{ members: number; used: boolean }>(
    `select (select count(*)::int from members where trip_id = $1) as members,
            exists (select 1 from expenses where member_id = $2)
         or exists (select 1 from settlements where requester_id = $2)
         or exists (select 1 from settlement_targets where member_id = $2) as used
       from members where trip_id = $1 and member_id = $2`,
    [tripId, memberId],
  );
  if (!row) throw new HttpError(404, '이미 여행방에 없는 멤버예요.');
  if (row.members <= 1) throw new HttpError(409, '여행방에는 멤버가 한 명 이상 있어야 해요.');
  if (row.used) throw new HttpError(409, '지출이나 정산 기록이 있는 멤버는 나갈 수 없어요.');
  await tx.query('delete from members where member_id = $1', [memberId]);
}

/* ---------- Trip.addCategory ---------- */

export async function addCategory(tx: Sql, tripId: string, rawName: unknown): Promise<string> {
  const name = text(rawName, '카테고리 이름', 10);
  const [row] = await tx.query<{ count: number; taken: boolean; next: number }>(
    `select count(*)::int as count, bool_or(name = $2) as taken, coalesce(max(sort_order), 0) + 1 as next
       from trip_categories where trip_id = $1`,
    [tripId, name],
  );
  if (row.taken) throw new HttpError(409, '같은 이름의 카테고리가 이미 있어요.');
  if (row.count >= MAX_CATEGORIES) throw new HttpError(400, `카테고리는 ${MAX_CATEGORIES}개까지 만들 수 있어요.`);
  const categoryId = newId();
  await tx.query(
    'insert into trip_categories (category_id, trip_id, name, sort_order, is_default) values ($1, $2, $3, $4, false)',
    [categoryId, tripId, name, row.next],
  );
  return categoryId;
}

export async function createCategory(tripId: string, name: unknown) {
  const { trip, result } = await withLockedTrip(tripId, (tx) => addCategory(tx, tripId, name));
  return { trip, categoryId: result };
}

/* ---------- Trip.createTrip ---------- */

export async function createTrip(body: Body) {
  const title = text(body.title, '여행 이름', 20);
  if (typeof body.currencyCode !== 'string' || !currencyOf(body.currencyCode)) throw new HttpError(400, '여행 국가를 선택해 주세요.');
  const startDate = dateStr(body.startDate, '시작일');
  const endDate = dateStr(body.endDate, '종료일');
  if (endDate < startDate) throw new HttpError(400, '종료일이 시작일보다 빠를 수 없어요.');
  text(body.myName, '이름', 12);

  // FR-3.1 / CON-1: 여행방 생성 시점에 한 번만 조회한다. 실패하면 환율 없이 만들고 재시도를 안내한다.
  let rate: FetchedCurrency | null = null;
  let rateError: string | null = null;
  try {
    rate = await fetchRate(currencyOf(body.currencyCode).nationName);
  } catch (err) {
    rateError = (err as Error).message;
  }

  const tripId = newTripId();
  const db = await getDb();
  const memberId = await db.transaction(async (tx) => {
    await tx.query(
      `insert into trips (trip_id, title, currency_code, fixed_exchange_rate, rate_date, start_date, end_date)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [tripId, title, body.currencyCode, rate?.currencyRate ?? null, rate?.rateDate ?? null, startDate, endDate],
    );
    await createDefaultCategories(tx, tripId);
    return addMember(tx, tripId, body.myName);
  });
  return { trip: await loadTrip(tripId), memberId, rateError };
}

// 와이어프레임의 예시 데이터를 담은 둘러보기용 여행방. 환율은 실제 조회 값이 아닌 샘플이다.
export async function createDemoTrip() {
  const names = ['지효', '수민', '지영'];
  const rows: [number, string, number, number, number][] = [
    // [날짜(오늘 기준), 내용, 금액(THB), 기본 카테고리 순번, 지출한 사람]
    [0, '현지 식당', 500, 0, 0],
    [0, '택시', 300, 1, 1],
    [0, '기념품', 1200, 3, 2],
    [0, '호텔', 3000, 2, 0],
    [-1, '카페', 200, 0, 1],
    [-1, '야시장', 1500, 3, 2],
    [-1, '지하철', 100, 1, 0],
  ];
  const tripId = newTripId();
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into trips (trip_id, title, currency_code, fixed_exchange_rate, rate_date, rate_sample, start_date, end_date)
       values ($1, '방콕 여행', 'THB', 42, $2, true, $2, $3)`,
      [tripId, kstDate(-2), kstDate(3)],
    );
    const categories = await createDefaultCategories(tx, tripId);
    const members: string[] = [];
    for (const name of names) members.push(await addMember(tx, tripId, name));
    for (const [i, [day, caption, amount, cat, who]] of rows.entries()) {
      await tx.query(
        `insert into expenses (expense_id, trip_id, member_id, category_id, caption, amount, currency, spent_on, position)
         values ($1, $2, $3, $4, $5, $6, 'THB', $7, $8)`,
        [newId(), tripId, members[who], categories[cat], caption, amount, kstDate(day), i],
      );
    }
  });
  return { trip: await loadTrip(tripId) };
}

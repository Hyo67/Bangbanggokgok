// Trip 모듈 — MemberService: 참여, 이름 바꾸기, 여행방 나가기 (회원가입 없이 이름만으로 참여)

import { HttpError } from '../common/errors';
import type { Sql } from '../common/db';
import { text, type Body } from '../common/validate';
import { withLockedTrip } from './tripRepository';
import { addMember, removeMember } from './tripService';

export async function assertMember(tx: Sql, tripId: string, memberId: unknown, label: string): Promise<string> {
  const rows = typeof memberId === 'string' ? await tx.query('select 1 from members where trip_id = $1 and member_id = $2', [tripId, memberId]) : [];
  if (rows.length === 0) throw new HttpError(400, `${label}(으)로 고른 사람이 여행방 멤버가 아니에요.`);
  return memberId as string;
}

export async function joinTrip(tripId: string, body: Body) {
  const { trip, result } = await withLockedTrip(tripId, (tx) => addMember(tx, tripId, body.name));
  return { trip, memberId: result };
}

export const updateName = (tripId: string, memberId: string, body: Body) =>
  withLockedTrip(tripId, async (tx) => {
    const name = text(body.name, '이름', 12);
    const [taken] = await tx.query('select 1 from members where trip_id = $1 and name = $2 and member_id <> $3', [tripId, name, memberId]);
    if (taken) throw new HttpError(409, '같은 이름의 멤버가 이미 있어요.');
    const rows = await tx.query('update members set name = $3 where trip_id = $1 and member_id = $2 returning 1', [tripId, memberId, name]);
    if (rows.length === 0) throw new HttpError(404, '이미 여행방에 없는 멤버예요.');
  }).then(({ trip }) => ({ trip }));

export const leaveTrip = (tripId: string, memberId: string) =>
  withLockedTrip(tripId, (tx) => removeMember(tx, tripId, memberId)).then(({ trip }) => ({ trip }));

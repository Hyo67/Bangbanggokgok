// User 모듈 — 회원가입이 없으므로 "이 브라우저의 사용자"를 브라우저에 기억한다.
//   · 여행방마다 내가 어떤 멤버로 참여했는지
//   · 최근에 연 여행방 목록

import type { Trip } from '@/shared/domain';

const meKey = (tripId: string) => `bbgg:me:${tripId}`;
const RECENT_KEY = 'bbgg:recent';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};

// 저장된 멤버가 여행방에서 사라졌으면 다시 고르게 한다.
export function loadMe(trip: Trip): string | null {
  const id = read(meKey(trip.tripId));
  return trip.members.some((m) => m.memberId === id) ? id : null;
}

export const saveMe = (tripId: string, memberId: string) => write(meKey(tripId), memberId);
export const forgetMe = (tripId: string) => {
  try {
    localStorage.removeItem(meKey(tripId));
  } catch {}
};

export interface RecentTrip {
  tripId: string;
  title: string;
}

export function recentTrips(): RecentTrip[] {
  try {
    // 예전 형식({ token, name })으로 저장된 항목은 버린다.
    return (JSON.parse(read(RECENT_KEY) ?? '[]') as RecentTrip[]).filter((t) => t.tripId);
  } catch {
    return [];
  }
}

export function rememberTrip(trip: Trip) {
  const list = [{ tripId: trip.tripId, title: trip.title }, ...recentTrips().filter((t) => t.tripId !== trip.tripId)];
  write(RECENT_KEY, JSON.stringify(list.slice(0, 5)));
}

// 방금 만든 여행방이면 들어가자마자 공유 안내를 띄운다.
let justCreated: string | null = null;
export const markJustCreated = (tripId: string) => (justCreated = tripId);
export function consumeJustCreated(tripId: string) {
  const hit = justCreated === tripId;
  justCreated = null;
  return hit;
}

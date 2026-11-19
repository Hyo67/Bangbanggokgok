'use client';

// 여행방 상태: 서버에서 받은 여행방, 이 브라우저의 참여자, 변경 요청, 4초 간격 동기화

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Trip, TripCategory } from '@/shared/domain';
import { api } from '../common/api';
import { forgetMe, loadMe, rememberTrip, saveMe } from '../user/userService';

export type View = 'record' | 'list' | 'settle';

interface TripState {
  trip: Trip;
  me: string | null | undefined; // undefined: 아직 브라우저 저장소를 읽지 않음
  setMe(memberId: string | null): void;
  mutate<T = object>(method: string, sub: string, body?: unknown): Promise<T & { trip: Trip }>;
  path(view?: Exclude<View, 'record'>): string;
  memberName(memberId: string): string;
  categoryOf(categoryId: string): TripCategory | undefined;
  // 정산할 내역을 고르는 중이면 Set<expenseId>
  selection: Set<string> | null;
  setSelection(next: Set<string> | null): void;
  filter: string; // 'all' 또는 categoryId
  setFilter(next: string): void;
}

const TripContext = createContext<TripState | null>(null);
export const useTrip = () => useContext(TripContext)!;

const POLL_MS = 4000;

export function TripProvider({ initialTrip, children }: { initialTrip: Trip; children: ReactNode }) {
  const [trip, setTripState] = useState(initialTrip);
  // 늦게 도착한 폴링 응답이 더 새로운 상태를 덮어쓰지 않게 한다.
  const setTrip = useCallback((next: Trip) => setTripState((prev) => (next.version >= prev.version ? next : prev)), []);
  const [me, setMeState] = useState<string | null | undefined>(undefined);
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [filter, setFilter] = useState('all');
  const { tripId } = initialTrip;

  const version = useRef(trip.version);
  version.current = trip.version;

  useEffect(() => {
    setMeState(loadMe(initialTrip));
    rememberTrip(initialTrip);
  }, [initialTrip]);

  // 다른 멤버가 나를 내보냈거나 이름 목록이 바뀌면 다시 고르게 한다.
  useEffect(() => {
    if (me && !trip.members.some((m) => m.memberId === me)) setMeState(null);
  }, [me, trip.members]);

  // 지운 카테고리로 거르고 있었다면 전체로 돌린다.
  useEffect(() => {
    if (filter !== 'all' && !trip.categories.some((c) => c.categoryId === filter)) setFilter('all');
  }, [filter, trip.categories]);

  // 다른 멤버의 변경을 가져온다. 버전이 같으면 서버가 본문 없이 204로 답한다.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const data = await api<{ trip: Trip }>('GET', `/api/trips/${tripId}?v=${version.current}`);
        if (data) setTrip(data.trip);
      } catch {}
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [tripId, setTrip]);

  const setMe = useCallback(
    (memberId: string | null) => {
      if (memberId) saveMe(tripId, memberId);
      else forgetMe(tripId);
      setMeState(memberId);
    },
    [tripId],
  );

  const mutate = useCallback(
    async <T,>(method: string, sub: string, body?: unknown) => {
      const data = (await api<T & { trip: Trip }>(method, `/api/trips/${tripId}${sub}`, body))!;
      setTrip(data.trip);
      return data;
    },
    [tripId, setTrip],
  );

  const value: TripState = {
    trip,
    me,
    setMe,
    mutate,
    path: (view) => `${trip.inviteLink}${view ? `/${view}` : ''}`,
    memberName: (memberId) => trip.members.find((m) => m.memberId === memberId)?.name ?? '나간 멤버',
    categoryOf: (categoryId) => trip.categories.find((c) => c.categoryId === categoryId),
    selection,
    setSelection,
    filter,
    setFilter,
  };
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

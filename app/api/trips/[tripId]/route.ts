import { route } from '@/backend/common/route';
import { loadTrip } from '@/backend/trip/tripRepository';

// 초대 링크로 여행방 열기. ?v=<version>이 현재 버전과 같으면 204 (폴링)
export const GET = route<{ tripId: string }>(async (req, { tripId }) => {
  const v = new URL(req.url).searchParams.get('v');
  const trip = await loadTrip(tripId, v == null ? null : Number(v));
  return trip && { trip };
});

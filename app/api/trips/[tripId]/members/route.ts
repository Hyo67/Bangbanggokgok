import { readBody, route } from '@/backend/common/route';
import { joinTrip } from '@/backend/trip/memberService';

// Trip.addMember — 새 이름으로 여행방에 참여
export const POST = route<{ tripId: string }>(async (req, { tripId }) => joinTrip(tripId, await readBody(req)));

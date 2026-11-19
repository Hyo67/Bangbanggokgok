import { readBody, route } from '@/backend/common/route';
import { createTrip } from '@/backend/trip/tripService';

// Trip.createTrip — 여행방 만들기 (FR-1.1, FR-3.1)
export const POST = route(async (req) => createTrip(await readBody(req)), { status: 201 });

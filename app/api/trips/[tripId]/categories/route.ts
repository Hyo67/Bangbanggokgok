import { readBody, route } from '@/backend/common/route';
import { createCategory } from '@/backend/trip/tripService';

// Trip.addCategory
export const POST = route<{ tripId: string }>(async (req, { tripId }) => createCategory(tripId, (await readBody(req)).name));

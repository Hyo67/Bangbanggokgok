import { readBody, route } from '@/backend/common/route';
import { leaveTrip, updateName } from '@/backend/trip/memberService';

type Params = { tripId: string; memberId: string };

// Member.updateName
export const PATCH = route<Params>(async (req, { tripId, memberId }) => updateName(tripId, memberId, await readBody(req)));
// Member.leaveTrip → Trip.removeMember
export const DELETE = route<Params>(async (_req, { tripId, memberId }) => leaveTrip(tripId, memberId));

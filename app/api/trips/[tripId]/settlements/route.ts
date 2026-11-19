import { readBody, route } from '@/backend/common/route';
import { requestSettlement } from '@/backend/settlement/settlementService';

// Settlement.requestSettlement
export const POST = route<{ tripId: string }>(async (req, { tripId }) => requestSettlement(tripId, await readBody(req)));

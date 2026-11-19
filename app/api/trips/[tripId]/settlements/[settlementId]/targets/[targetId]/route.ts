import { readBody, route } from '@/backend/common/route';
import { updateTargetStatus } from '@/backend/settlement/settlementService';

type Params = { tripId: string; settlementId: string; targetId: string };

// SettlementTarget.updateStatus — { status: 'COMPLETED' | 'PENDING' }
export const PATCH = route<Params>(async (req, { tripId, settlementId, targetId }) =>
  updateTargetStatus(tripId, settlementId, targetId, await readBody(req)),
);

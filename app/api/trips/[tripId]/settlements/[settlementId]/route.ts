import { route } from '@/backend/common/route';
import { cancelSettlement } from '@/backend/settlement/settlementService';

// Settlement.cancelSettlement — 요청은 지우지 않고 CANCELLED로 남긴다.
export const DELETE = route<{ tripId: string; settlementId: string }>(async (_req, { tripId, settlementId }) =>
  cancelSettlement(tripId, settlementId),
);

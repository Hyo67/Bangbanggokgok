import { route } from '@/backend/common/route';
import { refetchTripRate } from '@/backend/currency/exchangeRateService';

// 생성 때 실패한 고정 환율 조회 재시도 (FR-3.2)
export const POST = route<{ tripId: string }>(async (_req, { tripId }) => refetchTripRate(tripId));

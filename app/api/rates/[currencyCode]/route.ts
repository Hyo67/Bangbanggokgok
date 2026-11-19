import { route } from '@/backend/common/route';
import { fetchRateByCode } from '@/backend/currency/exchangeRateService';

// 실시간 환율 (네이버 기준, 1분 캐시). 여행방의 고정 환율과는 별개로 화면에 보여 주기만 한다.
export const GET = route<{ currencyCode: string }>(async (_req, { currencyCode }) => ({
  currency: await fetchRateByCode(currencyCode),
}));

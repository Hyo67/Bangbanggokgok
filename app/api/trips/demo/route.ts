import { route } from '@/backend/common/route';
import { createDemoTrip } from '@/backend/trip/tripService';

// 샘플 여행방 둘러보기
export const POST = route(() => createDemoTrip(), { status: 201 });

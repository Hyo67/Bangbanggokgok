import type { ReactNode } from 'react';
import { HttpError } from '@/backend/common/errors';
import { loadTrip } from '@/backend/trip/tripRepository';
import { Notice } from '@/frontend/common/Notice';
import { TripShell } from '@/frontend/trip/TripShell';

export const dynamic = 'force-dynamic';

// 초대 링크로 들어온 여행방. 서버에서 여행방을 읽어 첫 화면을 바로 그린다.
export default async function TripLayout({ params, children }: { params: Promise<{ tripId: string }>; children: ReactNode }) {
  const { tripId } = await params;
  try {
    const trip = await loadTrip(tripId);
    return <TripShell initialTrip={trip}>{children}</TripShell>;
  } catch (err) {
    if (err instanceof HttpError) return <Notice message={err.message} />;
    throw err;
  }
}

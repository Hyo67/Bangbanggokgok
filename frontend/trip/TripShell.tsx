'use client';

// 여행방 화면 틀. 지출 기록(첫 화면)과 서브 화면을 함께 두고,
// 좁은 화면에서는 하나만, 960px 이상에서는 둘을 나란히 보여 준다.

import { useSelectedLayoutSegment } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Trip } from '@/shared/domain';
import { SheetFrame, SheetProvider, useSheet } from '../common/overlay';
import { RecordView } from '../expense/RecordView';
import { consumeJustCreated } from '../user/userService';
import { NameGate } from '../user/NameGate';
import { TripInfoSheet } from './TripInfoSheet';
import { TripProvider, useTrip, type View } from './TripContext';

export function TripShell({ initialTrip, children }: { initialTrip: Trip; children: ReactNode }) {
  return (
    <TripProvider initialTrip={initialTrip}>
      <SheetProvider>
        <Shell>{children}</Shell>
      </SheetProvider>
    </TripProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { trip, me } = useTrip();
  const sheet = useSheet();
  const view = (useSelectedLayoutSegment() ?? 'record') as View;

  useEffect(() => {
    scrollTo(0, 0);
  }, [view]);

  // 방금 만든 여행방이면 공유 링크부터 안내한다.
  useEffect(() => {
    if (me && consumeJustCreated(trip.tripId)) sheet.open((close) => <TripInfoSheet close={close} created />);
  }, [me, trip.tripId, sheet]);

  return (
    <div className="shell" data-view={view}>
      <main className="pane pane-record">
        <RecordView />
      </main>
      {/* 기록 화면 경로에서는 넓은 화면용으로 지출 내역이 들어온다. */}
      <section className="pane pane-sub">{children}</section>
      {me === null && (
        <SheetFrame dismissible={false} onClose={() => {}}>
          <NameGate />
        </SheetFrame>
      )}
    </div>
  );
}

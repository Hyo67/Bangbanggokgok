'use client';

// 여행방 화면 틀. 메인 화면(기록 + 지출 내역)은 늘 붙여 두고 정산 화면으로 갈 때만 숨긴다.

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
  const { trip, me, selection } = useTrip();
  const sheet = useSheet();
  const view = (useSelectedLayoutSegment() ?? 'record') as View;
  const picking = selection !== null;

  // 화면을 바꾸면 맨 위로. 정산 화면에서 내역을 고르러 왔다면 지출 내역으로 바로 내려간다.
  useEffect(() => {
    if (view === 'record' && picking) document.getElementById('history')?.scrollIntoView();
    else scrollTo(0, 0);
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
      <section className="pane pane-sub">{children}</section>
      {me === null && (
        <SheetFrame dismissible={false} onClose={() => {}}>
          <NameGate />
        </SheetFrame>
      )}
    </div>
  );
}

'use client';

// 서브 화면(정산 요청) 헤더 — 메인 화면으로 돌아가는 버튼과 제목

import Link from 'next/link';
import { Icon } from '../common/Icon';
import { useTrip } from './TripContext';

export function SubHeader({ title }: { title: string }) {
  const { trip, path } = useTrip();
  return (
    <header className="rec-head">
      <div className="top-bar">
        <Link className="round" href={path()} aria-label="지출 기록으로 돌아가기">
          <Icon name="back" size={20} />
        </Link>
      </div>
      <h1 className="trip-title">{title}</h1>
      <p className="trip-dates">{trip.title}</p>
    </header>
  );
}

'use client';

// 서브 화면(정산 요청) 헤더 — 메인 화면으로 돌아가는 버튼과 제목

import Link from 'next/link';
import { Icon } from '../common/Icon';
import { useTrip } from './TripContext';

export function SubHeader({ title }: { title: string }) {
  const { trip, path } = useTrip();
  return (
    <header className="sub-head">
      <Link className="round" href={path()} aria-label="지출 기록으로 돌아가기">
        <Icon name="back" />
      </Link>
      <h1>
        <small>{trip.title}</small>
        {title}
      </h1>
    </header>
  );
}

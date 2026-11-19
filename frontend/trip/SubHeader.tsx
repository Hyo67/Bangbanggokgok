'use client';

// 서브 화면(지출 내역·정산) 공통 헤더

import Link from 'next/link';
import { Icon, type IconName } from '../common/Icon';
import { useTrip } from './TripContext';

const TABS = [
  { view: 'list', title: '지출 내역', icon: 'list' },
  { view: 'settle', title: '정산 요청', icon: 'receipt' },
] as const satisfies { view: string; title: string; icon: IconName }[];

export function SubHeader({ active }: { active: (typeof TABS)[number]['view'] }) {
  const { trip, path } = useTrip();
  return (
    <header className="sub-head">
      <Link className="round back" href={path()} aria-label="지출 기록으로 돌아가기">
        <Icon name="back" />
      </Link>
      <h1>
        <small>{trip.title}</small>
        {TABS.find((t) => t.view === active)!.title}
      </h1>
      <nav>
        {TABS.map((t) => (
          <Link key={t.view} className={`round ${active === t.view ? 'on' : ''}`} href={path(t.view)} aria-label={t.title} title={t.title}>
            <Icon name={t.icon} />
          </Link>
        ))}
      </nav>
    </header>
  );
}

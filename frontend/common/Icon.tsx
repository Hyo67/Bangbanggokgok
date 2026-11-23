// 선 아이콘 모음과 마스코트 까치

import { defaultTypeOf, type DefaultCategoryType, type TripCategory } from '@/shared/domain';

const PATHS = {
  food: <path d="M7 3v18M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17 21v-8c-2 0-3-1.2-3-3.5C14 6 15.2 3.8 17 3z" />,
  transport: (
    <>
      <rect x="5" y="3.5" width="14" height="13.5" rx="3" />
      <path d="M5 11h14M8 17v2.5M16 17v2.5" />
      <path d="M8.5 14h.01M15.5 14h.01" strokeWidth="2.6" />
    </>
  ),
  accommodation: (
    <>
      <path d="M3 6v13M3 16h18v3M21 16v-3a3 3 0 0 0-3-3h-7v6" />
      <circle cx="7" cy="11.5" r="1.8" />
    </>
  ),
  shopping: (
    <>
      <path d="M5.5 8h13l1 12.5h-15z" />
      <path d="M9 8V7a3 3 0 0 1 6 0v1" />
    </>
  ),
  etc: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeWidth="3" />,
  pencil: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  note: (
    <>
      <path d="M6.5 3.5h8L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5z" />
      <path d="M9 12h6M9 16h4" />
    </>
  ),
  list: (
    <>
      <path d="M9 7h10M9 12h10M9 17h10" />
      <path d="M5 7h.01M5 12h.01M5 17h.01" strokeWidth="2.6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" />
      <circle cx="12" cy="10.5" r="2.3" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z" />
      <path d="M9.5 8.5h5M9.5 12.5h5" />
    </>
  ),
  trash: <path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.5-5.8" />
      <path d="M20 4v5h-5" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  down: <path d="M6 9l6 6 6-6" />,
  up: <path d="M6 15l6-6 6 6" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  tag: (
    <>
      <path d="M3.5 12.2V4.8a1.3 1.3 0 0 1 1.3-1.3h7.4l8.3 8.3a1.3 1.3 0 0 1 0 1.8l-7.4 7.4a1.3 1.3 0 0 1-1.8 0z" />
      <path d="M8 8h.01" strokeWidth="2.6" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="ic"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// 마스코트 까치 (public/bird.svg)
export const Bird = () => <img className="bird" src="/bird.svg" alt="" />;

const DEFAULT_ICONS: Record<DefaultCategoryType, IconName> = {
  FOOD: 'food',
  TRANSPORT: 'transport',
  ACCOMMODATION: 'accommodation',
  SHOPPING: 'shopping',
  ETC: 'etc',
};

// 카테고리 아이콘. 사용자가 만든 카테고리는 태그 아이콘을 쓴다.
export function categoryLook(c: TripCategory | undefined): { icon: IconName } {
  const type = c && defaultTypeOf(c);
  return { icon: type ? DEFAULT_ICONS[type] : 'tag' };
}

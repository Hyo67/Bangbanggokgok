// 프런트엔드와 백엔드가 함께 쓰는 도메인 모델 (클래스 다이어그램 기준)

/* ---------- Currency ---------- */

export interface Currency {
  currencyCode: string;
  nationName: string;
  currencyRate: number | null; // 원화 / 현지 통화 1단위
}

// 네이버 환율 검색으로 조회할 수 있는 통화만 선택지로 둔다.
export const CURRENCIES: (Omit<Currency, 'currencyRate'> & { symbol: string })[] = [
  { currencyCode: 'THB', nationName: '태국', symbol: '฿' },
  { currencyCode: 'JPY', nationName: '일본', symbol: '¥' },
  { currencyCode: 'USD', nationName: '미국', symbol: '$' },
  { currencyCode: 'EUR', nationName: '유럽(유로존)', symbol: '€' },
  { currencyCode: 'CNY', nationName: '중국', symbol: '¥' },
  { currencyCode: 'HKD', nationName: '홍콩', symbol: 'HK$' },
  { currencyCode: 'SGD', nationName: '싱가포르', symbol: 'S$' },
  { currencyCode: 'MYR', nationName: '말레이시아', symbol: 'RM' },
  { currencyCode: 'IDR', nationName: '인도네시아', symbol: 'Rp' },
  { currencyCode: 'AUD', nationName: '호주', symbol: 'A$' },
  { currencyCode: 'GBP', nationName: '영국', symbol: '£' },
  { currencyCode: 'CAD', nationName: '캐나다', symbol: 'C$' },
  { currencyCode: 'NZD', nationName: '뉴질랜드', symbol: 'NZ$' },
  { currencyCode: 'CHF', nationName: '스위스', symbol: 'Fr' },
  { currencyCode: 'AED', nationName: '아랍에미리트', symbol: 'Dh' },
];

export const currencyOf = (currencyCode: string) => CURRENCIES.find((c) => c.currencyCode === currencyCode)!;

/* ---------- Member ---------- */

export interface Member {
  memberId: string;
  tripId: string;
  name: string;
}

/* ---------- TripCategory ---------- */

export const DEFAULT_CATEGORY_TYPES = ['FOOD', 'TRANSPORT', 'ACCOMMODATION', 'SHOPPING', 'ETC'] as const;
export type DefaultCategoryType = (typeof DEFAULT_CATEGORY_TYPES)[number];

// 여행방을 만들 때 기본 카테고리 5개를 이 이름으로 만든다.
export const DEFAULT_CATEGORY_NAMES: Record<DefaultCategoryType, string> = {
  FOOD: '식비',
  TRANSPORT: '교통',
  ACCOMMODATION: '숙박',
  SHOPPING: '쇼핑',
  ETC: '기타',
};

export interface TripCategory {
  categoryId: string;
  tripId: string;
  name: string;
  sortOrder: number;
  isDefault: boolean;
}

// 기본 카테고리는 이름을 바꾸거나 지울 수 없으므로 이름으로 종류를 알 수 있다.
export const defaultTypeOf = (c: Pick<TripCategory, 'name' | 'isDefault'>): DefaultCategoryType | null =>
  c.isDefault ? (DEFAULT_CATEGORY_TYPES.find((t) => DEFAULT_CATEGORY_NAMES[t] === c.name) ?? null) : null;

/* ---------- Expense ---------- */

export interface Expense {
  expenseId: string;
  tripId: string;
  memberId: string; // 지출한 사람
  categoryId: string;
  caption: string;
  amount: number;
  currency: string; // 여행지 통화 또는 KRW
  date: string; // YYYY-MM-DD
  memo: string;
  createdAt: string;
  isSettled: boolean; // 진행 중이거나 끝난 정산 요청에 포함됐는지
}

// 고정 환율로 원화 환산. 환율이 아직 저장되지 않았으면 null.
export const convertToKRW = (trip: Pick<Trip, 'fixedExchangeRate'>, e: Pick<Expense, 'amount' | 'currency'>): number | null =>
  e.currency === 'KRW' ? Math.round(e.amount) : trip.fixedExchangeRate == null ? null : Math.round(e.amount * trip.fixedExchangeRate);

/* ---------- Settlement ---------- */

export const SETTLEMENT_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

// 정산 요청 시점에 복사해 둔 선택 지출. 원본이 바뀌어도 그대로 남는다 (FR-5.6).
export interface SelectedExpense {
  expenseId: string;
  caption: string;
  amount: number;
  currency: string;
  date: string;
  krw: number;
}

export interface SettlementTarget {
  targetId: string;
  settlementId: string;
  memberId: string;
  amount: number;
  status: SettlementStatus;
}

export interface Settlement {
  settlementId: string;
  tripId: string;
  requesterId: string; // 돈을 받을 멤버
  selectedExpenses: SelectedExpense[];
  totalAmount: number;
  status: SettlementStatus;
  createdAt: string;
  targets: SettlementTarget[];
}

export const calculateTotal = (expenses: Pick<SelectedExpense, 'krw'>[]) => expenses.reduce((sum, e) => sum + e.krw, 0);

// 총액을 1원 단위까지 맞춰 균등 분할한다. 나머지는 앞사람부터 1원씩 더한다.
export function splitAmount(total: number, memberIds: string[]): { memberId: string; amount: number }[] {
  const base = Math.floor(total / memberIds.length);
  const rest = total - base * memberIds.length;
  return memberIds.map((memberId, i) => ({ memberId, amount: base + (i < rest ? 1 : 0) }));
}

/* ---------- Trip ---------- */

export interface Trip {
  tripId: string; // 추측할 수 없는 32자 랜덤 값. 초대 링크에 그대로 들어간다.
  title: string;
  inviteLink: string;
  currencyCode: string;
  fixedExchangeRate: number | null;
  rateDate: string | null; // 환율을 고정한 날 (한국 시각)
  rateSample: boolean; // 샘플 여행방의 임의 환율
  totalExpense: number | null; // 원화 환산 총지출. 환율이 없어 환산할 수 없는 지출이 있으면 null
  startDate: string;
  endDate: string;
  createdAt: string;
  version: number; // 다른 멤버의 변경을 알아채기 위한 버전
  members: Member[];
  categories: TripCategory[]; // sortOrder 순
  expenses: Expense[]; // 저장된 순서 그대로
  settlements: Settlement[]; // 최신순
}

// NFR-3: 24바이트 랜덤 값을 base64url로 바꾼 32자
export const TRIP_ID_RE = /^[A-Za-z0-9_-]{32}$/;

export const generateInviteLink = (tripId: string) => `/t/${tripId}`;

'use client';

// 지출 기록 화면과 수정 시트가 함께 쓰는 입력 필드

import type { ChangeEvent, ReactNode } from 'react';
import type { Expense, Trip, TripCategory } from '@/shared/domain';
import { categoryLook, Icon } from '../common/Icon';
import { parseAmount, rateText, won } from '../common/format';
import { useSheet } from '../common/overlay';
import { CategorySheet } from '../trip/CategorySheet';
import { useTrip } from '../trip/TripContext';

// 금액은 입력 중인 문자열 그대로 둔다. 숫자 변환은 제출할 때 한다.
export interface ExpenseDraft {
  caption: string;
  amount: string;
  currency: string;
  categoryId: string | null; // null이면 맨 앞 카테고리
  date: string;
  memberId: string; // 지출한 사람
  memo: string;
}

export const draftOf = (e: Expense): ExpenseDraft => ({ ...e, amount: String(e.amount) });

// FR-2.3: 이 여행방에서 많이 쓴 카테고리를 앞쪽에 둔다. 횟수가 같으면 카테고리 순서(sortOrder)를 따른다.
export function sortedCategories(trip: Trip): TripCategory[] {
  const used = new Map<string, number>();
  for (const e of trip.expenses) used.set(e.categoryId, (used.get(e.categoryId) ?? 0) + 1);
  return [...trip.categories].sort((a, b) => (used.get(b.categoryId) ?? 0) - (used.get(a.categoryId) ?? 0) || a.sortOrder - b.sortOrder);
}

type Validated =
  | { value: Omit<ExpenseDraft, 'amount' | 'categoryId'> & { amount: number; categoryId: string } }
  | { error: string; focus: string };

// 제출 가능한 값이면 서버로 보낼 객체를, 아니면 안내 문구와 포커스할 필드를 돌려준다.
export function validateDraft(trip: Trip, v: ExpenseDraft): Validated {
  const amount = parseAmount(v.amount);
  if (!v.caption.trim()) return { error: '어디에 썼는지 적어 주세요.', focus: 'caption' };
  if (!(amount > 0)) return { error: '금액을 숫자로 입력해 주세요.', focus: 'amount' };
  if (!v.date) return { error: '날짜를 선택해 주세요.', focus: 'date' };
  return { value: { ...v, amount, categoryId: v.categoryId ?? sortedCategories(trip)[0].categoryId } };
}

// 현지 통화 금액 아래에 고정 환율 기준 원화 환산을 바로 보여 준다.
function Hint({ trip, draft }: { trip: Trip; draft: ExpenseDraft }) {
  const amount = parseAmount(draft.amount);
  let body: ReactNode;
  if (draft.currency === 'KRW') body = '원화로 결제한 금액은 그대로 기록돼요.';
  else if (trip.fixedExchangeRate == null) body = '고정 환율이 아직 없어 원화 환산은 나중에 표시돼요.';
  else if (amount > 0)
    body = (
      <>
        <b>≈ {won(amount * trip.fixedExchangeRate)}</b> · {rateText(trip)} 고정
      </>
    );
  else body = `${rateText(trip)} · 여행방 고정 환율`;
  return <p className="hint">{body}</p>;
}

export function ExpenseFields({ draft, onChange }: { draft: ExpenseDraft; onChange(next: ExpenseDraft): void }) {
  const { trip, me } = useTrip();
  const sheet = useSheet();
  const cats = sortedCategories(trip);
  // 고른 카테고리가 지워졌으면 맨 앞 카테고리로 보인다.
  const categoryId = cats.some((c) => c.categoryId === draft.categoryId) ? draft.categoryId : cats[0].categoryId;
  const set = (key: keyof ExpenseDraft) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...draft, [key]: e.target.value });

  return (
    <>
      <label className="field">
        <span className="field-ic">
          <Icon name="pencil" />
        </span>
        <input name="caption" placeholder="어디에 썼나요?" maxLength={40} autoComplete="off" value={draft.caption} onChange={set('caption')} />
      </label>
      <div className="field-row">
        <label className="field field-cur">
          <select name="currency" aria-label="통화" value={draft.currency} onChange={set('currency')}>
            {[trip.currencyCode, 'KRW'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Icon name="down" size={18} />
        </label>
        <label className="field field-grow">
          <input name="amount" inputMode="decimal" placeholder="금액 입력" autoComplete="off" value={draft.amount} onChange={set('amount')} />
        </label>
      </div>
      <Hint trip={trip} draft={draft} />
      <div className="cats" role="radiogroup" aria-label="카테고리">
        {cats.map((c) => {
          const look = categoryLook(c);
          return (
            <label key={c.categoryId} className={`cat tone-${look.tone}`}>
              <input type="radio" name="categoryId" value={c.categoryId} checked={c.categoryId === categoryId} onChange={set('categoryId')} />
              <span className="cat-ic">
                <Icon name={look.icon} size={24} />
              </span>
              <span className="cat-label">{c.name}</span>
            </label>
          );
        })}
        <button type="button" className="cat cat-add" onClick={() => sheet.open((close) => <CategorySheet close={close} />)}>
          <span className="cat-ic">
            <Icon name="plus" size={24} />
          </span>
          <span className="cat-label">편집</span>
        </button>
      </div>
      <label className="field">
        <span className="field-ic">
          <Icon name="calendar" />
        </span>
        <input type="date" name="date" aria-label="날짜" value={draft.date} onChange={set('date')} required />
      </label>
      <label className="field">
        <span className="field-ic">
          <Icon name="user" />
        </span>
        <span className="field-label">지출한 사람</span>
        <select name="memberId" className="select-end" value={draft.memberId} onChange={set('memberId')}>
          {trip.members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.name}
              {m.memberId === me ? ' (나)' : ''}
            </option>
          ))}
        </select>
        <Icon name="down" size={18} />
      </label>
      <label className="field">
        <span className="field-ic">
          <Icon name="note" />
        </span>
        <input name="memo" placeholder="메모 (선택사항)" maxLength={200} autoComplete="off" value={draft.memo} onChange={set('memo')} />
      </label>
    </>
  );
}

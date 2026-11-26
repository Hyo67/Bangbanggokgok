'use client';

// 지출 기록 화면과 수정 시트가 함께 쓰는 입력 필드

import { useState, type ChangeEvent, type ReactNode } from 'react';
import type { Currency, Expense, Trip, TripCategory } from '@/shared/domain';
import { api, errorText } from '../common/api';
import { Icon } from '../common/Icon';
import { fmtDate, parseAmount, rateLabel, won } from '../common/format';
import { useSheet, useToast } from '../common/overlay';
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
  // fixed: 여행방 고정 환율, live: 방금 조회한 실시간 환율(liveRate), keep: 수정할 때 저장된 환율을 그대로 둠
  rateMode: 'fixed' | 'live' | 'keep';
  liveRate: number | null;
}

export const draftOf = (e: Expense): ExpenseDraft => ({
  caption: e.caption,
  amount: String(e.amount),
  currency: e.currency,
  categoryId: e.categoryId,
  date: e.date,
  memberId: e.memberId,
  memo: e.memo,
  rateMode: 'keep',
  liveRate: e.exchangeRate,
});

// 입력 중인 지출에 적용될 환율. 실시간 환율을 쓰는 중이 아니면 여행방 고정 환율.
const usesLive = (d: ExpenseDraft) => d.rateMode !== 'fixed' && d.liveRate != null;
const draftRate = (trip: Trip, d: ExpenseDraft) => (usesLive(d) ? d.liveRate : trip.fixedExchangeRate);

// FR-2.3: 이 여행방에서 많이 쓴 카테고리를 앞쪽에 둔다. 횟수가 같으면 카테고리 순서(sortOrder)를 따른다.
export function sortedCategories(trip: Trip): TripCategory[] {
  const used = new Map<string, number>();
  for (const e of trip.expenses) used.set(e.categoryId, (used.get(e.categoryId) ?? 0) + 1);
  return [...trip.categories].sort((a, b) => (used.get(b.categoryId) ?? 0) - (used.get(a.categoryId) ?? 0) || a.sortOrder - b.sortOrder);
}

interface ExpenseBody {
  caption: string;
  amount: number;
  currency: string;
  categoryId: string;
  date: string;
  memberId: string;
  memo: string;
  exchangeRate?: number | null; // 빠지면 서버가 저장된 환율을 그대로 둔다(수정할 때)
}

type Validated = { value: ExpenseBody } | { error: string; focus: string };

// 제출 가능한 값이면 서버로 보낼 객체를, 아니면 안내 문구와 포커스할 필드를 돌려준다.
export function validateDraft(trip: Trip, v: ExpenseDraft): Validated {
  const amount = parseAmount(v.amount);
  if (!v.caption.trim()) return { error: '어디에 썼는지 적어 주세요.', focus: 'caption' };
  if (!(amount > 0)) return { error: '금액을 숫자로 입력해 주세요.', focus: 'amount' };
  if (!v.date) return { error: '날짜를 선택해 주세요.', focus: 'date' };
  const { rateMode, liveRate, ...rest } = v;
  const value: ExpenseBody = { ...rest, amount, categoryId: v.categoryId ?? sortedCategories(trip)[0].categoryId };
  if (v.currency === 'KRW' || rateMode === 'fixed') value.exchangeRate = null;
  else if (rateMode === 'live') value.exchangeRate = liveRate;
  return { value };
}

// 금액 아래에 적용 환율과 원화 환산을 보여 준다. 기본은 고정 환율이고, 버튼으로 실시간 환율을 조회해 쓸 수 있다.
function Hint({ trip, draft, onChange }: { trip: Trip; draft: ExpenseDraft; onChange(next: ExpenseDraft): void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  if (draft.currency === 'KRW') return <p className="hint">원화로 결제한 금액은 그대로 기록돼요.</p>;

  const amount = parseAmount(draft.amount);
  const live = usesLive(draft);
  const rate = draftRate(trip, draft);

  async function useLiveRate() {
    setLoading(true);
    try {
      const data = await api<{ currency: Currency & { currencyRate: number } }>('GET', `/api/rates/${trip.currencyCode}`);
      onChange({ ...draft, rateMode: 'live', liveRate: data!.currency.currencyRate });
    } catch (err) {
      toast(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  let body: ReactNode;
  if (rate == null) body = '고정 환율이 아직 없어 원화 환산은 나중에 표시돼요.';
  else
    body = (
      <>
        {amount > 0 && <b>≈ {won(amount * rate)} · </b>}
        {rateLabel(trip.currencyCode, rate)} · {live ? '실시간 환율' : '고정 환율'}
      </>
    );
  return (
    <div className="hint rate-hint">
      <p>{body}</p>
      {live ? (
        <button type="button" className="rate-btn" onClick={() => onChange({ ...draft, rateMode: 'fixed' })}>
          고정 환율로
        </button>
      ) : (
        <button type="button" className="rate-btn" disabled={loading} onClick={useLiveRate}>
          <Icon name="refresh" size={12} />
          {loading ? '조회 중' : '실시간 환율로'}
        </button>
      )}
    </div>
  );
}

// 회색 카드 하나에 입력을 모은다: 위쪽 카테고리 칩, 가운데 큰 항목·금액, 아래쪽 작은 날짜·지출자·메모
export function ExpenseFields({ draft, onChange }: { draft: ExpenseDraft; onChange(next: ExpenseDraft): void }) {
  const { trip, me } = useTrip();
  const sheet = useSheet();
  const cats = sortedCategories(trip);
  // 고른 카테고리가 지워졌으면 맨 앞 카테고리로 보인다.
  const categoryId = cats.some((c) => c.categoryId === draft.categoryId) ? draft.categoryId : cats[0].categoryId;
  const set = (key: keyof ExpenseDraft) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...draft, [key]: e.target.value });

  return (
    <div className="composer">
      <div className="cats" role="radiogroup" aria-label="카테고리">
        {cats.map((c) => (
          <label key={c.categoryId} className="cat">
            <input type="radio" name="categoryId" value={c.categoryId} checked={c.categoryId === categoryId} onChange={set('categoryId')} />
            {c.name}
          </label>
        ))}
        <button
          type="button"
          className="cat cat-add"
          aria-label="카테고리 편집"
          title="카테고리 편집"
          onClick={() => sheet.open((close) => <CategorySheet close={close} />)}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <input
        name="caption"
        className="big-input"
        placeholder="어디에 썼나요?"
        aria-label="항목"
        maxLength={40}
        autoComplete="off"
        value={draft.caption}
        onChange={set('caption')}
      />
      <div className="amount-row">
        <label className="cur">
          <select name="currency" aria-label="통화" value={draft.currency} onChange={set('currency')}>
            {[trip.currencyCode, 'KRW'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Icon name="down" size={14} />
        </label>
        <input
          name="amount"
          className="big-input amount"
          inputMode="decimal"
          placeholder="0"
          aria-label="금액"
          autoComplete="off"
          value={draft.amount}
          onChange={set('amount')}
        />
      </div>
      <Hint trip={trip} draft={draft} onChange={onChange} />
      <div className="meta">
        <label className="mini">
          <Icon name="calendar" size={15} />
          {draft.date ? fmtDate(draft.date) : '날짜'}
          {/* 보이는 글자는 짧게 두고, 투명한 날짜 입력을 위에 덮어 누르면 달력이 열리게 한다. */}
          <input
            type="date"
            name="date"
            aria-label="날짜"
            value={draft.date}
            onChange={set('date')}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {}
            }}
            required
          />
        </label>
        <label className="mini">
          <Icon name="user" size={15} />
          <select name="memberId" aria-label="지출한 사람" value={draft.memberId} onChange={set('memberId')}>
            {trip.members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.name}
                {m.memberId === me ? ' (나)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="mini mini-grow">
          <Icon name="note" size={15} />
          <input name="memo" placeholder="메모" aria-label="메모" maxLength={200} autoComplete="off" value={draft.memo} onChange={set('memo')} />
        </label>
      </div>
    </div>
  );
}

'use client';

// 지출 기록 화면 — 공유 링크로 들어오면 가장 먼저 보이는 화면.
// 넓은 화면에서는 서브 화면 옆에 계속 떠 있으므로 입력 중인 값이 화면 이동에도 유지된다.

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { currencyOf } from '@/shared/domain';
import { errorText } from '../common/api';
import { fmtDate, today } from '../common/format';
import { Bird, Icon } from '../common/Icon';
import { useSheet, useToast } from '../common/overlay';
import { copyShareLink } from '../trip/share';
import { useTrip } from '../trip/TripContext';
import { TripInfoSheet } from '../trip/TripInfoSheet';
import { ExpenseFields, validateDraft, type ExpenseDraft } from './ExpenseFields';

export function RecordView() {
  const { trip, me, mutate, path } = useTrip();
  const toast = useToast();
  const sheet = useSheet();
  const form = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<ExpenseDraft>(() => ({
    caption: '',
    amount: '',
    currency: trip.currencyCode,
    categoryId: null,
    date: today(),
    memberId: '',
    memo: '',
  }));

  // 지출한 사람의 기본값은 나. 고른 멤버가 없어지면 다시 나로 돌린다.
  useEffect(() => {
    if (!trip.members.some((m) => m.memberId === draft.memberId)) {
      setDraft((d) => ({ ...d, memberId: me ?? trip.members[0]?.memberId ?? '' }));
    }
  }, [trip.members, me, draft.memberId]);

  async function retryRate() {
    try {
      await mutate('POST', '/rate');
      toast('환율을 저장했어요');
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = validateDraft(trip, draft);
    if ('error' in checked) {
      toast(checked.error);
      (form.current?.elements.namedItem(checked.focus) as HTMLElement | null)?.focus();
      return;
    }
    setBusy(true);
    try {
      await mutate('POST', '/expenses', checked.value);
      // 연달아 입력하기 쉽도록 통화·날짜·지출한 사람은 남겨 둔다.
      setDraft((d) => ({ ...d, caption: '', amount: '', categoryId: null, memo: '' }));
      (form.current?.elements.namedItem('caption') as HTMLElement | null)?.focus();
      toast('지출을 추가했어요');
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="hero">
        <Bird />
        <header className="rec-head">
          <div>
            <button type="button" className="trip-title" onClick={() => sheet.open((close) => <TripInfoSheet close={close} />)}>
              {trip.title} <Icon name="down" size={20} />
            </button>
            <p className="trip-dates">
              {fmtDate(trip.startDate)} - {fmtDate(trip.endDate)} · {currencyOf(trip.currencyCode).nationName}
            </p>
          </div>
          <div className="head-actions">
            <button type="button" className="round" onClick={() => copyShareLink(trip, toast)} aria-label="초대 링크 복사" title="초대 링크 복사">
              <Icon name="link" />
            </button>
          </div>
        </header>
      </div>
      {trip.fixedExchangeRate == null && (
        <div className="banner">
          <p>
            <b>고정 환율이 아직 저장되지 않았어요.</b>
            <br />
            기록은 할 수 있지만 원화 환산은 환율을 저장한 뒤에 표시돼요.
          </p>
          <button type="button" className="btn primary sm" onClick={retryRate}>
            <Icon name="refresh" size={18} /> 다시 시도
          </button>
        </div>
      )}
      <form ref={form} className="card rec-form" noValidate onSubmit={submit}>
        <ExpenseFields draft={draft} onChange={setDraft} />
        <div className="rec-bottom">
          <Link className="fab fab-list" href={path('list')} aria-label="지출 내역 보기" title="지출 내역 보기">
            <Icon name="list" size={26} />
          </Link>
          <button className="btn primary block" disabled={busy}>
            추가하기
          </button>
        </div>
      </form>
    </>
  );
}

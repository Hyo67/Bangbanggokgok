'use client';

// 여행방 메인 화면 — 위에서 새 지출을 기록하고, 아래로 스크롤하면 요약과 지난 내역이 이어진다.
// 정산 화면으로 갔다 와도 입력 중인 값이 남도록 레이아웃에 계속 붙어 있다.

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { currencyOf } from '@/shared/domain';
import { errorText } from '../common/api';
import { fmtDate, today } from '../common/format';
import { Icon } from '../common/Icon';
import { useSheet, useToast } from '../common/overlay';
import { copyShareLink } from '../trip/share';
import { useTrip } from '../trip/TripContext';
import { TripInfoSheet } from '../trip/TripInfoSheet';
import { ExpenseFields, validateDraft, type ExpenseDraft } from './ExpenseFields';
import { ExpenseHistory } from './ExpenseHistory';

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
    rateMode: 'fixed',
    liveRate: null,
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
      // 연달아 입력하기 쉽도록 통화·날짜·지출한 사람은 남겨 두고, 환율은 다시 고정 환율로 돌린다.
      setDraft((d) => ({ ...d, caption: '', amount: '', categoryId: null, memo: '', rateMode: 'fixed', liveRate: null }));
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
      <header className="rec-head">
        <div className="top-bar">
          <Link className="round" href="/" aria-label="여행방 만들기로 돌아가기" title="여행방 만들기">
            <Icon name="back" size={20} />
          </Link>
          <Link className="round" href={path('settle')} aria-label="정산 요청 보기" title="정산 요청">
            <Icon name="receipt" size={20} />
          </Link>
          <button type="button" className="round" onClick={() => copyShareLink(trip, toast)} aria-label="초대 링크 복사" title="초대 링크 복사">
            <Icon name="link" size={20} />
          </button>
        </div>
        <button type="button" className="trip-title" onClick={() => sheet.open((close) => <TripInfoSheet close={close} />)}>
          {trip.title} <Icon name="down" size={18} />
        </button>
        <p className="trip-dates">
          {fmtDate(trip.startDate)} - {fmtDate(trip.endDate)} · {currencyOf(trip.currencyCode).nationName}
        </p>
      </header>
      {trip.fixedExchangeRate == null && (
        <div className="banner">
          <p>
            <b>고정 환율이 아직 저장되지 않았어요.</b>
            <br />
            원화 환산은 환율을 저장한 뒤에 표시돼요.
          </p>
          <button type="button" className="btn primary sm" onClick={retryRate}>
            <Icon name="refresh" size={16} /> 다시 시도
          </button>
        </div>
      )}
      <form ref={form} className="rec-form" noValidate onSubmit={submit}>
        <ExpenseFields draft={draft} onChange={setDraft} />
        <button className="btn primary block" disabled={busy}>
          추가하기
        </button>
      </form>
      <ExpenseHistory />
    </>
  );
}

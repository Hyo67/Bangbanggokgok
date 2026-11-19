'use client';

// 지출 수정 시트

import { useRef, useState, type FormEvent } from 'react';
import { errorText } from '../common/api';
import { SheetHead, useToast } from '../common/overlay';
import { useTrip } from '../trip/TripContext';
import { draftOf, ExpenseFields, validateDraft } from './ExpenseFields';

export function ExpenseEditSheet({ id, close }: { id: string; close(): void }) {
  const { trip, mutate } = useTrip();
  const toast = useToast();
  const form = useRef<HTMLFormElement>(null);
  const original = trip.expenses.find((x) => x.expenseId === id);
  const [draft, setDraft] = useState(() => (original ? draftOf(original) : null));
  if (!original || !draft) return <SheetHead title="이미 삭제된 내역이에요" onClose={close} />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const checked = validateDraft(trip, draft!);
    if ('error' in checked) {
      toast(checked.error);
      (form.current?.elements.namedItem(checked.focus) as HTMLElement | null)?.focus();
      return;
    }
    try {
      await mutate('PATCH', `/expenses/${id}`, checked.value);
      close();
      toast('수정했어요');
    } catch (err) {
      toast(errorText(err));
    }
  }

  return (
    <>
      <SheetHead title="지출 수정" onClose={close} />
      <form ref={form} className="rec-form" noValidate onSubmit={submit}>
        <ExpenseFields draft={draft} onChange={setDraft} />
        {original.isSettled && <p className="fine">정산 요청에 들어간 내역이에요. 고쳐도 이미 만든 요청 금액은 바뀌지 않아요.</p>}
        <button className="btn primary block">저장하기</button>
      </form>
    </>
  );
}

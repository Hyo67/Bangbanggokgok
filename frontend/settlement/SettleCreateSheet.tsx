'use client';

// 정산 요청 만들기 — 1단계: 받을 사람·나눌 멤버·분담 방식, 2단계: 확인 (FR-5.4)

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { calculateTotal, convertToKRW, splitAmount } from '@/shared/domain';
import { errorText } from '../common/api';
import { sum, won } from '../common/format';
import { Icon } from '../common/Icon';
import { SheetHead, useToast } from '../common/overlay';
import { useTrip } from '../trip/TripContext';

const digits = (str: string) => Number(String(str).replace(/\D/g, '')) || 0;

type SplitMode = 'equal' | 'custom';

export function SettleCreateSheet({ expenseIds, close }: { expenseIds: string[]; close(): void }) {
  const { trip, me, memberName, mutate, path, setSelection } = useTrip();
  const toast = useToast();
  const router = useRouter();

  // 시트를 여는 순간의 항목과 금액으로 계산한다.
  const [items] = useState(() =>
    expenseIds
      .map((id) => trip.expenses.find((e) => e.expenseId === id)!)
      .filter(Boolean)
      .map((e) => ({ ...e, krw: convertToKRW(trip, e) ?? 0 })),
  );
  const total = calculateTotal(items);

  const [step, setStep] = useState<1 | 2>(1);
  const [requesterId, setRequesterId] = useState(me ?? trip.members[0].memberId);
  const [picked, setPicked] = useState(() => new Set(trip.members.map((m) => m.memberId)));
  const [mode, setMode] = useState<SplitMode>('equal');
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const pickedIds = trip.members.filter((m) => picked.has(m.memberId)).map((m) => m.memberId);
  const shares = mode === 'equal' ? splitAmount(total, pickedIds) : pickedIds.map((id) => ({ memberId: id, amount: digits(custom[id] ?? '') }));
  const left = total - sum(shares.map((x) => x.amount));
  const problem = !shares.some((x) => x.memberId !== requesterId)
    ? '받을 사람 외에 나눌 멤버를 한 명 이상 골라 주세요.'
    : left > 0
      ? `${won(left)}이 남았어요.`
      : left < 0
        ? `${won(-left)}을 초과했어요.`
        : '';

  function togglePick(id: string) {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  }

  function changeMode(next: SplitMode) {
    // 직접 입력으로 바꿀 때는 균등 분할 금액에서 시작한다.
    if (next === 'custom' && mode === 'equal') setCustom(Object.fromEntries(shares.map((x) => [x.memberId, String(x.amount)])));
    setMode(next);
  }

  async function create() {
    setBusy(true);
    try {
      await mutate('POST', '/settlements', { expenseIds, requesterId, targets: shares });
      setSelection(null);
      close();
      router.push(path('settle'));
      toast('정산 요청을 만들었어요');
    } catch (err) {
      setBusy(false);
      toast(errorText(err));
    }
  }

  if (step === 2) {
    return (
      <>
        <SheetHead title="이대로 요청할까요?" onClose={close} />
        <h3>선택 항목</h3>
        <ul className="rows">
          {items.map((e) => (
            <li key={e.expenseId}>
              <span>{e.caption}</span>
              <b>{won(e.krw)}</b>
            </li>
          ))}
        </ul>
        <h3>정산 대상 · {mode === 'equal' ? '균등 분할' : '직접 입력'}</h3>
        <ul className="rows">
          {shares.map((x) => (
            <li key={x.memberId}>
              <span>
                {memberName(x.memberId)} {x.memberId === requesterId && <span className="badge">받는 사람</span>}
              </span>
              <b>{won(x.amount)}</b>
            </li>
          ))}
        </ul>
        <div className="sum-card">
          <span>총액</span>
          <strong>{won(total)}</strong>
        </div>
        <p className="fine">실제 송금은 이뤄지지 않아요. 요청 금액은 나중에 원본 내역이 바뀌어도 그대로 유지돼요.</p>
        <div className="btn-row">
          <button type="button" className="btn ghost" onClick={() => setStep(1)}>
            이전
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={create}>
            정산 요청 만들기
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHead title="정산 요청 만들기" onClose={close} />
      <div className="sum-card">
        <span>선택한 내역 {items.length}개</span>
        <strong>{won(total)}</strong>
      </div>
      <h3>받을 사람</h3>
      <label className="field">
        <span className="field-ic">
          <Icon name="user" />
        </span>
        <select name="requester" value={requesterId} onChange={(e) => setRequesterId(e.target.value)}>
          {trip.members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.name}
              {m.memberId === me ? ' (나)' : ''}
            </option>
          ))}
        </select>
        <Icon name="down" size={18} />
      </label>
      <h3>함께 나눌 멤버</h3>
      <div className="chips">
        {trip.members.map((m) => (
          <button
            key={m.memberId}
            type="button"
            className={`chip ${picked.has(m.memberId) ? 'on' : ''}`}
            aria-pressed={picked.has(m.memberId)}
            onClick={() => togglePick(m.memberId)}
          >
            {picked.has(m.memberId) && <Icon name="check" size={16} />}
            {m.name}
          </button>
        ))}
      </div>
      <h3>분담 방식</h3>
      <div className="seg">
        <button type="button" className={mode === 'equal' ? 'on' : ''} onClick={() => changeMode('equal')}>
          균등 분할
        </button>
        <button type="button" className={mode === 'custom' ? 'on' : ''} onClick={() => changeMode('custom')}>
          직접 입력
        </button>
      </div>
      <ul className="rows">
        {shares.map((x) => (
          <li key={x.memberId}>
            <span>{memberName(x.memberId)}</span>
            {mode === 'equal' ? (
              <b>{won(x.amount)}</b>
            ) : (
              <label className="amt">
                <input
                  inputMode="numeric"
                  value={custom[x.memberId] ?? ''}
                  placeholder="0"
                  aria-label={`${memberName(x.memberId)} 분담 금액`}
                  onChange={(e) => setCustom({ ...custom, [x.memberId]: e.target.value })}
                />
                <span>원</span>
              </label>
            )}
          </li>
        ))}
      </ul>
      <p className="remain">{problem}</p>
      <button type="button" className="btn primary block" disabled={Boolean(problem)} onClick={() => setStep(2)}>
        다음
      </button>
    </>
  );
}

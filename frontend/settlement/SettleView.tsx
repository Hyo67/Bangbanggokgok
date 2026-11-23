'use client';

// 정산 요청 목록 — 대상별 보냄 확인(SettlementTarget.updateStatus), 취소, 취소하고 다시 만들기

import { useRouter } from 'next/navigation';
import { convertToKRW, type Settlement, type SettlementStatus, type SettlementTarget } from '@/shared/domain';
import { errorText } from '../common/api';
import { fmtDate, won } from '../common/format';
import { Icon } from '../common/Icon';
import { useSheet, useToast } from '../common/overlay';
import { SubHeader } from '../trip/SubHeader';
import { useTrip } from '../trip/TripContext';

const STATUS_LABEL: Record<SettlementStatus, string> = { PENDING: '요청됨', COMPLETED: '정산 완료', CANCELLED: '취소됨' };

export function SettleView() {
  const { trip, memberName, mutate, path, setSelection } = useTrip();
  const sheet = useSheet();
  const toast = useToast();
  const router = useRouter();

  const pick = (ids: string[] = []) => {
    setSelection(new Set(ids));
    router.push(path());
  };

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      toast(errorText(err));
    }
  }

  const toggleTarget = (st: Settlement, t: SettlementTarget) =>
    run(() =>
      mutate('PATCH', `/settlements/${st.settlementId}/targets/${t.targetId}`, {
        status: t.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
      }),
    );

  const cancel = (st: Settlement, redo: boolean) =>
    run(async () => {
      const ok = await sheet.confirm({
        title: redo ? '취소하고 다시 만들까요?' : '정산 요청을 취소할까요?',
        body: redo ? '기존 요청은 취소되고, 같은 내역이 선택된 상태로 지출 내역으로 이동해요.' : '취소한 요청은 목록에 취소됨으로 남아요.',
        ok: redo ? '취소하고 다시 만들기' : '요청 취소',
        danger: !redo,
      });
      if (!ok) return;
      const { trip: next } = await mutate('DELETE', `/settlements/${st.settlementId}`);
      if (redo) pick(st.selectedExpenses.map((e) => e.expenseId).filter((id) => next.expenses.some((x) => x.expenseId === id)));
      else toast('정산 요청을 취소했어요');
    });

  const card = (st: Settlement) => {
    // FR-5.6: 요청 금액은 유지하되, 원본이 달라졌다는 사실은 알려 준다.
    const drifted = st.selectedExpenses.some((it) => {
      const now = trip.expenses.find((e) => e.expenseId === it.expenseId);
      return !now || convertToKRW(trip, now) !== it.krw;
    });
    const open = st.status !== 'CANCELLED';
    return (
      <article key={st.settlementId} className={`card st-card ${st.status.toLowerCase()}`}>
        <header>
          <span className={`badge ${st.status.toLowerCase()}`}>{STATUS_LABEL[st.status]}</span>
          <time>{fmtDate(st.createdAt.slice(0, 10))} 요청</time>
        </header>
        <p className="st-total">
          <strong>{won(st.totalAmount)}</strong>
          <span>{memberName(st.requesterId)} 님에게 보내기</span>
        </p>
        <p className="st-items">{st.selectedExpenses.map((it) => it.caption).join(' · ')}</p>
        <ul className="rows">
          {st.targets.map((t) => (
            <li key={t.targetId}>
              <span>{memberName(t.memberId)}</span>
              <b>{won(t.amount)}</b>
              {t.memberId === st.requesterId ? (
                <span className="badge">받는 사람</span>
              ) : (
                open && (
                  <button
                    type="button"
                    className={`pill ${t.status === 'COMPLETED' ? 'on' : ''}`}
                    aria-pressed={t.status === 'COMPLETED'}
                    onClick={() => toggleTarget(st, t)}
                  >
                    {t.status === 'COMPLETED' ? (
                      <>
                        <Icon name="check" size={14} /> 보냄
                      </>
                    ) : (
                      '보냄 확인'
                    )}
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
        {drifted && open && <p className="fine">요청 후 원본 내역이 수정·삭제됐어요. 요청 금액은 그대로 유지되니, 바꾸려면 취소하고 다시 만들어 주세요.</p>}
        {open && (
          <div className="btn-row">
            <button type="button" className="btn ghost sm" onClick={() => cancel(st, false)}>
              요청 취소
            </button>
            <button type="button" className="btn ghost sm" onClick={() => cancel(st, true)}>
              취소하고 다시 만들기
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <>
      <SubHeader title="정산 요청" />
      {trip.settlements.length ? (
        trip.settlements.map(card)
      ) : (
        <p className="empty">
          아직 정산 요청이 없어요.
          <br />
          지출 내역에서 정산할 항목을 골라 보세요.
        </p>
      )}
      <button type="button" className="btn primary block" onClick={() => pick()}>
        내역에서 골라 정산 요청하기
      </button>
      <p className="fine center">방방곡곡은 분담 금액 계산과 요청 관리까지만 도와드려요. 송금은 각자 편한 방법으로 해 주세요.</p>
    </>
  );
}

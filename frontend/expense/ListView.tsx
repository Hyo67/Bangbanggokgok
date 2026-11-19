'use client';

// 지출 내역 화면 — 조회, 수정·삭제·순서 변경, 정산할 항목 선택

import { convertToKRW, type Expense } from '@/shared/domain';
import type { KeyboardEvent } from 'react';
import { errorText } from '../common/api';
import { fmtDate, localMoney, sum, won } from '../common/format';
import { Bird, categoryLook, Icon } from '../common/Icon';
import { SheetHead, useSheet, useToast } from '../common/overlay';
import { SettleCreateSheet } from '../settlement/SettleCreateSheet';
import { SubHeader } from '../trip/SubHeader';
import { useTrip } from '../trip/TripContext';
import { ExpenseEditSheet } from './ExpenseEditSheet';

export function ListView() {
  const { trip, memberName, categoryOf, mutate, selection, setSelection, filter, setFilter } = useTrip();
  const sheet = useSheet();
  const toast = useToast();

  const shown = trip.expenses.filter((e) => filter === 'all' || e.categoryId === filter);
  const krwOf = (e: Expense) => convertToKRW(trip, e) ?? 0;
  const pending = trip.fixedExchangeRate == null && shown.some((e) => e.currency !== 'KRW');
  const totalLocal = sum(shown.filter((e) => e.currency !== 'KRW').map((e) => e.amount));

  // 날짜는 최신순, 같은 날짜 안에서는 여행방에 저장된 순서를 따른다.
  const groups = new Map<string, Expense[]>();
  for (const e of shown) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);
  const dates = [...groups.keys()].sort().reverse();

  const byCat = trip.categories
    .map((c) => ({ c, look: categoryLook(c), krw: sum(trip.expenses.filter((e) => e.categoryId === c.categoryId).map(krwOf)) }))
    .filter((x) => x.krw > 0);
  const allKrw = sum(byCat.map((x) => x.krw));
  const picked = selection ? trip.expenses.filter((e) => selection.has(e.expenseId)) : [];

  const edit = (id: string) => sheet.open((close) => <ExpenseEditSheet id={id} close={close} />);

  function toggle(id: string) {
    const next = new Set(selection);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelection(next);
  }

  function startSettle() {
    if (picked.some((e) => convertToKRW(trip, e) == null)) return toast('고정 환율이 저장된 뒤에 정산을 요청할 수 있어요.');
    const ids = picked.map((e) => e.expenseId);
    sheet.open((close) => <SettleCreateSheet expenseIds={ids} close={close} />);
  }

  async function remove(e: Expense) {
    const ok = await sheet.confirm({
      title: `'${e.caption}' 내역을 삭제할까요?`,
      body: '삭제하면 모든 멤버의 목록에서 사라져요. 이미 만든 정산 요청의 금액은 그대로 유지돼요.',
      ok: '삭제',
      danger: true,
    });
    if (!ok) return;
    await mutate('DELETE', `/expenses/${e.expenseId}`);
    if (selection?.has(e.expenseId)) toggle(e.expenseId);
    toast('삭제했어요');
  }

  // FR-4.6: 같은 날짜 안에서 바로 위·아래 내역과 자리를 바꾸고, 바뀐 순서를 여행방에 저장한다.
  async function move(e: Expense, dir: -1 | 1) {
    const peers = shown.filter((x) => x.date === e.date);
    const other = peers[peers.indexOf(e) + dir];
    if (!other) return toast(dir < 0 ? '이 날짜의 맨 위 내역이에요.' : '이 날짜의 맨 아래 내역이에요.');
    const ids = trip.expenses.map((x) => x.expenseId);
    const a = ids.indexOf(e.expenseId);
    const b = ids.indexOf(other.expenseId);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await mutate('PUT', '/expenses/order', { ids });
  }

  function openActions(e: Expense) {
    const run = (close: () => void, fn: () => Promise<unknown> | void) => async () => {
      close();
      try {
        await fn();
      } catch (err) {
        toast(errorText(err));
      }
    };
    sheet.open((close) => (
      <>
        <SheetHead title={e.caption} onClose={close} />
        <div className="menu">
          <button type="button" onClick={run(close, () => void edit(e.expenseId))}>
            <Icon name="pencil" /> 수정
          </button>
          <button type="button" onClick={run(close, () => move(e, -1))}>
            <Icon name="up" /> 위로 이동
          </button>
          <button type="button" onClick={run(close, () => move(e, 1))}>
            <Icon name="down" /> 아래로 이동
          </button>
          <button type="button" className="danger" onClick={run(close, () => remove(e))}>
            <Icon name="trash" /> 삭제
          </button>
        </div>
      </>
    ));
  }

  const onRowKey = (ev: KeyboardEvent<HTMLLIElement>) => {
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target === ev.currentTarget) {
      ev.preventDefault();
      ev.currentTarget.click();
    }
  };

  const row = (e: Expense) => {
    const krw = convertToKRW(trip, e);
    const isPicked = selection?.has(e.expenseId) ?? false;
    // 이미 정산 요청에 들어간 내역은 다시 고를 수 없다.
    const locked = Boolean(selection) && e.isSettled;
    const look = categoryLook(categoryOf(e.categoryId));
    return (
      <li
        key={e.expenseId}
        className={`exp ${isPicked ? 'picked' : ''} ${locked ? 'locked' : ''}`}
        tabIndex={locked ? -1 : 0}
        role={selection ? 'checkbox' : undefined}
        aria-checked={selection ? isPicked : undefined}
        aria-disabled={locked || undefined}
        onClick={() => (locked ? undefined : selection ? toggle(e.expenseId) : edit(e.expenseId))}
        onKeyDown={onRowKey}
      >
        {selection && <span className="tick">{isPicked && <Icon name="check" size={16} />}</span>}
        <span className={`cat-ic sm tone-${look.tone}`}>
          <Icon name={look.icon} size={20} />
        </span>
        <div className="exp-main">
          <strong>
            {e.caption}
            {e.isSettled && <span className="badge">정산 요청됨</span>}
          </strong>
          <small>
            {e.currency === 'KRW' ? '원화 결제' : localMoney(trip, e.amount, e.currency)} · {memberName(e.memberId)}
          </small>
        </div>
        <b className={`exp-krw ${krw == null ? 'muted' : ''}`}>{krw == null ? '환율 미확정' : won(krw)}</b>
        {!selection && (
          <button
            type="button"
            className="more"
            aria-label={`${e.caption} 더보기`}
            onClick={(ev) => {
              ev.stopPropagation();
              openActions(e);
            }}
          >
            <Icon name="etc" />
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      <SubHeader active="list" />
      <section className="total-card">
        <div>
          <span>{filter === 'all' ? '총 지출' : `${categoryOf(filter)?.name} 지출`}</span>
          <strong>
            {filter === 'all'
              ? trip.totalExpense == null
                ? '환율 미확정'
                : won(trip.totalExpense)
              : pending
                ? '환율 미확정'
                : won(sum(shown.map(krwOf)))}
          </strong>
          {totalLocal > 0 && <small>{localMoney(trip, totalLocal, trip.currencyCode)}</small>}
        </div>
        {allKrw > 0 && (
          <div className="mix">
            <div className="mix-bar">
              {byCat.map((x) => (
                <i key={x.c.categoryId} className={`tone-${x.look.tone}`} style={{ flex: x.krw }} />
              ))}
            </div>
            <ul>
              {byCat.map((x) => (
                <li key={x.c.categoryId}>
                  <i className={`tone-${x.look.tone}`} />
                  {x.c.name} {Math.round((x.krw / allKrw) * 100)}%
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <div className="pills" role="tablist" aria-label="카테고리 필터">
        {[{ categoryId: 'all', name: '전체' }, ...trip.categories].map((c) => (
          <button
            key={c.categoryId}
            type="button"
            className={`pill ${filter === c.categoryId ? 'on' : ''}`}
            role="tab"
            aria-selected={filter === c.categoryId}
            onClick={() => setFilter(c.categoryId)}
          >
            {c.name}
          </button>
        ))}
      </div>
      {selection && <p className="select-tip">정산할 내역을 눌러서 골라 주세요. 이미 정산 요청된 내역은 고를 수 없어요.</p>}
      {dates.length ? (
        dates.map((date) => (
          <section key={date} className="day">
            <h2>
              <span>{fmtDate(date, 'long')}</span>
              <span>{pending ? '' : won(sum(groups.get(date)!.map(krwOf)))}</span>
            </h2>
            <ul className="card exp-list">{groups.get(date)!.map(row)}</ul>
          </section>
        ))
      ) : (
        <div className="empty">
          <Bird />
          <p>
            {trip.expenses.length ? (
              '이 카테고리에는 아직 내역이 없어요.'
            ) : (
              <>
                아직 기록한 지출이 없어요.
                <br />첫 지출을 추가해 보세요!
              </>
            )}
          </p>
        </div>
      )}
      {selection ? (
        <div className="select-bar">
          <button type="button" className="btn ghost sm" onClick={() => setSelection(null)}>
            취소
          </button>
          <div>
            <b>{picked.length}개 선택</b>
            <span>{won(sum(picked.map(krwOf)))}</span>
          </div>
          <button type="button" className="btn primary sm" disabled={!picked.length} onClick={startSettle}>
            정산하기
          </button>
        </div>
      ) : (
        trip.expenses.length > 0 && (
          <button type="button" className="fab fab-settle" aria-label="정산할 내역 고르기" onClick={() => setSelection(new Set())}>
            <b>₩</b>
            <span>정산</span>
          </button>
        )
      )}
    </>
  );
}

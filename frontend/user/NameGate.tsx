'use client';

// 최초 접속 시 표시 이름을 정한다. 기존 멤버 이름을 고르거나 새 이름으로 참여한다.

import { useState, type FormEvent } from 'react';
import { errorText } from '../common/api';
import { Icon } from '../common/Icon';
import { useToast } from '../common/overlay';
import { useTrip } from '../trip/TripContext';

export function NameGate({ close }: { close?: () => void }) {
  const { trip, setMe, mutate } = useTrip();
  const toast = useToast();
  const [name, setName] = useState('');

  const join = (id: string) => {
    setMe(id);
    close?.();
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      const data = await mutate<{ memberId: string }>('POST', '/members', { name });
      join(data.memberId);
    } catch (err) {
      toast(errorText(err));
    }
  }

  return (
    <>
      <h2>누구로 참여할까요?</h2>
      <p className="sheet-desc">
        <b>{trip.title}</b> 여행방이에요. 내 이름을 고르거나 새로 입력해 주세요.
      </p>
      <div className="chips">
        {trip.members.map((m) => (
          <button key={m.memberId} type="button" className="chip" onClick={() => join(m.memberId)}>
            {m.name}
          </button>
        ))}
      </div>
      <form className="inline-form" onSubmit={submit}>
        <label className="field field-grow">
          <span className="field-ic">
            <Icon name="user" />
          </span>
          <input name="name" placeholder="새 이름으로 참여" maxLength={12} autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="btn primary">참여</button>
      </form>
      <p className="fine">참여 정보는 이 브라우저에만 저장돼요. 링크를 가진 사람은 누구나 이 여행방을 보고 편집할 수 있어요.</p>
    </>
  );
}

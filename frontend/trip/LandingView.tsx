'use client';

// 첫 화면 — 여행방 만들기 (공유 링크 없이 접속했을 때)

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { CURRENCIES, type Trip } from '@/shared/domain';
import { api, errorText } from '../common/api';
import { addDays, today } from '../common/format';
import { Bird, Icon } from '../common/Icon';
import { useToast } from '../common/overlay';
import { markJustCreated, recentTrips, saveMe, type RecentTrip } from '../user/userService';

interface Created {
  trip: Trip;
  memberId?: string;
  rateError?: string | null;
}

export function LandingView() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<RecentTrip[]>([]);
  const [form, setForm] = useState(() => ({
    title: '',
    currencyCode: CURRENCIES[0].currencyCode,
    startDate: today(),
    endDate: addDays(today(), 4),
    myName: '',
  }));

  useEffect(() => setRecent(recentTrips()), []);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  function enter(data: Created) {
    if (data.memberId) {
      saveMe(data.trip.tripId, data.memberId);
      markJustCreated(data.trip.tripId);
    }
    router.push(data.trip.inviteLink);
    if (data.rateError) toast(data.rateError);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      enter((await api<Created>('POST', '/api/trips', form))!);
    } catch (err) {
      setBusy(false);
      toast(errorText(err));
    }
  }

  async function demo() {
    try {
      enter((await api<Created>('POST', '/api/trips/demo'))!);
    } catch (err) {
      toast(errorText(err));
    }
  }

  return (
    <main className="landing">
      <div className="hero">
        <Bird />
        <h1 className="brand">방방곡곡</h1>
        <p className="tagline">
          친구들과 함께 쓰는 여행 가계부.
          <br />
          가입 없이 링크 하나로 기록하고 정산해요.
        </p>
      </div>
      <form className="card rec-form" noValidate onSubmit={create}>
        <label className="field">
          <span className="field-ic">
            <Icon name="pencil" />
          </span>
          <input name="title" placeholder="여행 이름 (예: 방콕 여행)" maxLength={20} autoComplete="off" value={form.title} onChange={set('title')} />
        </label>
        <label className="field">
          <span className="field-ic">
            <Icon name="pin" />
          </span>
          <select name="currencyCode" aria-label="여행 국가" value={form.currencyCode} onChange={set('currencyCode')}>
            {CURRENCIES.map((c) => (
              <option key={c.currencyCode} value={c.currencyCode}>
                {c.nationName} · {c.currencyCode}
              </option>
            ))}
          </select>
          <Icon name="down" size={18} />
        </label>
        <div className="field-row">
          <label className="field field-grow">
            <input type="date" name="startDate" aria-label="시작일" value={form.startDate} onChange={set('startDate')} />
          </label>
          <label className="field field-grow">
            <input type="date" name="endDate" aria-label="종료일" value={form.endDate} onChange={set('endDate')} />
          </label>
        </div>
        <label className="field">
          <span className="field-ic">
            <Icon name="user" />
          </span>
          <input name="myName" placeholder="내 이름" maxLength={12} autoComplete="off" value={form.myName} onChange={set('myName')} />
        </label>
        <p className="hint">환율은 여행방을 만드는 순간의 한국수출입은행 고시 환율로 고정돼요.</p>
        <button className="btn primary block" disabled={busy}>
          여행방 만들기
        </button>
        <button type="button" className="btn ghost block" onClick={demo}>
          샘플 여행방 둘러보기
        </button>
      </form>
      {recent.length > 0 && (
        <section className="recent">
          <h2>최근에 연 여행방</h2>
          {recent.map((t) => (
            <Link key={t.tripId} className="card" href={`/t/${t.tripId}`}>
              <span>{t.title}</span>
              <Icon name="back" size={18} />
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

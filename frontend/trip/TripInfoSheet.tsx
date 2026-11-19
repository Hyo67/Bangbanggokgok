'use client';

// 여행방 정보·초대 링크·멤버 시트 (Member.updateName, Member.leaveTrip)

import { useState, type FormEvent } from 'react';
import { currencyOf } from '@/shared/domain';
import { errorText } from '../common/api';
import { fmtDate, rateLabel, rateText } from '../common/format';
import { Icon } from '../common/Icon';
import { SheetHead, useSheet, useToast } from '../common/overlay';
import { useLiveRate } from '../currency/useLiveRate';
import { NameGate } from '../user/NameGate';
import { copyShareLink, shareUrl } from './share';
import { useTrip } from './TripContext';

export function TripInfoSheet({ close, created = false }: { close(): void; created?: boolean }) {
  const { trip, me, setMe, mutate, memberName } = useTrip();
  const toast = useToast();
  const sheet = useSheet();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const currency = currencyOf(trip.currencyCode);
  const live = useLiveRate(trip.currencyCode);

  async function rename(e: FormEvent) {
    e.preventDefault();
    try {
      await mutate('PATCH', `/members/${me}`, { name });
      setRenaming(false);
      toast('이름을 바꿨어요');
    } catch (err) {
      toast(errorText(err));
    }
  }

  async function leave() {
    const ok = await sheet.confirm({
      title: '여행방에서 나갈까요?',
      body: '지출이나 정산 기록이 있으면 나갈 수 없어요. 나가도 초대 링크로 다시 참여할 수 있어요.',
      ok: '나가기',
      danger: true,
    });
    if (!ok) return;
    try {
      await mutate('DELETE', `/members/${me}`);
      close();
      setMe(null);
      toast('여행방에서 나갔어요');
    } catch (err) {
      toast(errorText(err));
    }
  }

  return (
    <>
      <SheetHead title={created ? '여행방이 만들어졌어요!' : trip.title} onClose={close} />
      {created && <p className="sheet-desc">아래 초대 링크를 친구에게 보내면 가입 없이 바로 함께 기록할 수 있어요.</p>}
      <div className="link-box">
        <span>{shareUrl(trip)}</span>
        <button type="button" className="btn primary sm" onClick={() => copyShareLink(trip, toast)}>
          <Icon name="link" size={18} /> 복사
        </button>
      </div>
      <p className="fine">링크를 가진 사람은 누구나 접근할 수 있으니 함께 여행하는 친구에게만 공유해 주세요.</p>
      <dl className="info">
        <div>
          <dt>여행지</dt>
          <dd>
            {currency.nationName} · {currency.currencyCode}
          </dd>
        </div>
        <div>
          <dt>기간</dt>
          <dd>
            {fmtDate(trip.startDate)} - {fmtDate(trip.endDate)}
          </dd>
        </div>
        <div>
          <dt>고정 환율</dt>
          <dd>
            {trip.fixedExchangeRate == null ? (
              '아직 저장되지 않았어요'
            ) : (
              <>
                {rateText(trip)}{' '}
                {trip.rateSample ? <span className="badge">샘플</span> : <small>{fmtDate(trip.rateDate!)} 고정</small>}
              </>
            )}
          </dd>
        </div>
        <div>
          <dt>실시간 환율</dt>
          <dd>
            {live.status === 'ok' ? (
              <>
                {rateLabel(trip.currencyCode, live.rate)} <small>네이버 기준</small>
              </>
            ) : live.status === 'loading' ? (
              '불러오는 중…'
            ) : (
              '불러오지 못했어요'
            )}
          </dd>
        </div>
      </dl>
      <p className="fine">지출 환산과 정산에는 여행방을 만들 때 고정한 환율을 써요. 실시간 환율은 참고용이에요.</p>
      <h3>멤버 {trip.members.length}명</h3>
      <div className="chips">
        {trip.members.map((m) => (
          <span key={m.memberId} className={`chip ${m.memberId === me ? 'on' : ''}`}>
            {m.name}
            {m.memberId === me ? ' (나)' : ''}
          </span>
        ))}
      </div>
      {me &&
        (renaming ? (
          <form className="inline-form" onSubmit={rename}>
            <label className="field field-grow">
              <span className="field-ic">
                <Icon name="user" />
              </span>
              <input name="name" maxLength={12} autoComplete="off" autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="새 이름" />
            </label>
            <button className="btn primary">저장</button>
          </form>
        ) : (
          <div className="btn-row">
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setName(memberName(me));
                setRenaming(true);
              }}
            >
              내 이름 바꾸기
            </button>
            <button type="button" className="btn ghost sm" onClick={leave}>
              여행방 나가기
            </button>
          </div>
        ))}
      <button
        type="button"
        className="btn ghost block"
        onClick={() => {
          close();
          sheet.open((closeGate) => <NameGate close={closeGate} />);
        }}
      >
        다른 이름으로 참여하기
      </button>
    </>
  );
}

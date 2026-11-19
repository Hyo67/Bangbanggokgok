'use client';

// 실시간 환율 (네이버 기준). 화면에 보여 주기만 하고, 여행방 계산에는 고정 환율을 쓴다.

import { useEffect, useState } from 'react';
import type { Currency } from '@/shared/domain';
import { api } from '../common/api';

export type LiveRate = { status: 'loading' } | { status: 'ok'; rate: number; fetchedAt: string } | { status: 'error' };

export function useLiveRate(currencyCode: string): LiveRate {
  const [live, setLive] = useState<LiveRate>({ status: 'loading' });
  useEffect(() => {
    let gone = false;
    setLive({ status: 'loading' });
    api<{ currency: Currency & { currencyRate: number; fetchedAt: string } }>('GET', `/api/rates/${currencyCode}`)
      .then((data) => !gone && setLive({ status: 'ok', rate: data!.currency.currencyRate, fetchedAt: data!.currency.fetchedAt }))
      .catch(() => !gone && setLive({ status: 'error' }));
    return () => {
      gone = true;
    };
  }, [currencyCode]);
  return live;
}

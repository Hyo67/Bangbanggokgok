// Trip.inviteLink — 초대 링크를 공유하면 회원가입 없이 바로 참여할 수 있다.

import type { Trip } from '@/shared/domain';

export const shareUrl = (trip: Trip) => new URL(trip.inviteLink, location.origin).href;

export async function copyShareLink(trip: Trip, toast: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(shareUrl(trip));
    toast('초대 링크를 복사했어요');
  } catch {
    toast('복사하지 못했어요. 주소창의 링크를 복사해 주세요.');
  }
}

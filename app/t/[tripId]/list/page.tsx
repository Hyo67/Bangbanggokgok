import { redirect } from 'next/navigation';

// 지출 내역은 메인 화면으로 합쳐졌다. 예전 링크는 메인 화면으로 보낸다.
export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  redirect(`/t/${tripId}`);
}

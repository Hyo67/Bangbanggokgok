import Link from 'next/link';
import { Bird } from './Icon';

// 여행방을 열 수 없을 때의 안내 화면
export function Notice({ message }: { message: string }) {
  return (
    <div className="notice">
      <Bird />
      <p>{message}</p>
      <Link className="btn primary" href="/">
        새 여행방 만들기
      </Link>
    </div>
  );
}

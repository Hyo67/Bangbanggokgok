# 방방곡곡

친구들과 함께 떠나는 여행에서 지출을 실시간으로 기록하고 분할 정산하는 여행 가계부 공유 서비스.
회원가입 없이 공유 링크만으로 접속한다.

## 기술 스택

| 구분 | 기술 | 호스팅 |
| --- | --- | --- |
| Frontend | Next.js (React, TypeScript) | Vercel |
| Backend | Next.js Route Handlers (TypeScript) | Vercel |
| Database | PostgreSQL | Supabase |
| 외부 API | 한국수출입은행 현재환율 API | — |

## 실행

Node.js 20.12 이상이 필요하다.

```bash
npm install
cp .env.example .env   # EXIM_API_KEY, DATABASE_URL 입력
npm run dev            # http://localhost:3000
```

- `DATABASE_URL`을 비워 두면 로컬에서는 임베디드 Postgres(PGlite)가 `.pglite/` 폴더에 데이터를 저장한다. 스키마는 처음 실행할 때 `db/schema.sql`로 자동으로 만들어진다.
- `EXIM_API_KEY`가 없으면 여행방은 만들어지지만 고정 환율이 저장되지 않고, 화면에서 재시도를 안내한다. 키 없이 화면을 살펴보려면 첫 화면의 **샘플 여행방 둘러보기**를 쓴다(샘플 환율 ฿1 = 42원).

## 배포 (Vercel + Supabase)

1. Supabase **Connect → Transaction pooler** 연결 문자열(6543 포트)을 `.env`의 `DATABASE_URL`에 넣는다. 비밀번호의 `[ ]`는 빼고, 특수문자는 URL 인코딩한다.
2. `npm run db:migrate`로 `db/schema.sql`을 적용한다(SQL Editor에 붙여 넣어 실행해도 된다).
3. Vercel에 이 저장소를 연결하고 환경 변수 `DATABASE_URL`, `EXIM_API_KEY`를 설정한다.

브라우저는 Supabase에 직접 접속하지 않는다. 모든 읽기·쓰기는 백엔드(Route Handlers)가 DB에 연결해 처리하며, 테이블에는 RLS를 켜 두어 공개 키로는 접근할 수 없다.

## 환율 API 연결

1. [한국수출입은행 Open API](https://www.koreaexim.go.kr/ir/HPHKIR020M01?apino=2&viewtype=C)에서 **현재환율** 인증키를 발급받는다.
2. `.env`(로컬)와 Vercel 환경 변수에 `EXIM_API_KEY=<인증키>`를 넣고 서버를 다시 띄운다.
3. 새 여행방을 만들면 그 순간의 매매 기준율이 `trips.fixed_exchange_rate`에 고정된다. 주말·공휴일이나 영업일 오전 11시 이전에는 직전 영업일 고시를 쓴다.

키가 없거나 조회에 실패하면 여행방은 환율 없이 만들어지고, 지출 기록 화면에서 **다시 시도**로 한 번 더 조회할 수 있다.

## 구조 (모듈뷰 → 폴더)

```
app/                         Next.js 라우팅 진입점 (화면 페이지 + /api Route Handlers)
frontend/                    화면 (React)
  user/                      User    — 이 브라우저의 참여자 식별, 최근 여행방 (UserService)
  trip/                      Trip    — 여행방 만들기, 화면 틀, 상태·동기화, 초대 링크, 멤버·카테고리 편집
  expense/                   Expense — 지출 기록, 지출 내역, 지출 수정
  settlement/                Settlement — 정산 요청 만들기·목록
  common/                    아이콘, 시트·토스트, 포맷, API 호출
  styles/globals.css
backend/                     서버 로직 (Route Handlers가 호출)
  trip/tripService.ts        TripService    — createTrip, addMember, removeMember, addCategory
  trip/memberService.ts      MemberService  — updateName, leaveTrip
  trip/categoryService.ts    TripCategory   — 기본 카테고리 생성, deleteCategory
  trip/tripRepository.ts     여행방 조회·잠금 (다른 모듈 서비스가 공통으로 사용)
  expense/expenseService.ts  ExpenseService — createExpense(Trip.addExpense), updateExpense, deleteExpense, 순서 변경
  settlement/settlementService.ts  SettlementService — requestSettlement, cancelSettlement, SettlementTarget.updateStatus
  currency/exchangeRateService.ts  ExchangeRateService — fetchRate(nationName): Currency
  common/                    DB 연결, 입력 검증, 오류 응답
db/schema.sql                Supabase(PostgreSQL) 스키마
shared/domain.ts             클래스 다이어그램의 도메인 타입·enum, convertToKRW·calculateTotal·splitAmount
```

User 모듈은 회원가입이 없으므로 서버에 계정을 두지 않고 브라우저(localStorage)에 "이 여행방에서 나는 누구인지"만 기억한다.

## 화면과 API

| 경로 | 화면 |
| --- | --- |
| `/` | 여행방 만들기 |
| `/t/:tripId` | 지출 기록 — 초대 링크의 첫 화면 |
| `/t/:tripId/list` | 지출 내역 (수정·삭제·순서 변경, 정산 항목 선택) |
| `/t/:tripId/settle` | 정산 요청 목록 |

화면 폭 960px 이상에서는 지출 기록과 서브 화면이 나란히 보인다. 다른 멤버의 변경은 4초 간격으로 가져온다.

| 메서드 | 경로 | 클래스.메서드 |
| --- | --- | --- |
| POST | `/api/trips` | Trip.createTrip |
| POST | `/api/trips/demo` | 샘플 여행방 |
| GET | `/api/trips/:tripId[?v=버전]` (버전이 같으면 204) | 여행방 조회 |
| POST | `/api/trips/:tripId/rate` | ExchangeRateService.fetchRate (재시도) |
| POST | `/api/trips/:tripId/members` | Trip.addMember |
| PATCH · DELETE | `/api/trips/:tripId/members/:memberId` | Member.updateName · Member.leaveTrip |
| POST | `/api/trips/:tripId/categories` | Trip.addCategory |
| DELETE | `/api/trips/:tripId/categories/:categoryId` | TripCategory.deleteCategory |
| POST | `/api/trips/:tripId/expenses` | Expense.createExpense |
| PATCH · DELETE | `/api/trips/:tripId/expenses/:expenseId` | Expense.updateExpense · deleteExpense |
| PUT | `/api/trips/:tripId/expenses/order` | 지출 순서 변경 |
| POST | `/api/trips/:tripId/settlements` | Settlement.requestSettlement |
| DELETE | `/api/trips/:tripId/settlements/:settlementId` | Settlement.cancelSettlement (CANCELLED로 남김) |
| PATCH | `/api/trips/:tripId/settlements/:settlementId/targets/:targetId` | SettlementTarget.updateStatus |

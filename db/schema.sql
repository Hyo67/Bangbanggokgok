-- 방방곡곡 데이터베이스 스키마 (Supabase / PostgreSQL)
-- Supabase SQL Editor에서 그대로 실행하면 된다. 여러 번 실행해도 안전하다.
-- 로컬 개발 DB(PGlite)는 서버가 처음 뜰 때 이 파일을 자동으로 실행한다.

-- Trip. trip_id는 추측할 수 없는 랜덤 값이고, 초대 링크(/t/<trip_id>)가 곧 접근 권한이다.
create table if not exists trips (
  trip_id             text primary key check (trip_id ~ '^[A-Za-z0-9_-]{32}$'),
  title               text not null check (char_length(title) between 1 and 20),
  currency_code       text not null,
  fixed_exchange_rate numeric,                    -- 원화 / 현지 통화 1단위, 생성 시 1회 고정
  rate_date           date,
  rate_sample         boolean not null default false,
  start_date          date not null,
  end_date            date not null,
  version             integer not null default 0, -- 하위 데이터가 바뀔 때마다 증가 (폴링용)
  created_at          timestamptz not null default clock_timestamp(),
  check (end_date >= start_date)
);

-- Member (Trip 1 : 1..* Member)
create table if not exists members (
  member_id  text primary key,
  trip_id    text not null references trips (trip_id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 12),
  created_at timestamptz not null default clock_timestamp(),
  unique (trip_id, name)
);

-- TripCategory (Trip 1 : 5..* TripCategory). 기본 카테고리 5개(DefaultCategoryType)는 지울 수 없다.
create table if not exists trip_categories (
  category_id text primary key,
  trip_id     text not null references trips (trip_id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 10),
  sort_order  integer not null,
  is_default  boolean not null default false,
  unique (trip_id, name)
);

-- Expense (Trip 1 : 0..* Expense, TripCategory 1 : 0..* Expense)
create table if not exists expenses (
  expense_id  text primary key,
  trip_id     text not null references trips (trip_id) on delete cascade,
  member_id   text not null references members (member_id),        -- 지출한 사람
  category_id text not null references trip_categories (category_id),
  caption     text not null check (char_length(caption) between 1 and 40),
  amount      numeric(16, 2) not null check (amount > 0),
  currency    text not null,
  spent_on    date not null,
  memo        text not null default '' check (char_length(memo) <= 200),
  position    integer not null,                                    -- 지출 내역 화면의 표시 순서
  created_at  timestamptz not null default clock_timestamp()
);
create index if not exists expenses_trip_idx on expenses (trip_id, position);
-- 멤버 나가기·카테고리 삭제 때 "쓰는 지출이 있는지"를 찾는 외래 키 조회용
create index if not exists expenses_member_idx on expenses (member_id);
create index if not exists expenses_category_idx on expenses (category_id);

-- Settlement
create table if not exists settlements (
  settlement_id text primary key,
  trip_id       text not null references trips (trip_id) on delete cascade,
  requester_id  text not null references members (member_id),      -- 돈을 받을 멤버
  total_amount  bigint not null,
  status        text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  created_at    timestamptz not null default clock_timestamp()
);
create index if not exists settlements_trip_idx on settlements (trip_id, created_at desc);
create index if not exists settlements_requester_idx on settlements (requester_id);

-- Settlement.selectedExpenses (Expense 0..* : 0..* Settlement)
-- 요청 시점의 항목·금액 사본이라 원본 지출이 수정·삭제돼도 남는다. 그래서 expenses를 외래 키로 참조하지 않는다.
create table if not exists settlement_expenses (
  settlement_id text not null references settlements (settlement_id) on delete cascade,
  position      integer not null,
  expense_id    text not null,
  caption       text not null,
  amount        numeric(16, 2) not null,
  currency      text not null,
  spent_on      date not null,
  krw           bigint not null,
  primary key (settlement_id, position)
);
create index if not exists settlement_expenses_expense_idx on settlement_expenses (expense_id);

-- SettlementTarget (Settlement 1 : 1..* SettlementTarget, Member 1 : 0..* SettlementTarget)
create table if not exists settlement_targets (
  target_id     text primary key,
  settlement_id text not null references settlements (settlement_id) on delete cascade,
  member_id     text not null references members (member_id),
  amount        bigint not null check (amount >= 0),
  status        text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  position      integer not null,
  unique (settlement_id, member_id)
);
create index if not exists settlement_targets_member_idx on settlement_targets (member_id);

-- 하위 데이터가 바뀌면 여행방 version을 올려 다른 멤버의 폴링이 변경을 알아채게 한다.
create or replace function bump_trip_version() returns trigger
language plpgsql as $$
declare
  rec record;
  tid text;
begin
  if tg_op = 'DELETE' then rec := old; else rec := new; end if;
  if tg_table_name = 'settlement_targets' then
    select trip_id into tid from settlements where settlement_id = rec.settlement_id;
  else
    tid := rec.trip_id;
  end if;
  update trips set version = version + 1 where trip_id = tid;
  return null;
end $$;

drop trigger if exists members_bump on members;
create trigger members_bump after insert or update or delete on members
  for each row execute function bump_trip_version();
drop trigger if exists trip_categories_bump on trip_categories;
create trigger trip_categories_bump after insert or update or delete on trip_categories
  for each row execute function bump_trip_version();
drop trigger if exists expenses_bump on expenses;
create trigger expenses_bump after insert or update or delete on expenses
  for each row execute function bump_trip_version();
drop trigger if exists settlements_bump on settlements;
create trigger settlements_bump after insert or update or delete on settlements
  for each row execute function bump_trip_version();
drop trigger if exists settlement_targets_bump on settlement_targets;
create trigger settlement_targets_bump after insert or update or delete on settlement_targets
  for each row execute function bump_trip_version();

-- 브라우저가 Supabase에 직접 접근하지 않고 백엔드(Route Handlers)만 DB에 연결한다.
-- RLS를 켜 두고 정책을 만들지 않으면 anon/authenticated 키로는 아무것도 읽거나 쓸 수 없다.
alter table trips enable row level security;
alter table members enable row level security;
alter table trip_categories enable row level security;
alter table expenses enable row level security;
alter table settlements enable row level security;
alter table settlement_expenses enable row level security;
alter table settlement_targets enable row level security;

-- 공개 역할에는 테이블 권한을 하나도 두지 않는다. TRUNCATE·TRIGGER·REFERENCES는 RLS로 막히지 않는 권한이다.
-- 기본 권한도 함께 바꿔 앞으로 postgres가 만드는 테이블에도 같은 권한이 생기지 않게 한다.
-- (Supabase가 아닌 로컬 PGlite에는 이 역할이 없으므로 있을 때만 실행한다.)
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') and exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from anon, authenticated;
    alter default privileges in schema public revoke all on tables from anon, authenticated;
  end if;
end $$;

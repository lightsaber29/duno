-- 날짜별 투두 스키마. Supabase 대시보드 > SQL Editor에 붙여 넣고 실행.
-- 근거: docs/스케이트보드 phase1 개발 계획.md "데이터"

-- 피벗 전 Duno 테이블 정리. 기록이 모두 지워진다(2026-10-15 승인).
drop table if exists entry_shares, entries, subgoals, plan_changes, status_views, plans cascade;
drop function if exists owns_plan(uuid), owns_entry(uuid);

-- 할 일. 한 개가 한 행. date는 사용자 기기의 지역 날짜. 목록 순서는 created_at.
create table todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  text text not null check (char_length(text) between 1 and 100),
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index todos_user_date on todos(user_id, date);

-- 주. 처음 쓸 때 생성. 완료율은 저장하지 않고 todos에서 계산한다(지난주는 화면에서 읽기 전용).
create table weeks (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1), -- 월요일
  goal text not null default '' check (char_length(goal) <= 40),
  good text not null default '' check (char_length(good) <= 40),
  bad text not null default '' check (char_length(bad) <= 40),
  closed_at timestamptz, -- 마감 흐름을 끝냈거나 건너뛴 시각. 있으면 다시 띄우지 않음
  primary key (user_id, week_start)
);

-- RLS: 본인 데이터만.
alter table todos enable row level security;
alter table weeks enable row level security;
create policy own on todos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on weeks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

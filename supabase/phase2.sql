-- phase2(킥보드): 핵심목표·카테고리·시간. schema.sql 다음에 한 번 실행. 기존 데이터는 그대로 둔다.
-- 근거: docs/킥보드 phase2 개발 계획.md "데이터"

-- 핵심목표. 사용자당 한 줄. 행이 없으면 진입 화면.
create table profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  core_goal text not null check (char_length(core_goal) between 1 and 30)
);

-- 카테고리 최대 5개(화면에서 확인). 비율 합 100%도 화면에서 확인. 기타는 행 없이 category_id = null.
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 8),
  ratio int not null check (ratio between 0 and 100),
  position int not null,
  created_at timestamptz not null default now(),
  unique (id, user_id) -- todos가 남의 카테고리를 못 가리키게 (user_id까지 묶은 외래 키용)
);
create index categories_user on categories(user_id);

-- 할 일에 카테고리와 쓴 시간. phase1 할 일은 기타·0분으로 이어진다.
alter table todos
  add column category_id uuid, -- null = 기타
  add column minutes int not null default 0 check (minutes between 0 and 1439), -- 0 = 아직 안 적음
  add foreign key (category_id, user_id) references categories(id, user_id) on delete set null (category_id); -- 카테고리가 지워지면 기타로

-- 날짜별 회고 한 줄.
create table days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  note text not null default '' check (char_length(note) <= 40),
  primary key (user_id, date)
);

-- 주간 마감에서 고른 시간 옮기기안. 메인의 주간 목표 아래 "시간 계획"으로 보인다.
alter table weeks add column time_plan text not null default '';

-- RLS: 본인 데이터만.
alter table profiles enable row level security;
alter table categories enable row level security;
alter table days enable row level security;
create policy own on profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on categories for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on days for all using (user_id = auth.uid()) with check (user_id = auth.uid());

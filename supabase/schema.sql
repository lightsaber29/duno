-- Duno 스키마. Supabase 대시보드 > SQL Editor에 붙여 넣고 실행.
-- 근거: duno-one-pager.md 6절 "저장할 데이터", duno-screens-and-rules.md 6절·8절

-- 계획. 사용자당 활성 계획 하나. 핵심 목표를 바꾸면 기존 계획은 archived_at을 찍고 새 계획을 만든다.
create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (char_length(goal) between 1 and 25),
  notify_at time not null default '21:00',
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index plans_one_active on plans(user_id) where archived_at is null;

-- 세부 목표. 계획 순서는 position. 삭제하면 removed_at을 찍고 행은 남긴다(결정 2-8, 2-17: 뺀 세부 목표의 시간은 남고, 같은 이름을 다시 넣으면 새 행).
create table subgoals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 15),
  ratio int not null check (ratio between 1 and 100),
  position int not null,
  removed_at timestamptz
);
create index subgoals_plan on subgoals(plan_id);

-- 일별 기록. 하루에 한 행. minutes가 null이면 휴식(결정: 작성과 휴식은 서로 바꿀 수 있다).
create table entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  date date not null,
  minutes int check (minutes is null or (minutes between 30 and 1440 and minutes % 30 = 0)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, date)
);

-- 기록 안의 세부 목표별 몫. subgoal_id가 null이면 기타(결정 2-21).
create table entry_shares (
  id bigint generated always as identity primary key,
  entry_id uuid not null references entries(id) on delete cascade,
  subgoal_id uuid references subgoals(id) on delete cascade,
  ratio int not null check (ratio between 1 and 100),
  -- nulls not distinct: 기타(null)도 기록당 하나만
  unique nulls not distinct (entry_id, subgoal_id)
);

-- 계획 변경 이력. 화면에는 안 보임(제안). 바뀐 전후를 json으로 한 줄.
create table plan_changes (
  id bigint generated always as identity primary key,
  plan_id uuid not null references plans(id) on delete cascade,
  changed_at timestamptz not null default now(),
  before jsonb,
  after jsonb
);

-- 검증용 로그. 현재 상태 화면을 연 시각만(원페이저 6절 측정 방법).
create table status_views (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

-- RLS: 본인 데이터만. plans.user_id를 기준으로 하위 테이블을 잇는다.
alter table plans enable row level security;
alter table subgoals enable row level security;
alter table entries enable row level security;
alter table entry_shares enable row level security;
alter table plan_changes enable row level security;
alter table status_views enable row level security;

create policy own on plans for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own on status_views for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create function owns_plan(p uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from plans where id = p and user_id = auth.uid())
$$;
create policy own on subgoals for all using (owns_plan(plan_id)) with check (owns_plan(plan_id));
create policy own on entries for all using (owns_plan(plan_id)) with check (owns_plan(plan_id));
create policy own on plan_changes for all using (owns_plan(plan_id)) with check (owns_plan(plan_id));

create function owns_entry(e uuid) returns boolean language sql stable security definer as $$
  select exists (select 1 from entries join plans on plans.id = entries.plan_id where entries.id = e and plans.user_id = auth.uid())
$$;
create policy own on entry_shares for all using (owns_entry(entry_id)) with check (owns_entry(entry_id));

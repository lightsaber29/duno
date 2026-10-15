-- phase4(오토바이): 진입일, 비율 스냅샷, 회고 저장 표시. phase3.sql 다음에 한 번 실행. 기존 데이터는 그대로 둔다.
-- 근거: docs/오토바이 phase4 개발 계획.md "데이터", E4

-- 진입일(한국 날짜). 편향 보기 "지금까지"와 고를 수 있는 주가 이 날부터(BI-3).
-- 앞으로는 진입을 마칠 때 앱이 기기 날짜를 넣는다. 기본값은 만약을 위한 것.
alter table profiles add column started_on date;
-- 이미 진입한 계정: 그 계정 첫 카테고리를 만든 날. 진입 저장 때 카테고리를 먼저 만들어서 앱으로 진입했으면 진입한 날과 같다(E4).
update profiles p set started_on = (select min(c.created_at at time zone 'Asia/Seoul')::date from categories c where c.user_id = p.user_id);
update profiles set started_on = (now() at time zone 'Asia/Seoul')::date where started_on is null; -- 카테고리가 없는 계정(이론상 없음)
alter table profiles
  alter column started_on set not null,
  alter column started_on set default (now() at time zone 'Asia/Seoul')::date;

-- 비율 스냅샷: 카테고리를 더하거나 지우기 직전의 핵심목표 비율(TD-6). 이번엔 저장만 하고 보여 주지 않는다.
create table ratio_snapshots (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  taken_at timestamptz not null default now(),
  ratios jsonb not null -- [{ "category_id", "name", "ratio" }]
);
create index ratio_snapshots_user on ratio_snapshots(user_id);

-- 그날 회고를 저장한 때. 0분으로 저장한 날도 기록한 날(RV-5).
alter table days add column reviewed_at timestamptz;

-- RLS: 본인 데이터만.
alter table ratio_snapshots enable row level security;
create policy own on ratio_snapshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());

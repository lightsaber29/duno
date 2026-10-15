-- phase3(자전거): 주간 목표 시간·주간 비율·할 일 입력 권유. phase2.sql 다음에 한 번 실행. 기존 데이터는 그대로 둔다.
-- 근거: docs/자전거 phase3 개발 계획.md "데이터"

-- 카테고리 지운 표시. 앱은 행을 지우지 않아서 그 카테고리 할 일과 시간이 그대로 남는다(TD-3).
alter table categories add column deleted_at timestamptz;

-- 주간 비율: 주마다 정한 카테고리별 비율 묶음(합 100%는 화면에서 확인).
-- 어느 주의 기준 = 그 주 묶음 → 그 이전 가장 최근 묶음 → 핵심목표 비율(categories.ratio).
create table week_ratios (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1), -- 월요일
  category_id uuid not null,
  ratio int not null check (ratio between 0 and 100),
  primary key (user_id, week_start, category_id),
  foreign key (category_id, user_id) references categories(id, user_id) on delete cascade -- 남의 카테고리는 못 가리킨다
);

-- 주간 목표 시간(그 주부터 적용, 0.5시간 단위 1~100시간)과 마감에서 바꾼 것(WC-11).
alter table weeks
  add column target_minutes int check (target_minutes between 60 and 6000 and target_minutes % 30 = 0),
  add column changes jsonb;

-- 할 일 입력 권유로 추가한 할 일(NU-8 성공 판단용), 그날 권유를 닫았는지(NU-6).
alter table todos add column nudged boolean not null default false;
alter table days add column nudge_closed boolean not null default false;

-- RLS: 본인 데이터만.
alter table week_ratios enable row level security;
create policy own on week_ratios for all using (user_id = auth.uid()) with check (user_id = auth.uid());

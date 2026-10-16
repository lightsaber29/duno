-- phase4.5: 주간 마감·회고 저장을 함수 하나로(한 트랜잭션). phase4.sql 다음에 한 번 실행. 기존 데이터는 그대로 둔다.
-- 근거: docs/오토바이 phase4 전문가 피드백.md F1·F7. 중간에 끊겨도 반만 저장되지 않는다.
-- security invoker라 RLS가 그대로 걸린다(본인 행만 보이고, 새 행 user_id는 기본값 auth.uid()).

-- 주간 마감 끝내기. p:
--   lw         지난주 월요일. 이번 주 = lw + 7
--   deleted    지울 카테고리 id 배열
--   renamed    [{id, name}]
--   added      새 카테고리 이름 배열(핵심목표 비율 0%, 맨 뒤에)
--   ratios     바뀐 핵심목표 비율 [{id, ratio}]
--   weekly     이번 주 주간 비율 [{id, ratio}] 또는 새 카테고리는 [{added: added 안 순서(0부터), ratio}]
--   goal, target_minutes  이번 주 목표·목표 시간
--   copy       이번 주 월요일로 복사할 할 일 [{text, category_id}] (순서 유지)
--   good, bad, changes    지난주 회고와 바꾼 것(WC-11)
-- 더하거나 지우면 바뀌기 직전 핵심목표 비율을 스냅샷으로(TD-6). 반환: 새 카테고리 id(added 순서)
create or replace function close_week(p jsonb) returns uuid[]
language plpgsql security invoker set search_path = public as $$
declare
  lw date := (p->>'lw')::date;
  tw date := lw + 7;
  made uuid[] := '{}';
  nm text;
  new_id uuid;
begin
  if jsonb_array_length(p->'deleted') > 0 or jsonb_array_length(p->'added') > 0 then
    insert into ratio_snapshots (ratios)
    select coalesce(jsonb_agg(jsonb_build_object('category_id', id, 'name', name, 'ratio', ratio) order by position), '[]')
    from categories where deleted_at is null;
  end if;

  update categories set deleted_at = now() where id in (select jsonb_array_elements_text(p->'deleted')::uuid);
  update categories c set name = r.name from jsonb_to_recordset(p->'renamed') r(id uuid, name text) where c.id = r.id;
  for nm in select jsonb_array_elements_text(p->'added') loop
    insert into categories (name, ratio, position)
    values (nm, 0, (select coalesce(max(position), -1) + 1 from categories))
    returning id into new_id;
    made := made || new_id;
  end loop;
  update categories c set ratio = r.ratio from jsonb_to_recordset(p->'ratios') r(id uuid, ratio int) where c.id = r.id;

  delete from week_ratios where week_start = tw;
  insert into week_ratios (week_start, category_id, ratio)
  select tw, coalesce(r.id, made[r.added + 1]), r.ratio from jsonb_to_recordset(p->'weekly') r(id uuid, added int, ratio int);

  insert into weeks (week_start, goal, target_minutes) values (tw, p->>'goal', (p->>'target_minutes')::int)
  on conflict (user_id, week_start) do update set goal = excluded.goal, target_minutes = excluded.target_minutes;

  -- 한 문장으로 넣으면 created_at이 같아 목록 순서가 흔들리니 1µs씩 벌린다
  insert into todos (date, text, category_id, created_at)
  select tw, r.text, r.category_id, now() + o * interval '1 microsecond'
  from rows from (jsonb_to_recordset(p->'copy') as (text text, category_id uuid)) with ordinality r(text, category_id, o);

  insert into weeks (week_start, good, bad, changes, closed_at) values (lw, p->>'good', p->>'bad', p->'changes', now())
  on conflict (user_id, week_start) do update set good = excluded.good, bad = excluded.bad, changes = excluded.changes, closed_at = excluded.closed_at;

  return made;
end $$;

-- 저녁 회고 저장: 할 일 시간들과 회고 한 줄·저장한 때(RV-5)를 한 번에. times: [{id, minutes}]
create or replace function save_review(d date, line text, times jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  update todos t set minutes = r.minutes from jsonb_to_recordset(times) r(id uuid, minutes int) where t.id = r.id;
  insert into days (date, note, reviewed_at) values (d, line, now())
  on conflict (user_id, date) do update set note = excluded.note, reviewed_at = excluded.reviewed_at;
end $$;

revoke execute on function close_week(jsonb), save_review(date, text, jsonb) from public, anon;
grant execute on function close_week(jsonb), save_review(date, text, jsonb) to authenticated;

-- 더미 데이터. Supabase 대시보드 > SQL Editor에서 실행.
-- 첫 줄의 이메일만 바꾼다. 그 사용자의 활성 계획이 있으면 보관(archived_at)하고 새 계획을 만든다.
-- 모양: 계획 25/35/20/20, 오늘 포함 아흐레 중 하루 휴식. 팀 프로젝트만 계획보다 많고 나머지는 모자람(결정 2-6).

do $$
declare
  v_email text := 'user@example.com';  -- ← 여기
  uid uuid;
  pid uuid;
  a uuid; b uuid; c uuid; d uuid;
  eid uuid;
begin
  select id into uid from auth.users where email = v_email;
  if uid is null then raise exception '사용자 없음: %. 먼저 한 번 로그인해야 한다', v_email; end if;

  update plans set archived_at = now() where user_id = uid and archived_at is null;

  insert into plans (user_id, goal, notify_at) values (uid, '상반기 백엔드 개발자 취업', '21:00') returning id into pid;
  insert into subgoals (plan_id, name, ratio, position) values (pid, '팀 프로젝트', 25, 0) returning id into a;
  insert into subgoals (plan_id, name, ratio, position) values (pid, '직무 공부', 35, 1) returning id into b;
  insert into subgoals (plan_id, name, ratio, position) values (pid, '포트폴리오', 20, 2) returning id into c;
  insert into subgoals (plan_id, name, ratio, position) values (pid, '면접 준비', 20, 3) returning id into d;

  -- 8일 전
  insert into entries (plan_id, date, minutes) values (pid, current_date - 8, 180) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 70), (eid, b, 20), (eid, null, 10);
  -- 7일 전
  insert into entries (plan_id, date, minutes) values (pid, current_date - 7, 240) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 60), (eid, c, 30), (eid, d, 10);
  -- 6일 전
  insert into entries (plan_id, date, minutes) values (pid, current_date - 6, 120) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 50), (eid, b, 50);
  -- 5일 전
  insert into entries (plan_id, date, minutes) values (pid, current_date - 5, 300) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 70), (eid, c, 20), (eid, null, 10);
  -- 4일 전: 휴식
  insert into entries (plan_id, date, minutes) values (pid, current_date - 4, null);
  -- 3일 전
  insert into entries (plan_id, date, minutes) values (pid, current_date - 3, 90) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 40), (eid, d, 60);
  -- 2일 전
  insert into entries (plan_id, date, minutes) values (pid, current_date - 2, 210) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 60), (eid, b, 20), (eid, c, 20);
  -- 어제
  insert into entries (plan_id, date, minutes) values (pid, current_date - 1, 150) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 50), (eid, c, 30), (eid, d, 20);
  -- 오늘
  insert into entries (plan_id, date, minutes) values (pid, current_date, 240) returning id into eid;
  insert into entry_shares (entry_id, subgoal_id, ratio) values (eid, a, 60), (eid, b, 10), (eid, c, 10), (eid, d, 10), (eid, null, 10);
end $$;

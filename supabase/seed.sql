-- 테스트용 더미 데이터(phase4). schema.sql·phase2.sql·phase3.sql·phase4.sql 다음에, Supabase 대시보드 > SQL Editor에 붙여 넣고 실행.
-- 가장 최근에 로그인한 사용자의 핵심목표·카테고리·할 일·주 기록·주간 비율·비율 스냅샷·회고 한 줄을 모두 지우고 예시를 넣는다.
-- 다시 실행하면 처음 상태로 돌아간다(주간 마감 흐름을 여러 번 시험할 때).
--
-- 넣는 것 (날짜는 한국 시간 오늘 기준)
-- 핵심목표 "나다운 일로 먹고사는 사람", 진입일 4주 전 월요일("지금까지"와 편향 보기 주 탭이 여기부터)
-- 카테고리(핵심목표 비율) 리서치 40 · 제작 40 · 피드백 20
--   지운 카테고리 "디자인"(0%): 3주 전 할 일 1시간 → 라벨은 이름 그대로 회색, 편향 보기에서는 분모에만(어느 칸에도 안 보임)
-- 주간 목표 시간 10시간(4주 전부터). 주간 비율은 지난주에만 리서치 50 · 제작 40 · 피드백 10(다른 주는 핵심목표 비율)
-- 지난 4주: 같은 모양의 주 4번. 주마다 리서치 7시간 30분 · 제작 1시간 50분 · 피드백 40분 · 기타 50분 = 10시간 50분
--   → 지금까지(핵심목표 비율 기준) 리서치 더, 제작 덜 → 메인에 할 일 입력 권유(제작 · 사용자 흐름 그리기 20분)
--   지난주는 마감 전 → 앱을 열면 주간 마감 흐름이 뜬다. 기록 10시간 50분 ≥ 목표 10시간 → "했다"
--   지난주 주간 비율 기준: 리서치 +19 더, 제작 -23 덜, 피드백 계획대로. 못 끝낸 일 3개
-- 이번 주: 오늘 이전엔 시간이 적혀 있고, 오늘 이후는 0분. 오늘은 회고 전(9시 이후 회고 안내 띠 시험)
-- 다음 주: 할 일 1개, 목표 없음
-- 진입 화면을 시험하려면 실행 뒤 profiles에서 그 사용자 행만 지우면 된다

do $$
declare
  uid uuid := (select id from auth.users order by last_sign_in_at desc nulls last limit 1);
  today date := (now() at time zone 'Asia/Seoul')::date;
  mon date := date_trunc('week', today)::date; -- 이번 주 월요일
  r uuid;
  m uuid;
  f uuid;
  g uuid; -- 지운 카테고리
begin
  if uid is null then
    raise exception '로그인한 사용자가 없어요. 앱에서 먼저 Google로 로그인하세요.';
  end if;

  delete from ratio_snapshots where user_id = uid;
  delete from week_ratios where user_id = uid;
  delete from days where user_id = uid;
  delete from weeks where user_id = uid;
  delete from todos where user_id = uid;
  delete from categories where user_id = uid;
  delete from profiles where user_id = uid;

  insert into profiles (user_id, core_goal, started_on) values (uid, '나다운 일로 먹고사는 사람', mon - 28);
  insert into categories (user_id, name, ratio, position) values (uid, '리서치', 40, 0) returning id into r;
  insert into categories (user_id, name, ratio, position) values (uid, '제작', 40, 1) returning id into m;
  insert into categories (user_id, name, ratio, position) values (uid, '피드백', 20, 2) returning id into f;
  insert into categories (user_id, name, ratio, position, deleted_at) values (uid, '디자인', 0, 3, now()) returning id into g;

  insert into week_ratios (user_id, week_start, category_id, ratio) values
    (uid, mon - 7, r, 50), (uid, mon - 7, m, 40), (uid, mon - 7, f, 10);

  insert into weeks (user_id, week_start, goal, good, bad, closed_at, target_minutes) values
    (uid, mon - 28, '인터뷰 5명 진행하기', '인터뷰 일정을 다 잡았다', '정리가 밀렸다', now(), 600),
    (uid, mon - 21, '문제 정의 확정하기', '초안을 드디어 썼다', '조사에만 시간을 썼다', now(), null),
    (uid, mon - 14, '사용자 흐름 완성하기', '', '', now(), null),
    (uid, mon - 7, '와이어프레임 핵심 화면 3장 완성하기', '', '', null, null), -- 마감 전
    (uid, mon, '와이어프레임 상세 화면 2장', '', '', null, null);

  -- 지난 4주: 같은 모양의 주를 4번. w: 몇 주 전, d: 월요일에서 며칠 뒤, n: 목록 순서
  insert into todos (user_id, date, text, category_id, done, minutes, created_at)
  select uid, mon - 7 * w + d, text,
         case c when 'r' then r when 'm' then m when 'f' then f end,
         done, minutes, now() - w * interval '1 day' + n * interval '1 ms'
  from generate_series(1, 4) as w,
  (values
    (1, 0, '인터뷰 질문 정리', 'r', true, 90),
    (2, 0, '레퍼런스 3개 찾기', 'r', true, 60),
    (3, 1, '경쟁 서비스 조사', 'r', true, 120),
    (4, 1, '문제 정의 초안 작성', 'm', true, 60),
    (5, 2, '인터뷰 메모 정리', 'r', true, 90),
    (6, 2, '노트북 폴더 정리', null, true, 30),
    (7, 3, '와이어프레임 1장', 'm', false, 30),
    (8, 3, '멘토 피드백 받기', 'f', true, 40),
    (9, 4, '설문 결과 분석', 'r', true, 90),
    (10, 4, '발표 일정 잡기', null, true, 20),
    (11, 5, '사용자 흐름 그리기', 'm', false, 20),
    (12, 6, '동료 리뷰 요청', 'f', false, 0)
  ) as t(n, d, text, c, done, minutes);

  -- 이번 주·다음 주: 오늘 이전만 체크·시간
  insert into todos (user_id, date, text, category_id, done, minutes, created_at)
  select uid, mon + d, text,
         case c when 'r' then r when 'm' then m when 'f' then f end,
         done and mon + d < today, case when mon + d < today then minutes else 0 end,
         now() + n * interval '1 ms'
  from (values
    (1, 0, '문제 정의 한 문장 쓰기', 'm', true, 60),
    (2, 0, '레퍼런스 정리', 'r', true, 45),
    (3, 1, '와이어프레임 2장', 'm', true, 90),
    (4, 1, '인터뷰 녹취 듣기', 'r', true, 60),
    (5, 2, '와이어프레임 3장', 'm', false, 30),
    (6, 2, '회의실 예약', null, true, 15),
    (7, 3, '멘토 피드백 반영', 'f', true, 40),
    (8, 3, '사용성 테스트 질문 정리', 'r', false, 30),
    (9, 4, '디자인 리뷰 준비', 'm', false, 30),
    (10, 4, '경쟁 서비스 세 곳의 온보딩 화면을 캡처하고 좋았던 점과 아쉬운 점을 한 줄씩 정리하기', 'r', false, 0),
    (11, 6, '다음 주 계획 세우기', null, false, 0),
    (12, 7, '상세 화면 1장', 'm', false, 0)
  ) as t(n, d, text, c, done, minutes);

  -- 지운 카테고리 "디자인" 할 일(시간은 남는다, TD-3)
  insert into todos (user_id, date, text, category_id, done, minutes) values (uid, mon - 20, '로고 시안 그리기', g, true, 60);

  -- 회고 한 줄: 지난주 셋(마감 1단계에 모여 보임), 그 전 주 하나
  insert into days (user_id, date, note, reviewed_at) values
    (uid, mon - 7, '인터뷰가 생각보다 오래 걸렸다', now()),
    (uid, mon - 5, '조사만 하고 손은 못 댔다', now()),
    (uid, mon - 2, '오후 집중이 좋았다', now()),
    (uid, mon - 12, '피드백을 미뤘다', now());
end $$;

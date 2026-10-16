-- 테스트용 더미 데이터(phase4). schema.sql·phase2.sql·phase3.sql·phase4.sql 다음에, Supabase 대시보드 > SQL Editor에 붙여 넣고 실행.
-- 가장 최근에 로그인한 사용자의 핵심목표·카테고리·할 일·주 기록·주간 비율·비율 스냅샷·회고 한 줄을 모두 지우고 예시를 넣는다.
-- 다시 실행하면 처음 상태로 돌아간다(주간 마감 흐름을 여러 번 시험할 때).
--
-- 넣는 것 (날짜는 한국 시간 오늘 기준)
-- 핵심목표 "IT 회사 취업하기", 진입일 4주 전 월요일("지금까지"와 편향 보기 주 탭이 여기부터)
-- 카테고리(핵심목표 비율) CS공부 40 · 프로젝트 40 · 공고탐색 20
--   지운 카테고리 "자격증"(0%): 3주 전 할 일 1시간 → 라벨은 이름 그대로 회색, 편향 보기에서는 분모에만(어느 칸에도 안 보임)
-- 주간 목표 시간 10시간(4주 전부터). 주간 비율은 지난주에만 CS공부 50 · 프로젝트 40 · 공고탐색 10(다른 주는 핵심목표 비율)
-- 지난 4주: 같은 모양의 주 4번. 주마다 CS공부 7시간 30분 · 프로젝트 1시간 50분 · 공고탐색 40분 · 기타 50분 = 10시간 50분
--   → 지금까지(핵심목표 비율 기준) CS공부 더, 프로젝트 덜 → 메인에 할 일 입력 권유(프로젝트 · 배포 설정하기 20분)
--   지난주는 마감 전 → 앱을 열면 주간 마감 흐름이 뜬다. 기록 10시간 50분 ≥ 목표 10시간 → "했다"
--   지난주 주간 비율 기준: CS공부 +19 더, 프로젝트 -23 덜, 공고탐색 계획대로. 못 끝낸 일 3개
-- 이번 주: 오늘 이전엔 시간이 적혀 있고, 오늘 이후는 0분. 오늘은 회고 전(9시 이후 회고 안내 띠 시험)
-- 다음 주: 할 일 1개, 목표 없음
-- 진입 화면을 시험하려면 실행 뒤 profiles에서 그 사용자 행만 지우면 된다

do $$
declare
  uid uuid := (select id from auth.users order by last_sign_in_at desc nulls last limit 1);
  today date := (now() at time zone 'Asia/Seoul')::date;
  mon date := date_trunc('week', today)::date; -- 이번 주 월요일
  s uuid; -- CS공부
  p uuid; -- 프로젝트
  j uuid; -- 공고탐색
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

  insert into profiles (user_id, core_goal, started_on) values (uid, 'IT 회사 취업하기', mon - 28);
  insert into categories (user_id, name, ratio, position) values (uid, 'CS공부', 40, 0) returning id into s;
  insert into categories (user_id, name, ratio, position) values (uid, '프로젝트', 40, 1) returning id into p;
  insert into categories (user_id, name, ratio, position) values (uid, '공고탐색', 20, 2) returning id into j;
  insert into categories (user_id, name, ratio, position, deleted_at) values (uid, '자격증', 0, 3, now()) returning id into g;

  insert into week_ratios (user_id, week_start, category_id, ratio) values
    (uid, mon - 7, s, 50), (uid, mon - 7, p, 40), (uid, mon - 7, j, 10);

  insert into weeks (user_id, week_start, goal, good, bad, closed_at, target_minutes) values
    (uid, mon - 28, '자료구조 정리 끝내기', '스택·큐까지 정리했다', '코테 문제를 못 풀었다', now(), 600),
    (uid, mon - 21, '포트폴리오 프로젝트 주제 정하기', '주제를 드디어 정했다', '공부에만 시간을 썼다', now(), null),
    (uid, mon - 14, '로그인 기능 완성하기', '', '', now(), null),
    (uid, mon - 7, '프로젝트 핵심 기능 3개 완성하기', '', '', null, null), -- 마감 전
    (uid, mon, '게시판 기능 마무리하기', '', '', null, null);

  -- 지난 4주: 같은 모양의 주를 4번. w: 몇 주 전, d: 월요일에서 며칠 뒤, n: 목록 순서
  insert into todos (user_id, date, text, category_id, done, minutes, created_at)
  select uid, mon - 7 * w + d, text,
         case c when 's' then s when 'p' then p when 'j' then j end,
         done, minutes, now() - w * interval '1 day' + n * interval '1 ms'
  from generate_series(1, 4) as w,
  (values
    (1, 0, '운영체제 강의 1개 듣기', 's', true, 90),
    (2, 0, '알고리즘 문제 2개 풀기', 's', true, 60),
    (3, 1, '네트워크 정리 노트 쓰기', 's', true, 120),
    (4, 1, 'API 설계 초안 작성', 'p', true, 60),
    (5, 2, '데이터베이스 정규화 복습', 's', true, 90),
    (6, 2, '노트북 폴더 정리', null, true, 30),
    (7, 3, '로그인 화면 만들기', 'p', false, 30),
    (8, 3, '채용 공고 5개 훑어보기', 'j', true, 40),
    (9, 4, '코딩테스트 기출 풀기', 's', true, 90),
    (10, 4, '스터디 일정 잡기', null, true, 20),
    (11, 5, '배포 설정하기', 'p', false, 20),
    (12, 6, '관심 회사 공고 정리', 'j', false, 0)
  ) as t(n, d, text, c, done, minutes);

  -- 이번 주·다음 주: 오늘 이전만 체크·시간
  insert into todos (user_id, date, text, category_id, done, minutes, created_at)
  select uid, mon + d, text,
         case c when 's' then s when 'p' then p when 'j' then j end,
         done and mon + d < today, case when mon + d < today then minutes else 0 end,
         now() + n * interval '1 ms'
  from (values
    (1, 0, '프로젝트 README 쓰기', 'p', true, 60),
    (2, 0, '자료구조 복습', 's', true, 45),
    (3, 1, '게시글 목록 API 만들기', 'p', true, 90),
    (4, 1, '운영체제 강의 듣기', 's', true, 60),
    (5, 2, '게시글 작성 화면 만들기', 'p', false, 30),
    (6, 2, '스터디 장소 예약', null, true, 15),
    (7, 3, '공고별 자격 요건 비교', 'j', true, 40),
    (8, 3, '면접 단골 CS 질문 정리', 's', false, 30),
    (9, 4, '테스트 코드 붙이기', 'p', false, 30),
    (10, 4, '관심 회사 세 곳의 채용 공고를 모아 기술 스택과 우대 사항을 한 줄씩 정리하고 내 프로젝트와 겹치는 부분 표시하기', 'j', false, 0),
    (11, 6, '다음 주 계획 세우기', null, false, 0),
    (12, 7, '포트폴리오 페이지 만들기', 'p', false, 0)
  ) as t(n, d, text, c, done, minutes);

  -- 지운 카테고리 "자격증" 할 일(시간은 남는다, TD-3)
  insert into todos (user_id, date, text, category_id, done, minutes) values (uid, mon - 20, '정보처리기사 기출 풀기', g, true, 60);

  -- 회고 한 줄: 지난주 셋(마감 1단계에 모여 보임), 그 전 주 하나
  insert into days (user_id, date, note, reviewed_at) values
    (uid, mon - 7, '강의 듣다가 하루가 다 갔다', now()),
    (uid, mon - 5, '공부만 하고 코드는 못 짰다', now()),
    (uid, mon - 2, '오후 집중이 좋았다', now()),
    (uid, mon - 12, '공고 보는 걸 미뤘다', now());
end $$;

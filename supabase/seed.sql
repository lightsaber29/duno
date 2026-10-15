-- 테스트용 더미 데이터. Supabase 대시보드 > SQL Editor에 붙여 넣고 실행.
-- 가장 최근에 로그인한 사용자의 할 일·주 기록을 모두 지우고 지난주·이번 주·다음 주 예시를 넣는다.
-- 다시 실행하면 처음 상태로 돌아간다(마감 흐름을 여러 번 시험할 때).
--
-- 넣는 것 (날짜는 한국 시간 오늘 기준)
-- 지난주: 목표 있음, 할 일 10개 중 6개 완료(60%), 마감 전 → 앱을 열면 마감 흐름이 뜬다. 일요일은 비어 있음
-- 이번 주: 목표 있음, 요일마다 할 일(토요일은 비어 있음, 긴 글 하나). 오늘 이후 날짜는 모두 미완료
-- 다음 주: 목표 없음, 할 일 2개

do $$
declare
  uid uuid := (select id from auth.users order by last_sign_in_at desc nulls last limit 1);
  today date := (now() at time zone 'Asia/Seoul')::date;
  mon date := date_trunc('week', today)::date; -- 이번 주 월요일
begin
  if uid is null then
    raise exception '로그인한 사용자가 없어요. 앱에서 먼저 Google로 로그인하세요.';
  end if;

  delete from todos where user_id = uid;
  delete from weeks where user_id = uid;

  insert into weeks (user_id, week_start, goal) values
    (uid, mon - 7, '인터뷰 5명 진행하고 핵심 문제 3개 뽑기'),
    (uid, mon, '와이어프레임 핵심 화면 3장 완성하기');

  -- d: 이번 주 월요일에서 며칠 뒤, n: 목록 순서(created_at)
  insert into todos (user_id, date, text, done, created_at)
  select uid, mon + d, text, done and mon + d <= today, now() + n * interval '1 ms'
  from (values
    -- 지난주
    (1, -7, '인터뷰 질문 정리', true),
    (2, -7, '레퍼런스 3개 찾기', true),
    (3, -6, '인터뷰 1차 진행', true),
    (4, -6, '받은 피드백 정리', false),
    (5, -5, '인터뷰 2차 진행', true),
    (6, -5, '경쟁 서비스 화면 캡처', false),
    (7, -4, '인터뷰 3차 진행', true),
    (8, -3, '인터뷰 내용 정리', false),
    (9, -3, '오늘 한 일 3줄 회고', true),
    (10, -2, '핵심 문제 3개 뽑기', false),
    -- 이번 주
    (11, 0, '문제 정의 한 문장 쓰기', true),
    (12, 0, '와이어프레임 1장', true),
    (13, 1, '와이어프레임 2장', true),
    (14, 1, '케이스 스터디 목차', false),
    (15, 2, '와이어프레임 3장', false),
    (16, 2, '오늘 한 일 3줄 회고', true),
    (17, 3, '사용성 테스트 질문 정리', true),
    (18, 3, '와이어프레임 피드백 받기', false),
    (19, 3, '오늘 한 일 3줄 회고', false),
    (20, 4, '경쟁 서비스 세 곳의 온보딩 화면을 캡처하고 좋았던 점과 아쉬운 점을 한 줄씩 정리하기', false),
    (21, 4, '디자인 리뷰 준비', false),
    (22, 6, '다음 주 계획 세우기', false),
    -- 다음 주
    (23, 7, '상세 화면 1장', false),
    (24, 9, '사용성 테스트 1차', false)
  ) as t(n, d, text, done);
end $$;

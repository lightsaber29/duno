# duno
AI 네이티브 커리어 캠프 3차 프로젝트

핵심목표 피라미드 투두. 날짜별로 할 일을 적고 카테고리를 고른 뒤, 저녁마다 할 일에 쓴 시간을 적는다.
정한 비율(핵심목표 비율·주간 비율)과 실제 비율이 15%p 이상 벌어지면 편향 보기에서 보여 주고, 덜 쓴 카테고리의 할 일을 권한다.
주간 마감에서 지난주 기록 시간과 주간 목표 시간을 비교하고, 이번 주 목표·주간 비율·목표 시간·카테고리를 고친다.

- phase1(스케이트보드): `docs/스케이트보드 phase1.md`, 프로토타입 `docs/스케이트보드 phase1.html`, 개발 계획 `docs/스케이트보드 phase1 개발 계획.md`
- phase2(킥보드): `docs/킥보드 phase2.md`, 프로토타입 `docs/킥보드 phase2.html`, 개발 계획 `docs/킥보드 phase2 개발 계획.md`
- phase3(자전거): `docs/자전거 phase3.md`, 개발 계획 `docs/자전거 phase3 개발 계획.md`
- phase4(오토바이): `docs/오토바이 phase4.md`, 개발 계획 `docs/오토바이 phase4 개발 계획.md`

## 시작
1. Supabase 프로젝트를 만든다. SQL Editor에서 차례로 한 번씩 실행한다.
   - `supabase/schema.sql`: `todos`, `weeks`. 피벗 전 Duno 테이블이 있으면 지운다. 빈 DB에 한 번만.
   - `supabase/phase2.sql`: 핵심목표·카테고리·할 일 시간·회고 한 줄. 기존 데이터는 그대로 둔다. 한 번만.
   - `supabase/phase3.sql`: 주간 목표 시간·주간 비율·카테고리 지운 표시·할 일 입력 권유. 기존 데이터는 그대로 둔다. 한 번만.
   - `supabase/phase4.sql`: 진입일·비율 스냅샷·회고 저장 표시. 기존 데이터는 그대로 둔다. 한 번만.
2. Google 로그인 설정 (아래 절).
3. Authentication > URL Configuration의 Redirect URLs에 `http://localhost:5173/**`와 배포 주소 `/**`를 넣는다.
4. `.env.example`을 `.env`로 복사하고 URL과 publishable key(`sb_publishable_...`)를 넣는다. Legacy anon key는 쓰지 않는다.
5. `npm install && npm run dev`

`npm test`: 주 계산(`src/lib/week.ts`)과 피라미드·주간 마감·권유 계산(`src/lib/pyramid.ts`) 테스트

`supabase/seed.sql`: 테스트용 더미 데이터. 앱에서 한 번 로그인한 뒤 SQL Editor에서 실행한다. 가장 최근에 로그인한 사용자의 기록을 **모두 지우고**
핵심목표(진입일 4주 전)·카테고리 3개(+ 지운 카테고리 1개)·주간 목표 시간·지난주 주간 비율과 지난 4주·이번 주 예시를 넣는다.
지난주가 마감 전이라 앱을 열면 주간 마감 흐름이 뜨고, 메인에는 할 일 입력 권유가 뜬다. 다시 실행하면 처음 상태로.
진입 화면을 보려면 실행 뒤 `profiles`에서 그 사용자 행을 지운다.

## Google 로그인 설정
1. Supabase > Authentication > Providers > Google을 열고 "Callback URL"을 복사해 둔다.
2. Google Cloud Console > APIs & Services > OAuth consent screen. External, 앱 이름과 이메일만 넣고 저장. Publishing status를 "In production"으로 올린다(테스트 상태면 등록한 테스트 사용자만 로그인됨).
3. Credentials > Create Credentials > OAuth client ID > Web application.
   - Authorized JavaScript origins: `http://localhost:5173`, 배포 주소
   - Authorized redirect URIs: 1번에서 복사한 Callback URL
4. 생긴 Client ID와 Client Secret을 Supabase Google provider에 넣고 켠다.

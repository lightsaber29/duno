# duno
AI 네이티브 커리어 캠프 3차 프로젝트

날짜별 투두 앱. 핸드폰 한 화면에서 그 주(위)와 그날(아래)을 함께 보고, 주마다 목표 한 줄을 적고, 주가 끝나면 완료율이 남는다.
기획: `docs/스케이트보드 phase1.md`, 개발 계획: `docs/스케이트보드 phase1 개발 계획.md`

## 시작
1. Supabase 프로젝트를 만든다. SQL Editor에서 `supabase/schema.sql`을 실행한다. 피벗 전 Duno 테이블이 있으면 지우고 `todos`, `weeks`를 만든다. 빈 DB에 한 번만 실행한다.
2. Google 로그인 설정 (아래 절).
3. Authentication > URL Configuration의 Redirect URLs에 `http://localhost:5173/**`와 배포 주소 `/**`를 넣는다.
4. `.env.example`을 `.env`로 복사하고 URL과 publishable key(`sb_publishable_...`)를 넣는다. Legacy anon key는 쓰지 않는다.
5. `npm install && npm run dev`

`npm test`: 주 계산(`src/lib/week.ts`) 테스트
`supabase/seed.sql`: 테스트용 더미 데이터. 앱에서 한 번 로그인한 뒤 SQL Editor에서 실행. 가장 최근에 로그인한 사용자의 기록을 지우고 지난주·이번 주·다음 주 예시를 넣는다(다시 실행하면 처음 상태로).

## Google 로그인 설정
1. Supabase > Authentication > Providers > Google을 열고 "Callback URL"을 복사해 둔다.
2. Google Cloud Console > APIs & Services > OAuth consent screen. External, 앱 이름과 이메일만 넣고 저장. Publishing status를 "In production"으로 올린다(테스트 상태면 등록한 테스트 사용자만 로그인됨).
3. Credentials > Create Credentials > OAuth client ID > Web application.
   - Authorized JavaScript origins: `http://localhost:5173`, 배포 주소
   - Authorized redirect URIs: 1번에서 복사한 Callback URL
4. 생긴 Client ID와 Client Secret을 Supabase Google provider에 넣고 켠다.

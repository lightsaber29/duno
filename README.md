# duno
AI 네이티브 커리어 캠프 3차 프로젝트

## 시작
1. Supabase 프로젝트를 만든다. SQL Editor에서 `supabase/schema.sql`을 실행한다.
2. Authentication > Providers > Email에서 "Confirm email"은 끄고 매직 링크는 켠다.
3. Authentication > URL Configuration의 Site URL에 `http://localhost:5173`을 넣는다.
4. `.env.example`을 `.env`로 복사하고 URL과 publishable key(`sb_publishable_...`)를 넣는다. Legacy anon key는 쓰지 않는다.
5. `npm install && npm run dev`

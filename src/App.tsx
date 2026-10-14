import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'

export default function App() {
  const session = useSession()
  if (session === undefined) return null
  if (!session) return <Login />
  // ponytail: 화면 4개는 2~4단계에서. 지금은 로그인 확인용 자리.
  return (
    <main className="screen">
      <p>{session.user.email}로 로그인됨</p>
      <button onClick={() => supabase.auth.signOut()}>로그아웃</button>
    </main>
  )
}

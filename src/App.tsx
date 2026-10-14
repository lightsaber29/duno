import { useState } from 'react'
import { useSession } from './auth/useSession'
import { Login } from './auth/Login'
import { supabase } from './lib/supabase'
import { RatioEditor } from './components/RatioEditor'
import { COLORS } from './lib/colors'
import { equalSplit } from './lib/ratio'

// ponytail: 3단계 다이얼 확인용 임시 화면. 4단계에서 화면 4개로 바뀐다.
const NAMES = ['CS 공부', '포트폴리오', '코딩 테스트', '자격증', '면접 준비']

export default function App() {
  const session = useSession()
  const [ratios, setRatios] = useState(() => equalSplit(NAMES.length))
  if (session === undefined) return null
  if (!session) return <Login />
  const slices = NAMES.map((name, i) => ({ key: name, name, ratio: ratios[i], color: COLORS[i] }))
  return (
    <main className="screen">
      <RatioEditor slices={slices} onChange={setRatios} center="비율 정하기" />
      <p style={{ opacity: 0.6, fontSize: 13 }}>합계 {ratios.reduce((a, b) => a + b, 0)}%</p>
      <button onClick={() => supabase.auth.signOut()}>로그아웃</button>
    </main>
  )
}

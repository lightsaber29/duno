import { Dial } from '../components/Dial'
import { COLORS } from '../lib/colors'
import type { PlanData } from '../lib/db'

type Props = { data: PlanData; onEdit: () => void; onSignOut: () => void }

/** 계획 화면(6절). 보기만. 고치기는 목표 설정 화면을 값이 채워진 채 연다. */
export function Plan({ data, onEdit, onSignOut }: Props) {
  const active = data.subgoals.filter((s) => !s.removed_at)
  const slices = active.map((s, i) => ({ key: s.id, name: s.name, ratio: s.ratio, color: COLORS[i] }))
  return (
    <main className="screen">
      <h1>{data.plan.goal}</h1>
      <Dial slices={slices} selected={null} onSelect={() => {}} onDrag={() => {}} size={160} />
      <ul className="ratio-list">
        {slices.map((s) => (
          <li key={s.key}>
            <span className="dot" style={{ background: s.color }} />
            <span className="name">{s.name}</span>
            <span className="sub">{s.ratio}%</span>
          </li>
        ))}
      </ul>
      <p className="hint">알림 시간 {data.plan.notify_at}</p>
      <footer className="row">
        <button type="button" onClick={onSignOut}>로그아웃</button>
        <button type="button" className="primary" onClick={onEdit}>고치기</button>
      </footer>
    </main>
  )
}

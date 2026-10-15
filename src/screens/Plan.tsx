import { Dial } from '../components/Dial'
import { COLORS } from '../lib/colors'
import { fmtTime } from '../lib/format'
import type { PlanData } from '../lib/db'

type Props = { data: PlanData; onEdit: () => void; onSeed: () => void; onClearAll: () => void }

/** 계획 화면(6절). 보기만. 고치기는 목표 설정 화면을 값이 채워진 채 연다. */
export function Plan({ data, onEdit, onSeed, onClearAll }: Props) {
  const active = data.subgoals.filter((s) => !s.removed_at)
  const slices = active.map((s, i) => ({ key: s.id, name: s.name, ratio: s.ratio, color: COLORS[i] }))
  return (
    <main className="screen">
      <h1>내 계획</h1>
      <div className="stack" style={{ gap: 4 }}>
        <span className="label">핵심 목표</span>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>{data.plan.goal}</p>
      </div>
      <div className="plan-row">
        <Dial slices={slices} selected={null} onSelect={() => {}} onDrag={() => {}} size={160} />
        <ul className="list">
          {slices.map((s) => (
            <li key={s.key}>
              <span className="dot" style={{ background: s.color }} />
              <span className="name">{s.name}</span>
              <b style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{s.ratio}%</b>
            </li>
          ))}
        </ul>
      </div>
      <div className="notice card">
        <span>기록 알림</span>
        <span className="num">{fmtTime(data.plan.notify_at)}</span>
      </div>
      <footer className="row">
        <button type="button" className="primary" onClick={onEdit}>계획 다시 정하기</button>
      </footer>
      <details className="test-tools">
        <summary>테스트 도구</summary>
        <p className="hint">검증용. 실제 서비스에는 없는 기능(문서 10절).</p>
        <div className="row">
          <button type="button" onClick={onSeed}>예시 데이터 넣기</button>
          <button type="button" className="danger" onClick={onClearAll}>기록 전부 지우기</button>
        </div>
        <small>예시 데이터는 오늘 포함 아흐레치(하루 휴식). 같은 날짜가 있으면 덮어씁니다. 기록 {data.entries.length}일</small>
      </details>
    </main>
  )
}

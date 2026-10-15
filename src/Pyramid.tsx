import { useEffect, useState } from 'react'
import { loadGoals, loadTodos, type Setup, type Todo } from './lib/db'
import { fmtMinutes, level, TH, timeStats, verdict, type Row } from './lib/pyramid'
import { addDays, parseKey, today, weekStart } from './lib/week'

type Props = { setup: Setup; onClose: () => void; onSignOut: () => void; onError: (e: unknown) => void }

const md = (k: string) => {
  const d = parseKey(k)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 피라미드: 핵심목표 → 주간 목표 → 카테고리(정한 vs 실제) → 할 일. 기본은 이번 주 포함 최근 4주 합계, 주를 골라 볼 수 있다.
 * 문구·배치는 프로토타입(킥보드 phase2.html). 맨 아래 로그아웃(N4).
 */
export function Pyramid({ setup, onClose, onSignOut, onError }: Props) {
  const thisWeek = weekStart(today())
  const W4 = [-21, -14, -7, 0].map((n) => addDays(thisWeek, n))
  const [tab, setTab] = useState('all') // 'all' 또는 그 주 월요일
  const [data, setData] = useState<{ todos: Todo[]; goals: Record<string, string> } | null>(null)

  useEffect(() => {
    const ws = weekStart(today())
    const from = addDays(ws, -21)
    Promise.all([loadTodos(from, addDays(ws, 6)), loadGoals(from, ws)])
      .then(([todos, goals]) => setData({ todos, goals }))
      .catch(onError)
  }, [onError])

  const weeks = tab === 'all' ? W4 : [tab]
  const st = timeStats(setup.cats, (data?.todos ?? []).filter((x) => weeks.includes(weekStart(x.date))))

  return (
    <main className="flow pyramid">
      <div className="c-top">
        <button type="button" onClick={onClose}>‹ 돌아가기</button>
        <span>피라미드 · 기준 {TH}%</span>
      </div>
      <div className="py-tabs" role="group" aria-label="기간">
        {[['all', '최근 4주'] as const, ...W4.map((w) => [w, md(w) + (w === thisWeek ? ' 이번 주' : '')] as const)].map(([val, label]) => (
          <button key={val} type="button" aria-pressed={tab === val} onClick={() => setTab(val)}>
            {label}
          </button>
        ))}
      </div>

      <div className="py-lv">
        <small>핵심목표</small>
        <div className="py-blk l1">{setup.coreGoal}</div>
      </div>
      <div className="py-lv">
        <small>주간 목표</small>
        <div className="py-blk l2">
          {weeks.map((w) => (
            <div key={w}>
              <span>{data?.goals[w] || '목표 없음'}</span>
              <span>{md(w)} 주</span>
            </div>
          ))}
        </div>
      </div>
      {data && (
        <>
          <div className="py-lv">
            <small>카테고리 · 정한 비율 vs 실제 시간 (총 {fmtMinutes(st.total)})</small>
            <div className="py-cats">
              {st.rows.map((r) => (
                <Card key={r.id ?? 'etc'} r={r} />
              ))}
            </div>
          </div>
          <p className="py-verdict">
            <Verdict rows={st.rows} total={st.total} />
          </p>
        </>
      )}
      <button type="button" className="py-out" onClick={onSignOut}>로그아웃</button>
    </main>
  )
}

/** 판정 한 줄. 많음만/부족만/둘 다를 나눠 쓴다(프로토타입은 많음만 있으면 "…에 많이 썼고 "로 끝났다) */
export function Verdict({ rows, total }: { rows: Row<Todo>[]; total: number }) {
  const v = verdict(rows)
  if (!total) return <>아직 기록한 시간이 없어. 저녁 회고에서 적어 봐.</>
  if (!v.over.length && !v.under.length) return <>치우침 없이 정한 비율 가까이 쓰고 있어.</>
  return (
    <>
      {v.over.length > 0 && (
        <>
          <b className="v-o">{v.over.join('·')}</b>에 많이 {v.under.length ? '썼고 ' : '썼어.'}
        </>
      )}
      {v.under.length > 0 && (
        <>
          <b className="v-u">{v.under.join('·')}</b>에 덜 썼어.
        </>
      )}
    </>
  )
}

/** 카테고리 카드: 이름·시간, 정한/실제 막대, 치우침, 시간 많이 쓴 할 일 2개 */
function Card({ r }: { r: Row<Todo> }) {
  const lv = level(r.diff)
  return (
    <div className={'py-cat' + (lv === 'over' ? ' over' : lv === 'under' ? ' under' : '')}>
      <b>
        {r.name} <span>{fmtMinutes(r.minutes)}</span>
      </b>
      {r.ratio !== null && <Bar kind="pl" label="정한" pct={r.ratio} />}
      <Bar kind="ac" label="실제" pct={r.actual} />
      {r.ratio === null ? (
        <span className="df n">비율 없음</span>
      ) : lv === 'over' ? (
        <span className="df o">{r.diff}% 많음</span>
      ) : lv === 'under' ? (
        <span className="df u">{-r.diff!}% 부족</span>
      ) : lv === 'ok' ? (
        <span className="df n">괜찮음 ({r.diff! > 0 ? '+' : ''}{r.diff}%)</span>
      ) : null}
      <div className="tk">
        {r.todos.length ? r.todos.slice(0, 2).map((x) => <div key={x.id}>{x.text} {fmtMinutes(x.minutes)}</div>) : '기록 없음'}
        {r.todos.length > 2 && <div>외 {r.todos.length - 2}개</div>}
      </div>
    </div>
  )
}

function Bar({ kind, label, pct }: { kind: 'pl' | 'ac'; label: string; pct: number }) {
  return (
    <div className={'br ' + kind}>
      <span>{label}</span>
      <i>
        <em style={{ width: `${pct}%` }} />
      </i>
      {pct}%
    </div>
  )
}

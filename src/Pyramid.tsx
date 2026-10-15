import { useEffect, useState } from 'react'
import { loadGoals, loadTodos, loadWeekRatios, type Setup, type Todo } from './lib/db'
import { fmtMinutes, level, TH, timeStats, verdict, weekBasis, type Row, type WeekRatio } from './lib/pyramid'
import { addDays, parseKey, today, weekStart } from './lib/week'

type Props = { setup: Setup; onClose: () => void; onSignOut: () => void; onError: (e: unknown) => void }

const md = (k: string) => {
  const d = parseKey(k)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/**
 * 편향 보기(phase4 4.4): 핵심목표 → 주간 목표 → 카테고리(기준 비율 vs 실제) → 할 일. 배치는 프로토타입(킥보드 phase2.html)의 피라미드.
 * 기간(6절): 지금까지(진입일부터, BI-3)·최근 4주는 핵심목표 비율, 주별(진입한 주부터 이번 주까지)은 그 주의 주간 비율(없으면 핵심목표 비율, WG-5).
 * 지운 카테고리 시간은 분모에만(TD-4). 기록이 0이면 핵심목표 비율만(BI-6). 처음엔 지금까지. 맨 아래 로그아웃.
 */
export function Pyramid({ setup, onClose, onSignOut, onError }: Props) {
  const thisWeek = weekStart(today())
  const W4 = [-21, -14, -7, 0].map((n) => addDays(thisWeek, n))
  // 고를 수 있는 주: 진입한 주부터 이번 주까지(8절)
  const myWeeks: string[] = []
  for (let w = weekStart(setup.startedOn); w <= thisWeek; w = addDays(w, 7)) myWeeks.push(w)
  const gone = setup.gone.map((c) => c.id)
  const [tab, setTab] = useState('sofar') // 'sofar' 지금까지, 'w4' 최근 4주, 아니면 그 주 월요일
  const [data, setData] = useState<{ todos: Todo[]; goals: Record<string, string>; ratios: WeekRatio[] } | null>(null)

  useEffect(() => {
    const ws = weekStart(today())
    // 최근 4주와 진입한 주 중 이른 쪽부터 이번 주까지 (앞날짜 할 일은 시간이 0이라 계산에 안 들어간다)
    const from = [addDays(ws, -21), weekStart(setup.startedOn)].sort()[0]
    Promise.all([loadTodos(from, addDays(ws, 6)), loadGoals(from, ws), loadWeekRatios()])
      .then(([todos, goals, ratios]) => setData({ todos, goals, ratios }))
      .catch(onError)
  }, [onError, setup.startedOn])

  const weeks = tab === 'sofar' ? null : tab === 'w4' ? W4 : [tab]
  const oneWeek = weeks?.length === 1
  const basis = oneWeek && data ? weekBasis(setup.cats, data.ratios, tab) : setup.cats
  const st = timeStats(
    basis,
    (data?.todos ?? []).filter((x) => (weeks ? weeks.includes(weekStart(x.date)) : x.date >= setup.startedOn)),
    gone,
  )

  return (
    <main className="flow pyramid">
      <div className="c-top">
        <button type="button" onClick={onClose}>‹ 돌아가기</button>
        <span>편향 보기 · 기준 {TH}%</span>
      </div>
      <div className="py-tabs" role="group" aria-label="기간">
        {[['sofar', '지금까지'], ['w4', '최근 4주'], ...myWeeks.map((w) => [w, md(w) + (w === thisWeek ? ' 이번 주' : '')])].map(([val, label]) => (
          <button key={val} type="button" aria-pressed={tab === val} onClick={() => setTab(val)}>
            {label}
          </button>
        ))}
      </div>

      <div className="py-lv">
        <small>핵심목표</small>
        <div className="py-blk l1">{setup.coreGoal}</div>
      </div>
      {weeks && (
        // 지금까지는 주가 많아 길어지니 주간 목표 칸을 숨긴다
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
      )}
      {data && (
        <>
          <div className="py-lv">
            <small>
              카테고리 · {oneWeek ? '주간 비율' : '핵심목표 비율'} vs 실제 시간 (총 {fmtMinutes(st.total)})
            </small>
            <div className="py-cats">
              {st.rows.map((r) => (
                <Card key={r.id ?? 'etc'} r={r} recorded={st.total > 0} />
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
  if (!v.over.length && !v.under.length) return <>모두 계획대로 쓰고 있어.</>
  return (
    <>
      {v.over.length > 0 && (
        <>
          <b className="v-o">{v.over.join('·')}</b>에 계획보다 더 {v.under.length ? '썼고 ' : '썼어.'}
        </>
      )}
      {v.under.length > 0 && (
        <>
          <b className="v-u">{v.under.join('·')}</b>에 {v.over.length ? '' : '계획보다 '}덜 썼어.
        </>
      )}
    </>
  )
}

/** 카테고리 카드: 이름·시간, 정한/실제 막대, 더/덜/계획대로(phase3 BI-5), 시간 많이 쓴 할 일 2개 */
function Card({ r, recorded }: { r: Row<Todo>; recorded: boolean }) {
  const lv = level(r.diff)
  return (
    <div className={'py-cat' + (lv === 'over' ? ' over' : lv === 'under' ? ' under' : '')}>
      <b>
        {r.name} <span>{fmtMinutes(r.minutes)}</span>
      </b>
      {r.ratio !== null && <Bar kind="pl" label="정한" pct={r.ratio} />}
      {/* 기록이 0이면 실제 비율 대신 핵심목표 비율만(BI-6) */}
      {recorded && <Bar kind="ac" label="실제" pct={r.actual} />}
      {!recorded ? null : r.ratio === null ? (
        <span className="df n">비율 없음</span>
      ) : lv === 'over' ? (
        <span className="df o">{r.diff}% 더</span>
      ) : lv === 'under' ? (
        <span className="df u">{-r.diff!}% 덜</span>
      ) : lv === 'ok' ? (
        <span className="df n">계획대로 ({r.diff! > 0 ? '+' : ''}{r.diff}%)</span>
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

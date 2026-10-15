import { useState } from 'react'
import {
  addCategory,
  addTodo,
  closeWeek,
  deleteCategory,
  renameCategory,
  saveWeek,
  saveWeekRatios,
  setRatios,
  type Category,
  type Changes,
  type Setup,
  type Todo,
  type Week,
} from './lib/db'
import { coreAfter, fmtMinutes, level, timeStats, weekBasis, weekTarget, type WeekRatio } from './lib/pyramid'
import { equalSplit } from './lib/ratio'
import { addDays, parseKey, targetMinutes, weekDays, weekRange } from './lib/week'
import { Verdict } from './Pyramid'

type Props = {
  setup: Setup
  lw: string // 지난주 월요일
  week: Week | null
  todos: Todo[] // 지난주 할 일
  notes: Record<string, string> // 지난주 회고 한 줄
  thisGoal: string
  ratios: WeekRatio[] // 지금까지 정한 주간 비율 전부
  targets: { week_start: string; target_minutes: number | null }[]
  onDone: (s: Setup, skipped: boolean) => void // 카테고리·비율이 바뀌었을 수 있다
  onError: (e: unknown) => void
}

const WD = ['일', '월', '화', '수', '목', '금', '토']
const dl = (k: string) => {
  const d = parseKey(k)
  return `${d.getMonth() + 1}/${d.getDate()} (${WD[d.getDay()]})`
}
/** 2단계에서 고치는 카테고리: 기존(id 있음)·새것. 지우면 gone */
type Edit = { key: string; id?: string; name: string; gone: boolean }

/**
 * 주간 마감 3단계(phase3 4.8): 돌아보기 → 지난주 정리(기록 시간 vs 주간 목표 시간, 주간 비율 기준 편향, 카테고리 추가·이름 바꾸기·지우기)
 * → 이번 주 계획(주간 목표, 주간 비율, 주간 목표 시간, 못 끝낸 일 복사). 핵심목표 비율은 직접 고치지 않는다(WC-10, D6).
 */
export function Close({ setup, lw, week, todos, notes, thisGoal, ratios, targets, onDone, onError }: Props) {
  const { cats } = setup
  const tw = addDays(lw, 7)
  const undone = todos.filter((t) => !t.done)
  const lastStats = timeStats(weekBasis(cats, ratios, lw), todos) // 지난주는 그 주의 주간 비율 기준(WC-5)
  const lastTarget = weekTarget(targets, lw)
  const nowTarget = weekTarget(targets, tw)

  const [step, setStep] = useState(1)
  const [good, setGood] = useState(week?.good ?? '')
  const [bad, setBad] = useState(week?.bad ?? '')
  const [edits, setEdits] = useState<Edit[]>(() => cats.map((c) => ({ key: c.id, id: c.id, name: c.name, gone: false })))
  const [added, setAdded] = useState(0) // 새 카테고리 key용
  const [goal, setGoal] = useState(thisGoal)
  const [weekly, setWeekly] = useState<Record<string, number>>({})
  const [hours, setHours] = useState(String((nowTarget ?? 1200) / 60))
  const [pick, setPick] = useState(() => new Set(undone.map((t) => t.id))) // 가져올 일, 처음엔 모두 체크
  const [busy, setBusy] = useState(false)

  const live = edits.filter((e) => !e.gone)
  const fresh = live.filter((e) => !e.id)
  const keep = live.filter((e) => e.id).map((e) => e.id!)
  const core = coreAfter(
    cats.map((c) => c.ratio),
    cats.map((c) => edits.find((e) => e.id === c.id)!.gone),
    fresh.length,
  ) // 남긴 것 → 새 것 순서
  const coreChanged = cats.some((c, i) => keep.indexOf(c.id) >= 0 && core[keep.indexOf(c.id)] !== cats[i].ratio)
  const namesOk = live.length > 0 && live.every((e) => e.name.trim())
  const weeklyTotal = live.reduce((a, e) => a + (weekly[e.key] ?? 0), 0)
  const minutes = targetMinutes(hours)
  const set = (key: string, patch: Partial<Edit>) => setEdits((es) => es.map((e) => (e.key === key ? { ...e, ...patch } : e)))
  const toggle = (s: Set<string>, id: string, on: boolean) => {
    const n = new Set(s)
    if (on) n.add(id)
    else n.delete(id)
    return n
  }

  /** 3단계로: 주간 비율 기본값 = 카테고리를 바꾼 뒤의 핵심목표 비율(수정하지 않은 주는 핵심목표 비율, phase4 WG-5). 카테고리를 바꿨으면 다시 계산 */
  function toPlan() {
    const keys = [...keep, ...fresh.map((e) => e.key)]
    if (keys.some((k) => !(k in weekly)) || Object.keys(weekly).length !== keys.length) {
      setWeekly(Object.fromEntries(keys.map((k, i) => [k, core[i]])))
    }
    setStep(3)
  }

  /** 건너뛰기는 마감 표시만. 그 밖에는 카테고리 → 핵심목표 비율 → 주간 비율 → 이번 주 목표·목표 시간 → 복사 → 마감 표시·바꾼 것 */
  async function finish(skip: boolean) {
    setBusy(true)
    try {
      let next = setup
      if (!skip) {
        // ponytail: 요청이 여러 번이라 한 묶음이 아니다. 마감 표시 전에 끊기면 다음에 열 때 다시 뜨고, 새 카테고리·복사가 겹칠 수 있음. 문제 되면 DB 함수(rpc) 하나로
        for (const e of edits) {
          const c = cats.find((x) => x.id === e.id)
          if (c && e.gone) await deleteCategory(c.id)
          else if (c && e.name.trim() !== c.name) await renameCategory(c.id, e.name.trim())
        }
        const made: Category[] = []
        for (const [i, e] of fresh.entries()) made.push(await addCategory(e.name.trim(), 0, cats.length + setup.gone.length + i))
        const liveCats: Category[] = [
          ...keep.map((id, i) => ({ id, name: edits.find((e) => e.id === id)!.name.trim(), ratio: core[i] })),
          ...made.map((c, i) => ({ ...c, ratio: core[keep.length + i] })),
        ]
        if (coreChanged) await setRatios(liveCats.slice(0, keep.length).filter((c) => c.ratio !== cats.find((x) => x.id === c.id)!.ratio))
        const keyToId = (k: string) => made[fresh.findIndex((e) => e.key === k)]?.id ?? k
        await saveWeekRatios(tw, live.map((e) => ({ category_id: keyToId(e.key), ratio: weekly[e.key] ?? 0 })))
        await saveWeek(tw, { goal: goal.trim(), target_minutes: minutes })
        // 옮기지 않고 복사: 지난주 기록이 바뀌지 않게. 지운 카테고리 일은 기타로. 순서 유지를 위해 하나씩
        const goneIds = new Set(edits.filter((e) => e.gone && e.id).map((e) => e.id))
        for (const t of undone) if (pick.has(t.id)) await addTodo(tw, t.text, t.category_id && goneIds.has(t.category_id) ? null : t.category_id)
        const before = core // 주간 비율 기본값
        const changes: Changes = {
          goal: goal.trim() !== thisGoal,
          ratio: live.some((e, i) => (weekly[e.key] ?? 0) !== before[i]),
          target: minutes !== nowTarget,
          added: fresh.length,
          renamed: edits.filter((e) => e.id && !e.gone && e.name.trim() !== cats.find((c) => c.id === e.id)!.name).length,
          deleted: goneIds.size,
        }
        await closeWeek(lw, { good: good.trim(), bad: bad.trim(), changes })
        next = { ...setup, cats: liveCats, gone: [...setup.gone, ...cats.filter((c) => goneIds.has(c.id))] }
      } else await closeWeek(lw)
      onDone(next, skip)
    } catch (e) {
      onError(e)
      setBusy(false)
    }
  }

  if (step === 1) {
    const days = weekDays(lw).filter((k) => notes[k])
    return (
      <main className="flow">
        <div className="c-top">
          <span>주간 마감 1 / 3 · {weekRange(lw)}</span>
          <button type="button" disabled={busy} onClick={() => finish(true)}>건너뛰기</button>
        </div>
        <h1 className="f-h">{week?.goal || '지난주 목표 없음'}</h1>
        <div className="c-sub">지난주 회고 한 줄</div>
        <div className="refl">
          {days.length ? (
            days.map((k) => (
              <span key={k}>
                <b>{dl(k)}</b> {notes[k]}
              </span>
            ))
          ) : (
            <span>적은 회고가 없어.</span>
          )}
        </div>
        <label className="c-f">
          <span>잘된 점 한 줄 <em>(선택)</em></span>
          <input type="text" maxLength={40} value={good} placeholder="초안을 드디어 썼다" onChange={(e) => setGood(e.target.value)} />
        </label>
        <label className="c-f">
          <span>아쉬운 점 한 줄 <em>(선택)</em></span>
          <input type="text" maxLength={40} value={bad} placeholder="조사에만 시간을 썼다" onChange={(e) => setBad(e.target.value)} />
        </label>
        <button type="button" className="c-main" onClick={() => setStep(2)}>다음</button>
      </main>
    )
  }

  if (step === 2)
    return (
      <main className="flow">
        <div className="c-top">
          <button type="button" onClick={() => setStep(1)}>‹ 이전</button>
          <span>주간 마감 2 / 3</span>
        </div>
        <h1 className="f-h">지난주 정리</h1>
        <div className="wk-sum">
          <span>
            기록 <b>{fmtMinutes(lastStats.total)}</b> · 목표 {lastTarget === null ? '없음' : fmtMinutes(lastTarget)}
          </span>
          {lastTarget !== null && lastStats.total >= lastTarget && <span className="done-badge">했다</span>}
        </div>
        <div className="c-sub">지난주 주간 비율 vs 실제</div>
        <div className="ratio-list">
          {lastStats.rows.map((r) => {
            const lv = level(r.diff)
            return (
              <div key={r.id ?? 'etc'} className="wrow">
                <span>{r.name}</span>
                <span>
                  {r.ratio === null ? '' : `${r.ratio}% → `}
                  {r.actual}%{' '}
                  <em className={lv === 'over' ? 'v-o' : lv === 'under' ? 'v-u' : ''}>
                    {r.ratio === null ? '' : lv === 'over' ? `${r.diff}% 더` : lv === 'under' ? `${-r.diff!}% 덜` : lv === 'ok' ? '계획대로' : ''}
                  </em>
                </span>
              </div>
            )
          })}
        </div>
        <p className="c-note">
          <Verdict rows={lastStats.rows} total={lastStats.total} />
        </p>

        <div className="c-sub">카테고리</div>
        {live.map((e, i) => (
          <div key={e.key} className="ob-row">
            <input type="text" maxLength={8} value={e.name} placeholder="카테고리 이름" aria-label={`카테고리 ${i + 1} 이름`} onChange={(ev) => set(e.key, { name: ev.target.value })} />
            <button
              type="button"
              className="x"
              aria-label={`${e.name || '카테고리'} 지우기`}
              disabled={live.length <= 1}
              onClick={() => (e.id ? set(e.key, { gone: true }) : setEdits((es) => es.filter((x) => x.key !== e.key)))}
            >
              ×
            </button>
          </div>
        ))}
        <div className="ob-btns">
          <button
            type="button"
            disabled={live.length >= 5}
            onClick={() => {
              setEdits((es) => [...es, { key: `new${added}`, name: '', gone: false }])
              setAdded((n) => n + 1)
            }}
          >
            + 카테고리 추가
          </button>
        </div>
        {edits.some((e) => e.gone) && (
          <p className="c-note">
            지울 카테고리: {edits.filter((e) => e.gone).map((e) => cats.find((c) => c.id === e.id)!.name).join(', ')} (기록한 시간은 그대로 남아){' '}
            <button type="button" className="link" onClick={() => setEdits((es) => es.map((e) => ({ ...e, gone: false })))}>되돌리기</button>
          </p>
        )}
        {(coreChanged || fresh.length > 0) && (
          <p className="c-note">
            핵심목표 비율이 이렇게 바뀌어:{' '}
            {live
              .map((e, i) => {
                const before = cats.find((c) => c.id === e.id)?.ratio
                return `${e.name.trim() || '새 카테고리'} ${before === undefined ? '' : `${before}% → `}${core[i]}%`
              })
              .join(', ')}
          </p>
        )}
        <button type="button" className="c-main" disabled={!namesOk} onClick={toPlan}>다음</button>
      </main>
    )

  return (
    <main className="flow">
      <div className="c-top">
        <button type="button" onClick={() => setStep(2)}>‹ 이전</button>
        <span>주간 마감 3 / 3 · {weekRange(tw).split(' – ')[0]} 시작</span>
      </div>
      {bad.trim() && <div className="c-prev">지난주 아쉬운 점: {bad.trim()}</div>}
      <label className="c-f">
        <span className="f-h">이번 주 목표 한 줄</span>
        <input type="text" className="f-big" maxLength={40} value={goal} placeholder="와이어프레임 3장 완성하기" onChange={(e) => setGoal(e.target.value)} />
      </label>

      <div className="c-sub">이번 주 비율</div>
      {live.map((e) => (
        <div key={e.key} className="ob-row">
          <span className="ob-name">{e.name.trim()}</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={weekly[e.key] ?? 0}
            aria-label={`${e.name.trim()} 이번 주 비율`}
            onChange={(ev) => setWeekly((w) => ({ ...w, [e.key]: Math.max(0, Math.min(100, Math.floor(+ev.target.value || 0))) }))}
          />
          %
        </div>
      ))}
      <div className="ob-btns">
        <button type="button" onClick={() => setWeekly(Object.fromEntries(live.map((e, i) => [e.key, equalSplit(live.length)[i]])))}>똑같이 나누기</button>
      </div>
      <p className={'ob-sum' + (weeklyTotal === 100 ? '' : ' bad')} aria-live="polite">
        합계 {weeklyTotal}%{weeklyTotal === 100 ? '' : ' · 100%로 맞춰 줘'}
      </p>

      <label className="c-f">
        <span>주간 목표 시간</span>
        <span className="ob-row">
          <input type="number" inputMode="decimal" min={1} max={100} step={0.5} value={hours} aria-label="주간 목표 시간" onChange={(e) => setHours(e.target.value)} />
          시간
        </span>
      </label>
      {minutes === null && <p className="ob-sum bad">1시간부터 100시간까지, 0.5시간 단위로 적어 줘</p>}

      <div className="c-sub">지난주 못 끝낸 일</div>
      {undone.length ? (
        undone.map((t) => (
          <label key={t.id} className="c-chk">
            <input type="checkbox" checked={pick.has(t.id)} onChange={(e) => setPick((s) => toggle(s, t.id, e.target.checked))} />
            {t.text}
          </label>
        ))
      ) : (
        <p className="c-note">모두 끝냈어.</p>
      )}
      <p className="c-note">체크한 일만 이번 주 월요일 목록에 추가할게. 지난주 기록은 그대로야.</p>
      <button type="button" className="c-main primary" disabled={busy || weeklyTotal !== 100 || minutes === null} onClick={() => finish(false)}>
        이번 주 시작
      </button>
    </main>
  )
}

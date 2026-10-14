import { useRef, type PointerEvent } from 'react'
import { dragBoundary } from '../lib/ratio'

export type Slice = { key: string; name: string; ratio: number; color: string }

type Props = {
  slices: Slice[]
  selected: string | null
  onSelect: (key: string | null) => void
  /** 끌기로 비율이 바뀔 때. 끌기 시작 시점의 비율 기준으로 계산한 새 비율 */
  onDrag: (ratios: number[]) => void
  /** 가운데 글. 안 골랐을 때 */
  center?: string
  /** 고른 조각의 가운데 둘째 줄(예: "약 54분"). 없으면 % */
  centerSub?: (s: Slice) => string
  size?: number
}

const R = 100 // viewBox 반지름
const HANDLE_R = 22 // 누름 범위 44px(확인할 것)
const HOLE = 0.63 // 도넛 구멍. 시안 88/140
const POP = 5 // 고른 조각을 바깥으로 밀어내는 거리

/** 12시 시작, 시계 방향. t는 0~1 */
function polar(t: number, r = R) {
  const a = (t - 0.25) * 2 * Math.PI
  return [r * Math.cos(a), r * Math.sin(a)] as const
}

function arcPath(from: number, to: number) {
  if (to - from >= 1) return `M0 ${-R} A${R} ${R} 0 1 1 -0.01 ${-R} Z`
  const [x1, y1] = polar(from)
  const [x2, y2] = polar(to)
  return `M0 0 L${x1} ${y1} A${R} ${R} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`
}

/**
 * 원형 다이얼(7-1). 조각을 누르면 골라지고 고른 조각의 끝 경계에 손잡이가 생긴다(마지막 조각은 시작 경계).
 * 손잡이를 끌면 경계 양쪽 두 조각만 바뀐다.
 */
export function Dial({ slices, selected, onSelect, onDrag, center, centerSub, size = 320 }: Props) {
  const svg = useRef<SVGSVGElement>(null)
  const drag = useRef<{ ratios: number[]; angle: number } | null>(null)

  const n = slices.length
  const starts: number[] = [] // 조각 시작 위치(%)
  slices.forEach((_, i) => starts.push(i ? starts[i - 1] + slices[i - 1].ratio : 0))
  const selIdx = selected === null ? -1 : slices.findIndex((s) => s.key === selected)
  const sel = selIdx >= 0 ? slices[selIdx] : null
  const isLast = selIdx === n - 1
  const handleAt = selIdx < 0 ? null : isLast ? 0 : (starts[selIdx] + slices[selIdx].ratio) / 100

  function angleOf(e: PointerEvent) {
    const box = svg.current!.getBoundingClientRect()
    const x = e.clientX - box.left - box.width / 2
    const y = e.clientY - box.top - box.height / 2
    const t = Math.atan2(y, x) / (2 * Math.PI) + 0.25
    return ((t % 1) + 1) % 1
  }

  function down(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { ratios: slices.map((s) => s.ratio), angle: angleOf(e) }
  }
  function move(e: PointerEvent) {
    if (!drag.current) return
    let d = angleOf(e) - drag.current.angle
    if (d > 0.5) d -= 1
    if (d < -0.5) d += 1
    // 손잡이가 시계 방향으로 가면 고른 조각이 는다. 마지막 조각은 손잡이가 시작 경계라 반대.
    onDrag(dragBoundary(drag.current.ratios, selIdx, (isLast ? -d : d) * 100))
  }
  function up() {
    drag.current = null
  }

  const [hx, hy] = handleAt === null ? [0, 0] : polar(handleAt)
  const pad = R + HANDLE_R

  return (
    <svg
      ref={svg}
      viewBox={`${-pad} ${-pad} ${2 * pad} ${2 * pad}`}
      width={size}
      height={size}
      style={{ touchAction: 'none', display: 'block', margin: '0 auto', userSelect: 'none' }}
    >
      {slices.map((s, i) => {
        const on = selected === s.key
        const [px, py] = on ? polar((starts[i] + s.ratio / 2) / 100, POP) : [0, 0]
        return (
          <path
            key={s.key}
            d={arcPath(starts[i] / 100, (starts[i] + s.ratio) / 100)}
            fill={s.color}
            stroke="var(--bg)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            transform={`translate(${px} ${py})`}
            style={{ cursor: 'pointer', filter: on ? `drop-shadow(0 0 7px ${s.color})` : undefined }}
            onClick={() => onSelect(on ? null : s.key)}
          />
        )
      })}
      <circle r={R * HOLE} fill="var(--bg)" />
      <text textAnchor="middle" y={sel ? -14 : 5} fontSize={14} fontWeight={500} fill="currentColor">
        {sel ? sel.name : center}
      </text>
      {sel && (
        <CenterNum text={centerSub ? centerSub(sel) : `${sel.ratio}%`} />
      )}
      {handleAt !== null && n > 1 && (
        <g
          transform={`translate(${hx} ${hy})`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          style={{ cursor: 'grab' }}
        >
          <circle r={HANDLE_R} fill="transparent" />
          <circle r={9} fill="#fff" stroke="var(--fg)" strokeWidth={2} />
        </g>
      )}
    </svg>
  )
}

/** 가운데 큰 숫자. "25%"는 크게, "1시간 48분"처럼 길면 작게 */
function CenterNum({ text }: { text: string }) {
  const long = text.length > 4
  return (
    <text textAnchor="middle" y={long ? 10 : 16} fontSize={long ? 17 : 28} fontWeight={800} fontFamily="var(--font-num)" fill="currentColor">
      {text}
    </text>
  )
}

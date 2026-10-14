/** 분 → "1시간 30분", "30분", "2시간" */
export function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60)
  const r = Math.round(m % 60)
  if (h === 0) return `${r}분`
  if (r === 0) return `${h}시간`
  return `${h}시간 ${r}분`
}

/** 브라우저 지역 시각 기준 YYYY-MM-DD. offsetDays로 어제(-1) 등 */
export function localDate(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** "+30%", "−20%", "0%" */
export function fmtDiff(d: number): string {
  if (d > 0) return `+${d}%`
  if (d < 0) return `−${-d}%`
  return '0%'
}

/** "2026-10-14" → "10월 14일 수요일" */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
}

/** "21:00" → "오후 9:00" */
export function fmtTime(hm: string): string {
  const [h, m] = hm.split(':').map(Number)
  return new Date(0, 0, 0, h, m).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
}

import { useEffect, useRef } from 'react'

// 화면 전환이 state뿐이라 브라우저 뒤로 가기가 앱을 나갔다(피드백 F2). 라우터 없이 history에 칸만 쌓는다.
// 겹쳐 열린 화면(마감 2단계 위 3단계)을 구분하려고 칸마다 깊이를 둔다.
let depth = 0

/**
 * open이 true가 되면 history에 한 칸 쌓고, 뒤로 가기로 그 칸을 벗어나면 close를 부른다.
 * 앱 버튼으로 닫으면(open이 false로) 쌓은 칸을 대신 지운다.
 */
export function useBack(open: boolean, close: () => void) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })
  useEffect(() => {
    if (!open) return
    const mine = ++depth
    history.pushState({ duno: mine }, '')
    const onPop = () => {
      const d = (history.state?.duno as number | undefined) ?? 0
      if (d >= mine) return
      depth = d
      closeRef.current()
    }
    addEventListener('popstate', onPop)
    return () => {
      removeEventListener('popstate', onPop)
      if (depth >= mine) {
        history.go(mine - 1 - depth)
        depth = mine - 1
      }
    }
  }, [open])
}

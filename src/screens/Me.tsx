type Props = { email: string; onSignOut: () => void }

/** 내 정보 화면. 계정과 로그아웃만. */
export function Me({ email, onSignOut }: Props) {
  return (
    <main className="screen">
      <h1>내 정보</h1>
      <div className="notice card">
        <span>계정</span>
        <small>{email}</small>
      </div>
      <footer className="row">
        <button type="button" onClick={onSignOut}>로그아웃</button>
      </footer>
    </main>
  )
}

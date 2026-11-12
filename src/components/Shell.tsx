import { useState, type MouseEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase, useAccount } from '../lib/supabase'
import { calm } from '../lib/motion'
import { isMuted, play, setMuted } from '../lib/sound'

export function Shell({ children }: { children: ReactNode }) {
  const { user, name, loading } = useAccount()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')

  const [muted, setMutedState] = useState(isMuted)
  const [motion, setMotion] = useState(() => document.documentElement.dataset.motion ?? 'full')

  function switchTheme(e: MouseEvent) {
    const next = theme === 'dark' ? 'light' : 'dark'
    const apply = () => {
      document.documentElement.dataset.theme = next
      try { localStorage.setItem('qm:theme', next) } catch { /* theme lasts for this visit only */ }
      setTheme(next)
    }
    if (calm() || !document.startViewTransition) return apply()
    // The new theme spreads out in a circle from the button.
    const x = e.clientX, y = e.clientY
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    document.startViewTransition(apply).ready.then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      ))
  }
  function switchSound() {
    setMuted(!muted)
    setMutedState(!muted)
    if (muted) play('on')
  }
  function switchMotion() {
    const next = motion === 'calm' ? 'full' : 'calm'
    document.documentElement.dataset.motion = next
    try { localStorage.setItem('qm:motion', next) } catch { /* choice lasts for this visit only */ }
    setMotion(next)
  }

  // Log in and sign up are one task per screen: no site chrome around them.
  if (pathname === '/login' || pathname === '/signup') return <div key={pathname} className="route">{children}</div>

  return (
    <>
      <button type="button" className="skip" onClick={() => document.getElementById('main')?.focus()}>Skip to content</button>
      <header className="top">
        <div className="top-in">
          <Link to="/" className="wordmark">Quiet Move</Link>
          <nav aria-label="Main" className="tabs">
            <NavLink to="/" end className="nav-link">Play</NavLink>
            <NavLink to="/train" className="nav-link">Train</NavLink>
            <NavLink to="/stats" className="nav-link">Stats</NavLink>
          </nav>
          <nav aria-label="Account" className="account">
            {!loading && user && (
              <>
                <span className="who">{name}</span>
                <button type="button" className="nav-link" onClick={() => { navigate('/'); supabase.auth.signOut() }}>Log out</button>
              </>
            )}
            {!loading && !user && (
              <>
                <Link to="/login" className="nav-link">Log in</Link>
                <Link to="/signup" className="btn primary">Create account</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <div key={pathname} className="route">{children}</div>
      <footer className="foot">
        <div className="foot-in">
          <p>
            Chess pieces by <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces/Standard">Cburnett and Rfc1394</a>, CC BY-SA 3.0.
            Bots run <a href="https://github.com/nmrugg/stockfish.js">Stockfish.js</a>, GPL-3.0.
          </p>
          <div className="row">
            <button type="button" className="btn quiet" onClick={switchSound}>{muted ? 'Turn sounds on' : 'Mute sounds'}</button>
            <button type="button" className="btn quiet" onClick={switchMotion}>{motion === 'calm' ? 'Turn full motion on' : 'Reduce motion'}</button>
            <button type="button" className="btn quiet" onClick={switchTheme}>Switch to {theme === 'dark' ? 'light' : 'dark'} theme</button>
          </div>
        </div>
      </footer>
    </>
  )
}

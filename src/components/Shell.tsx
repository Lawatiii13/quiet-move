import { useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { supabase, useAccount } from '../lib/supabase'

export function Shell({ children }: { children: ReactNode }) {
  const { user, name, loading } = useAccount()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'light')

  function switchTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('qm:theme', next) } catch { /* theme lasts for this visit only */ }
    setTheme(next)
  }

  // Log in and sign up are one task per screen: no site chrome around them.
  if (pathname === '/login' || pathname === '/signup') return <div key={pathname} className="route">{children}</div>

  return (
    <>
      <button type="button" className="skip" onClick={() => document.getElementById('main')?.focus()}>Skip to content</button>
      <header className="top">
        <div className="top-in">
          <Link to="/" className="wordmark">Quiet Move</Link>
          <nav aria-label="Main">
            {!loading && user && (
              <>
                <NavLink to="/stats" className="nav-link">Stats</NavLink>
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
          <button type="button" className="btn quiet" onClick={switchTheme}>
            Switch to {theme === 'dark' ? 'light' : 'dark'} theme
          </button>
        </div>
      </footer>
    </>
  )
}

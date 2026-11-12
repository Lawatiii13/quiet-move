import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Link, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import '@fontsource/libre-caslon-text/400.css'
import '@fontsource-variable/source-sans-3'
import './styles.css'
import { SessionContext, supabase } from './lib/supabase'
import { play } from './lib/sound'
import { Shell } from './components/Shell'
import { useTitle } from './components/GameLayout'
import Home from './pages/Home'
import BotGame from './pages/BotGame'
import QuickMatch from './pages/QuickMatch'
import NetGame, { NewDuel } from './pages/NetGame'
import Auth from './pages/Auth'
import Stats from './pages/Stats'

function NotFound() {
  useTitle('Page not found')
  return (
    <main id="main" tabIndex={-1} className="page prose">
      <h1>This page does not exist</h1>
      <p>The address may be mistyped, or the page was moved.</p>
      <Link className="btn primary" to="/">Go to the lobby</Link>
    </main>
  )
}

function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])
  return (
    <SessionContext.Provider value={session}>
      {/* shortcut: hash URLs work on any static host with no rewrite rules; switch to BrowserRouter once the host is chosen and can serve index.html for every path. */}
      <HashRouter>
        <Shell>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play/bot" element={<BotGame />} />
            <Route path="/play/quick" element={<QuickMatch />} />
            <Route path="/duel/new" element={<NewDuel />} />
            <Route path="/game/:id" element={<NetGame />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Shell>
      </HashRouter>
    </SessionContext.Provider>
  )
}

// One listener gives every link and button a click sound. Board squares have their own sounds.
document.addEventListener('click', e => {
  if ((e.target as Element).closest?.('a, button:not(.sq), label.choice')) play('click')
}, true)

createRoot(document.getElementById('root')!).render(<App />)

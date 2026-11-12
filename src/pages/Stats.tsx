import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ErrorNote, useTitle } from '../components/GameLayout'
import { outcome, type GameRow } from '../lib/game'
import { supabase, useAccount } from '../lib/supabase'

type Row = GameRow & { w: { username: string } | null; b: { username: string } | null }
const WORD = { win: 'Win', loss: 'Loss', draw: 'Draw' }

export default function Stats() {
  useTitle('Your stats')
  const { user, name, loading } = useAccount()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!user) return
    let live = true
    setFailed(false)
    // shortcut: totals are counted in the browser from the latest 1000 games; move the count into a SQL view when someone gets near that.
    supabase
      .from('games')
      .select('*, w:profiles!games_white_fkey(username), b:profiles!games_black_fkey(username)')
      .or(`white.eq.${user.id},black.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (!live) return
        if (error) setFailed(true)
        // A quick-match row whose second player never arrived is not a game.
        else setRows((data as Row[]).filter(g => g.kind === 'bot' || (g.white && g.black)))
      })
    return () => { live = false }
  }, [user, attempt])

  if (!loading && !user) return <Navigate to="/login?next=/stats" replace />

  const me = user?.id ?? ''
  const count = { win: 0, loss: 0, draw: 0 }
  for (const g of rows ?? []) {
    const o = outcome(g, me)
    if (o) count[o]++
  }
  const tiles: [string, number][] = [
    ['Games', count.win + count.loss + count.draw],
    ['Wins', count.win],
    ['Draws', count.draw],
    ['Losses', count.loss],
  ]
  const pending = !rows && !failed

  return (
    <main id="main" tabIndex={-1} className="page stats">
      <h1>Your stats</h1>
      <p className="lede">Finished games for {name ?? 'your account'}: bot games, quick matches against other accounts, and duels.</p>

      {failed ? (
        <ErrorNote
          detail="stats query failed"
          action={<button type="button" className="btn primary" onClick={() => setAttempt(a => a + 1)}>Load stats again</button>}
        >
          Your stats could not be loaded, so nothing is shown here. Your games are safe: check your connection and load them again.
        </ErrorNote>
      ) : (
        <>
          <dl className="tiles" aria-busy={pending}>
            {tiles.map(([label, value]) => (
              <div key={label} className="tile">
                <dt>{label}</dt>
                <dd>{pending ? <span className="skel" /> : value}</dd>
              </div>
            ))}
          </dl>

          <h2 id="recent">Recent games</h2>
          <div className="table-wrap">
            <table aria-labelledby="recent" aria-busy={pending}>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">You played</th>
                  <th scope="col">Result</th>
                </tr>
              </thead>
              <tbody>
                {pending && [0, 1, 2].map(i => (
                  <tr key={i}>{[0, 1, 2, 3].map(j => <td key={j}><span className="skel" /></td>)}</tr>
                ))}
                {rows?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty">
                      <strong>No finished games yet</strong>
                      <p>Every game you finish while logged in is listed here with its result.</p>
                      <Link className="btn primary" to="/play/bot">Play a bot</Link>
                    </td>
                  </tr>
                )}
                {rows?.slice(0, 20).map(g => {
                  const white = g.white === me
                  const o = outcome(g, me)
                  return (
                    <tr key={g.id}>
                      <td>{new Date(g.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td>{g.kind === 'bot' ? `${g.bot} (bot)` : (white ? g.b : g.w)?.username ?? 'Deleted account'}</td>
                      <td>{white ? 'White' : 'Black'}</td>
                      <td>{o ? WORD[o] : 'Not counted'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {rows && rows.length > 0 && (
            <p className="hint">
              A game against another person counts once both players report the same result. "Not counted" means the reports differ or one is still missing.
            </p>
          )}
        </>
      )}
    </main>
  )
}

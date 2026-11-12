import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { Board } from '../components/Board'
import { useChess, useTitle } from '../components/GameLayout'
import { OPERA_GAME } from '../lib/opera'
import { useAccount } from '../lib/supabase'
import { Reveal, calm, tilt } from '../lib/motion'

function Demo() {
  const game = useChess()
  const [playing, setPlaying] = useState(() => !calm())
  const [byHand, setByHand] = useState(false) // sound only once the visitor has pressed the button
  const n = game.chess.history().length
  const done = n >= OPERA_GAME.length

  useEffect(() => {
    if (!playing) return
    if (done) return setPlaying(false)
    const t = setTimeout(() => game.move(OPERA_GAME[n]), n === 0 ? 1900 : 1300)
    return () => clearTimeout(t)
  }, [playing, n])

  return (
    <figure className="demo">
      <div className="tilt" {...tilt}>
        <Board chess={game.chess} fen={game.fen} orientation="w" label="Board replaying Morphy's Opera Game" sound={byHand} />
      </div>
      <figcaption>
        <p>
          <span className="sheet-n">{n ? `${Math.ceil(n / 2)}.${n % 2 ? '' : '..'} ${OPERA_GAME[n - 1]}` : 'Start'}</span>
          Morphy v. Duke Karl and Count Isouard, Paris 1858. Move {n} of {OPERA_GAME.length}.
        </p>
        <button
          type="button"
          className="btn secondary"
          onClick={() => { if (done) game.reset(); setByHand(true); setPlaying(done || !playing) }}
        >
          {done ? 'Replay game' : playing ? 'Pause game' : n ? 'Resume game' : 'Play game'}
        </button>
      </figcaption>
    </figure>
  )
}

const TITLE = 'A quiet room for a game of chess.'
const ROWS: [string, boolean][] = [
  ['Play three bots, from beginner to full engine', true],
  ['Get paired with someone online, 10 minutes each', true],
  ['Duel a friend by sending a link', false],
  ['Wins, draws and losses kept on a stats page', false],
]

export default function Home() {
  useTitle('Play chess online')
  const { user } = useAccount()
  return (
    <main id="main" tabIndex={-1} className="page home">
      <section className="hero">
        <div className="hero-text">
          <h1 aria-label={TITLE}>
            {TITLE.split(' ').map((w, i) => <span key={i} aria-hidden="true" className="word" style={{ '--i': i } as CSSProperties}>{w} </span>)}
          </h1>
          <p className="lede">
            Play a bot now, get paired with whoever is online, or send a friend a link.
            The first two need no account.
          </p>
          <div className="row stagger">
            <Link className="btn primary" to="/play/bot">Play a bot</Link>
            <Link className="btn secondary" to="/play/quick">Find an opponent</Link>
            <Link className="btn secondary" to="/duel/new">Duel a friend</Link>
          </div>
        </div>
        <Demo />
      </section>

      <Reveal as="section" className="adds" aria-labelledby="adds-title">
        <h2 id="adds-title">What an account adds</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Feature</span></th>
                <th scope="col">No account</th>
                <th scope="col">Account</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([what, guest], i) => (
                <tr key={what} style={{ '--i': i } as CSSProperties}>
                  <th scope="row"><span className="sheet-n">{i + 1}.</span>{what}</th>
                  <td>{guest ? 'Yes' : 'No'}</td>
                  <td>Yes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {user
          ? <Link className="btn primary" to="/duel/new">Duel a friend</Link>
          : <Link className="btn primary" to="/signup">Create account</Link>}
      </Reveal>
    </main>
  )
}

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GameLayout, useChess, useTitle } from '../components/GameLayout'
import type { Grade } from '../lib/game'
import { COURSE, LESSONS, lessonsDone, markLessonDone, type Lesson } from '../lib/lessons'
import { confetti } from '../lib/motion'
import { play } from '../lib/sound'

/** The lesson list. */
export default function Train() {
  useTitle('Train')
  const done = lessonsDone()
  const next = LESSONS.find(l => !done.includes(l.id))
  let n = 0
  return (
    <main id="main" tabIndex={-1} className="page train">
      <h1>Train</h1>
      <p className="lede">Learn the rules one short lesson at a time, then practise against a bot while a coach grades every move you make.</p>

      <div className="train-top">
        <div>
          <label htmlFor="course-progress">{done.length} of {LESSONS.length} lessons finished</label>
          <progress id="course-progress" max={LESSONS.length} value={done.length} />
        </div>
        <div className="row">
          {next && <Link className="btn primary" to={`/train/${next.id}`}>{done.length ? 'Continue' : 'Start'}: {next.title}</Link>}
          <Link className={next ? 'btn secondary' : 'btn primary'} to="/train/coach">Play with the coach</Link>
        </div>
      </div>

      {COURSE.map(chapter => (
        <section key={chapter.title} aria-labelledby={`ch-${chapter.title}`}>
          <h2 id={`ch-${chapter.title}`}>{chapter.title}</h2>
          <ol className="lessons">
            {chapter.lessons.map(l => {
              const isDone = done.includes(l.id)
              const i = n++
              return (
                <li key={l.id} style={{ '--i': i % 8 } as CSSProperties}>
                  <Link to={`/train/${l.id}`} className="lesson-row">
                    <span className="sheet-n">{i + 1}.</span>
                    <span className="lesson-name"><strong>{l.title}</strong><span className="hint">{l.summary}</span></span>
                    <span className="lesson-state">{isDone ? 'Finished' : ''}</span>
                    <span className="btn secondary" aria-hidden="true">{isDone ? 'Repeat' : 'Start'}</span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      ))}

      <section aria-labelledby="coach-title" className="coach-card">
        <h2 id="coach-title">Practise with the coach</h2>
        <p>Play a full game against a bot. After each of your moves the coach marks it as best, good, an inaccuracy, a mistake or a blunder, and can show you the move it would have played. You can take any move back and try again.</p>
        <Link className="btn primary" to="/train/coach">Play with the coach</Link>
      </section>
    </main>
  )
}

export function LessonPage() {
  const { id } = useParams()
  const lesson = LESSONS.find(l => l.id === id)
  useTitle(lesson?.title ?? 'Lesson not found')
  if (!lesson)
    return (
      <main id="main" tabIndex={-1} className="page prose">
        <h1>This lesson does not exist</h1>
        <p>The address may be mistyped, or the lesson was renamed.</p>
        <Link className="btn primary" to="/train">Go to all lessons</Link>
      </main>
    )
  return <Player key={lesson.id} lesson={lesson} />
}

const bare = (san: string) => san.replace(/[+#]/g, '')

function Player({ lesson }: { lesson: Lesson }) {
  const [n, setN] = useState(0)
  const [state, setState] = useState<'ask' | 'right' | 'wrong'>('ask')
  const [tries, setTries] = useState(0)
  const [reveal, setReveal] = useState(false)
  const [badge, setBadge] = useState<{ from: string; to: string; grade: Grade; glyph: string } | null>(null)
  const [done, setDone] = useState(false)
  const step = lesson.steps[n]
  const game = useChess()
  const reset = useRef<ReturnType<typeof setTimeout>>(undefined)
  const last = n === lesson.steps.length - 1
  const following = LESSONS[LESSONS.indexOf(lesson) + 1]

  useEffect(() => {
    game.load(step.fen)
    setState('ask'); setTries(0); setReveal(false); setBadge(null)
    return () => clearTimeout(reset.current)
  }, [n])

  function onMove(m: { from: string; to: string; promotion?: string }) {
    const mv = game.move(m)
    if (!mv) return
    const ok = step.accept === 'mate' ? game.chess.isCheckmate() : (step.accept ?? []).map(bare).includes(bare(mv.san))
    setBadge({ from: mv.from, to: mv.to, grade: ok ? 'best' : 'blunder', glyph: ok ? '✓' : '✗' })
    if (ok) { setState('right'); play('best'); return }
    setState('wrong'); setTries(t => t + 1); play('mistake')
    // The wrong move stays on the board long enough to be seen, then the position is put back.
    reset.current = setTimeout(() => { game.load(step.fen); setBadge(null) }, 1200)
  }

  function forward() {
    if (!last) return setN(n + 1)
    markLessonDone(lesson.id)
    setDone(true)
    play('win')
    confetti()
  }

  const task = !!step.accept
  const showArrow = step.arrow && (!task || reveal) && state !== 'right'

  return (
    <GameLayout
      title={lesson.title}
      chess={game.chess}
      fen={game.fen}
      orientation="w"
      movable={task && state !== 'right' && !done ? 'w' : null}
      onMove={onMove}
      top={{ name: 'Black', color: 'b' }}
      bottom={{ name: 'You', color: 'w' }}
      idle
      badge={badge}
      arrow={showArrow ? step.arrow : null}
      announce={state === 'right' ? `Correct. ${step.right}` : state === 'wrong' ? `Not this move. ${step.wrong}` : ''}
    >
      {done ? (
        <div className="result">
          <p className="result-text">Lesson finished.</p>
          <div className="row">
            {following && <Link className="btn primary" to={`/train/${following.id}`}>Start the next lesson: {following.title}</Link>}
            {!following && <Link className="btn primary" to="/train/coach">Play with the coach</Link>}
            <Link className="btn secondary" to="/train">Go to all lessons</Link>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label htmlFor="lesson-progress" className="hint">Step {n + 1} of {lesson.steps.length}</label>
            <progress id="lesson-progress" max={lesson.steps.length} value={n + (state === 'right' || !task ? 1 : 0)} />
          </div>
          <p className="lesson-text" key={`text${n}`}>{step.text}</p>
          {state === 'right' && <p className="note right"><b className="chip g-best">✓</b> <strong>Correct.</strong> {step.right}</p>}
          {state === 'wrong' && <p className="note error" key={`wrong${tries}`}><b className="chip g-blunder">✗</b> <strong>Not this move.</strong> {step.wrong}</p>}
          <div className="row">
            {(!task || state === 'right') && <button type="button" className="btn primary" onClick={forward}>{last ? 'Finish the lesson' : 'Go to the next step'}</button>}
            {task && state !== 'right' && tries > 0 && step.arrow && !reveal && <button type="button" className="btn secondary" onClick={() => setReveal(true)}>Show the answer</button>}
            {n > 0 && <button type="button" className="btn quiet" onClick={() => setN(n - 1)}>Go back a step</button>}
            <Link className="btn quiet" to="/train">Go to all lessons</Link>
          </div>
        </>
      )}
    </GameLayout>
  )
}

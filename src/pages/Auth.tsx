import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorNote, useTitle } from '../components/GameLayout'
import { supabase, useAccount } from '../lib/supabase'
import { calm } from '../lib/motion'
import { play } from '../lib/sound'

type Field = 'username' | 'email' | 'password'

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup'
  useTitle(signup ? 'Create account' : 'Log in')
  const [params] = useSearchParams()
  const raw = params.get('next') ?? ''
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  const query = next === '/' ? '' : `?next=${encodeURIComponent(next)}`
  const navigate = useNavigate()
  const { user } = useAccount()
  // The draft survives a refresh or a trip to the other form. The password is never stored.
  const [values, setValues] = useState<Record<Field, string>>(() => {
    try { return { username: '', email: '', ...JSON.parse(sessionStorage.getItem('qm:auth-draft') ?? '{}'), password: '' } }
    catch { return { username: '', email: '', password: '' } }
  })
  useEffect(() => {
    try { sessionStorage.setItem('qm:auth-draft', JSON.stringify({ username: values.username, email: values.email })) } catch { /* draft lasts until the page closes */ }
  }, [values.username, values.email])
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [formError, setFormError] = useState('')
  const [technical, setTechnical] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [show, setShow] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const card = useRef<HTMLDivElement>(null)
  // A refused form shakes its head and sounds the error note.
  function refuse() {
    play('error')
    if (!calm()) card.current?.animate({ transform: ['none', 'translateX(-10px)', 'translateX(9px)', 'translateX(-6px)', 'translateX(4px)', 'none'] }, { duration: 420 })
  }
  const fields: Field[] = signup ? ['username', 'email', 'password'] : ['email', 'password']

  useEffect(() => { if (user) navigate(next, { replace: true }) }, [user])

  function check(f: Field, v = values[f]): string {
    if (f === 'username') return /^[A-Za-z0-9_]{3,20}$/.test(v) ? '' : 'Use 3 to 20 letters, numbers or underscores.'
    if (f === 'email') return /^\S+@\S+\.\S+$/.test(v) ? '' : 'Enter an email address like name@example.com.'
    if (!v) return 'Enter your password.'
    return signup && v.length < 8 ? 'Use at least 8 characters.' : ''
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const found = Object.fromEntries(fields.map(f => [f, check(f)]).filter(([, m]) => m)) as Partial<Record<Field, string>>
    setErrors(found)
    setFormError('')
    setTechnical('')
    const first = fields.find(f => found[f])
    if (first) { refuse(); return form.current?.querySelector<HTMLInputElement>(`#${first}`)?.focus() }

    setBusy(true)
    try {
      if (signup) {
        const taken = await supabase.from('profiles').select('id').ilike('username', values.username.replace(/_/g, '\\_')).maybeSingle()
        if (taken.error) throw taken.error
        if (taken.data) {
          refuse()
          setErrors({ username: 'That username is taken. Try another one.' })
          return form.current?.querySelector<HTMLInputElement>('#username')?.focus()
        }
        const { data, error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: { data: { username: values.username }, emailRedirectTo: location.origin + location.pathname },
        })
        if (error) throw error
        if (data.user?.identities?.length === 0) { refuse(); return setFormError('That email already has an account. Log in with it, or use a different email.') }
        play('success')
        if (!data.session) setSent(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
        if (error) throw error
        play('success')
      }
    } catch (err) {
      refuse()
      const msg = err instanceof Error ? err.message : ''
      setFormError(
        /invalid login/i.test(msg) ? "That email and password don't match an account. Check both and log in again."
        : /not confirmed/i.test(msg) ? 'This email is not confirmed yet. Open the link in the email we sent, then log in.'
        : /rate limit|too many/i.test(msg) ? 'Too many attempts in a short time. Wait a minute, then try again.'
        : /password/i.test(msg) ? 'That password was not accepted. Use at least 8 characters and avoid common passwords.'
        : "The server can't be reached, so nothing was saved. Check your connection and try again.",
      )
      if (!/invalid login|not confirmed|rate limit|too many|password/i.test(msg)) setTechnical(`auth ${mode} failed: ${msg || 'unknown'}`)
    } finally {
      setBusy(false)
    }
  }

  const labels: Record<Field, string> = { username: 'Username', email: 'Email', password: 'Password' }
  const hints: Partial<Record<Field, string>> = signup
    ? { username: 'Other players see this name.', password: 'At least 8 characters.' }
    : {}

  return (
    <main id="main" tabIndex={-1} className="auth">
      <div className="card" ref={card}>
        <Link to="/" className="wordmark">Quiet Move</Link>
        {sent ? (
          <>
            <h1>Check your inbox</h1>
            <p>We sent a confirmation link to {values.email}. Open it, then log in to finish.</p>
            <Link className="btn primary" to={`/login${query}`}>Go to log in</Link>
          </>
        ) : (
          <>
            <h1>{signup ? 'Create your account' : 'Log in'}</h1>
            {next.startsWith('/duel') || next.startsWith('/game')
              ? <p>Duels need an account, so both players' results can be kept.</p>
              : next === '/stats' ? <p>Log in to see your stats.</p> : null}
            <p className="hint">All fields are required.</p>
            <form ref={form} onSubmit={submit} noValidate>
              {fields.map((f, i) => (
                <div key={f} className="field" style={{ '--i': i } as CSSProperties}>
                  <label htmlFor={f}>{labels[f]}</label>
                  <div className="row tight">
                    <input
                      id={f}
                      type={f === 'password' ? (show ? 'text' : 'password') : f === 'email' ? 'email' : 'text'}
                      autoComplete={f === 'password' ? (signup ? 'new-password' : 'current-password') : f === 'email' && signup ? 'email' : 'username'}
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={f === 'email' ? 'name@example.com' : undefined}
                      value={values[f]}
                      aria-required="true"
                      aria-invalid={!!errors[f]}
                      aria-describedby={`${f}-msg`}
                      onChange={e => { setValues({ ...values, [f]: e.target.value }); if (errors[f]) setErrors({ ...errors, [f]: '' }) }}
                      onBlur={e => setErrors({ ...errors, [f]: check(f, e.target.value) })}
                    />
                    {f === 'password' && (
                      <button type="button" className="btn secondary" aria-pressed={show} onClick={() => setShow(!show)}>
                        {show ? 'Hide' : 'Show'}<span className="sr-only"> password</span>
                      </button>
                    )}
                  </div>
                  <p id={`${f}-msg`} className={errors[f] ? 'field-error' : 'hint'}>{errors[f] || hints[f] || ''}</p>
                </div>
              ))}
              {formError && (technical
                ? <ErrorNote detail={technical}>{formError}</ErrorNote>
                : <p className="note error" role="alert">{formError}</p>)}
              <button type="submit" className="btn primary wide" aria-busy={busy}>
                {busy && <span className="busy" aria-hidden="true" />}
                {signup ? (busy ? 'Creating account' : 'Create account') : busy ? 'Logging in' : 'Log in'}
              </button>
            </form>
            <p className="alt">
              {signup
                ? <>Have an account? <Link to={`/login${query}`}>Log in</Link></>
                : <>New here? <Link to={`/signup${query}`}>Create an account</Link></>}
            </p>
          </>
        )}
        <Link className="escape" to="/">Go back to the lobby</Link>
      </div>
    </main>
  )
}

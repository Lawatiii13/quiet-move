import { createClient, type Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

// Both values are public by design: row level security in the database decides what a browser may do.
export const supabase = createClient(
  'https://iyumybjephpfdvjosuiq.supabase.co',
  'sb_publishable_IWOowPLq8WJQycLrIt4ivA_EinhNlBQ',
  // PKCE keeps email-link tokens in the query string, out of the way of the hash router.
  { auth: { flowType: 'pkce' } },
)

// undefined = still loading, null = signed out
export const SessionContext = createContext<Session | null | undefined>(undefined)

export function useAccount() {
  const session = useContext(SessionContext)
  const user = session?.user ?? null
  return {
    loading: session === undefined,
    user,
    name: (user?.user_metadata?.username as string | undefined) ?? null,
  }
}

export function guestName() {
  try {
    let n = sessionStorage.getItem('qm:guest')
    if (!n) sessionStorage.setItem('qm:guest', (n = `Guest ${Math.floor(1000 + Math.random() * 9000)}`))
    return n
  } catch {
    return 'Guest'
  }
}

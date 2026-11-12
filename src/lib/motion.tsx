import { useEffect, useRef, useState, type ElementType, type PointerEvent, type ReactNode } from 'react'

// "calm" is set on <html> from the visitor's device setting, or from the footer switch (see index.html).
export const calm = () => document.documentElement.dataset.motion === 'calm'

/** Fades and slides its children in the first time they scroll into view. */
export function Reveal({ as: Tag = 'div', className = '', children, ...rest }: { as?: ElementType; className?: string; children: ReactNode; [k: string]: unknown }) {
  const ref = useRef<HTMLElement>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold: 0.15 })
    io.observe(ref.current!)
    return () => io.disconnect()
  }, [])
  return <Tag ref={ref} className={`${className} reveal${seen ? ' in' : ''}`} {...rest}>{children}</Tag>
}

/** Counts from 0 up to `value` over 900ms. */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(calm() ? value : 0)
  useEffect(() => {
    if (calm()) return setShown(value)
    let frame = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900)
      setShown(Math.round(value * (1 - (1 - k) ** 3)))
      if (k < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{shown}</>
}

/** Pointer handlers that lean an element towards the mouse. */
export const tilt = {
  onPointerMove(e: PointerEvent<HTMLElement>) {
    if (calm() || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 10}deg`)
    e.currentTarget.style.setProperty('--rx', `${(0.5 - (e.clientY - r.top) / r.height) * 10}deg`)
  },
  onPointerLeave(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty('--ry', '0deg')
    e.currentTarget.style.setProperty('--rx', '0deg')
  },
}

/** A burst of paper squares in the site's own colours. Removes itself when it has fallen. */
export function confetti() {
  if (calm()) return
  const box = document.createElement('div')
  box.className = 'confetti'
  box.setAttribute('aria-hidden', 'true')
  const colors = ['var(--accent)', 'var(--sq-dark)', 'var(--sq-light)', 'var(--ink)']
  for (let i = 0; i < 70; i++) {
    const bit = document.createElement('i')
    bit.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % 4]};--x:${(Math.random() - 0.5) * 30}vw;--r:${Math.random() * 1080 - 540}deg;animation-delay:${Math.random() * 500}ms;animation-duration:${1800 + Math.random() * 1400}ms`
    box.append(bit)
  }
  document.body.append(box)
  setTimeout(() => box.remove(), 4200)
}

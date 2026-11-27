'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, BookOpen } from 'lucide-react'

export function LoadingScreen({ onComplete }: { onComplete?: () => void } = {}) {
  const router = useRouter()

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      if (onComplete) {
        onComplete()
      } else {
        router.replace('/login')
      }
    }, reducedMotion ? 300 : 1200)
    return () => window.clearTimeout(timer)
  }, [onComplete, router])

  return (
    <main className="loading-page">
      <div className="loading-frame">
        <div className="loading-topline"><span className="loading-brand"><span className="loading-mark"><BookOpen size={17} /></span> THAPAR CONNECT</span><span className="loading-status"><i /> CAMPUS NETWORK</span></div>
        <div className="loading-content">
          <span className="loading-kicker">A BETTER WAY TO CONNECT</span>
          <h1>Good things take a moment.</h1>
          <p>Getting your next great conversation ready.</p>
          <div className="loading-label"><span>LOADING</span><span className="loading-dots" aria-hidden="true">...</span></div>
          <div className="loading-track" role="progressbar" aria-label="Loading Thapar Connect" aria-valuemin={0} aria-valuemax={100}>
            <span className="loading-fill" />
            <span className="loading-segments" aria-hidden="true" />
          </div>
          <div className="loading-footline"><span>PREPARING YOUR CAMPUS CONNECTION</span><span className="loading-percent">STARTING</span></div>
          <Link className="loading-skip" href={onComplete ? '/' : '/login'} onClick={(event) => { if (onComplete) { event.preventDefault(); onComplete() } }}>Skip intro <ArrowRight size={14} /></Link>
        </div>
        <span className="loading-corner" aria-hidden="true">TC—01 / CONNECT</span>
      </div>
    </main>
  )
}

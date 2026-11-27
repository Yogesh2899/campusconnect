'use client'

import { AccountForm } from './account-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { NeuralBackground } from '@/components/neural-background'
import { ThemeToggle } from '@/components/theme-provider'



function Brand() {
  return <Link className="brand login-brand" href="/" aria-label="Thapar Connect home"><img className="brand-mark" src="/thapar-logo.png" width={32} height={32} alt=""/><span>thapar<span className="brand-light">connect</span></span><span className="brand-dot">.</span></Link>
}

export function LoginScreen(props: {mode: string, departments?: {id:string,name:string}[], google?:boolean, registrationAvailable?:boolean}) {
  return (
    <main className="login-page">
      <div className="login-network" aria-hidden="true"><NeuralBackground className="login-network-canvas" /></div>
      <div className="login-orb login-orb-one" aria-hidden="true" />
      <div className="login-orb login-orb-two" aria-hidden="true" />
      <div className="login-layout">
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-form-panel">
            <div className="login-topline"><Brand /><div className="login-top-actions"><ThemeToggle /><Link className="login-back" href="/"><ArrowLeft size={14} /> Back home</Link></div></div>
            <AccountForm {...props} />
          </div>
          <aside className="login-art-panel" aria-label="Welcome to Thapar Connect">
            <img className="login-art-image" src="/thapar-residencies.webp" width={1000} height={1500} alt="Red steel beams over a courtyard at the Thapar student residences" />
          </aside>
        </section>
        <p className="login-legal">By continuing, you agree to use Thapar Connect responsibly. <Link href="/loading">Replay intro</Link></p>
      </div>
    </main>
  )
}




'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NeuralBackground } from '@/components/neural-background'
import { LoadingScreen } from '@/components/loading-screen'
import { ThemeToggle } from '@/components/theme-provider'
import { ArrowDown, ArrowRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, Clock3, Command, GraduationCap, Menu, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react'

const faculty = [
  { initials: 'AS', name: 'Dr. Ananya Sharma', title: 'Associate Professor · Computer Science', focus: 'Machine Learning, NLP', color: 'lavender', next: 'Today, 2:30 PM' },
  { initials: 'RK', name: 'Prof. Rohan Kapoor', title: 'Professor · Electrical Engineering', focus: 'Robotics, Embedded Systems', color: 'peach', next: 'Tomorrow, 11:00 AM' },
  { initials: 'PM', name: 'Dr. Priya Mehta', title: 'Assistant Professor · Business', focus: 'Entrepreneurship, Strategy', color: 'mint', next: 'Thu, 10:30 AM' },
]

const features = [
  { icon: Search, title: 'Find your person', copy: 'Search professors by department, designation, or the expertise you need.' },
  { icon: CalendarDays, title: 'Time that works', copy: 'See real availability and choose a slot that fits your schedule.' },
  { icon: Bell, title: 'Stay in the loop', copy: 'Get timely updates when your request is accepted or rescheduled.' },
  { icon: ShieldCheck, title: 'Built for campus', copy: 'A trusted space for students and faculty in the Thapar community.' },
]

const heroPhrases = ['a class question', 'your next big idea', 'what comes next']

function TypewriterPhrase() {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [visibleText, setVisibleText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisibleText(heroPhrases[0])
      return
    }

    const phrase = heroPhrases[phraseIndex]
    const delay = !isDeleting && visibleText === phrase ? 1500 : isDeleting ? 32 : 62
    const timer = window.setTimeout(() => {
      if (!isDeleting && visibleText === phrase) {
        setIsDeleting(true)
      } else if (isDeleting && visibleText.length === 0) {
        setIsDeleting(false)
        setPhraseIndex((index) => (index + 1) % heroPhrases.length)
      } else {
        setVisibleText((text) => isDeleting ? text.slice(0, -1) : phrase.slice(0, text.length + 1))
      }
    }, delay)

    return () => window.clearTimeout(timer)
  }, [isDeleting, phraseIndex, visibleText])

  return <><span className="sr-only">a class question, your next big idea, or what comes next</span><span className="typewriter-text" aria-hidden="true">{visibleText}<span className="typewriter-cursor">|</span></span></>
}

function Logo() {
  return <a className="brand" href="#home" aria-label="Thapar Connect home"><img className="brand-mark" src="/thapar-logo.png" width={32} height={32} alt=""/><span>thapar<span className="brand-light">connect</span></span><span className="brand-dot">.</span></a>
}

export default function HomePage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showInitialLoading, setShowInitialLoading] = useState(true)

  if (showInitialLoading) {
    return <LoadingScreen onComplete={() => setShowInitialLoading(false)} />
  }

  return (
    <main id="home" className="site-shell">
      <div className="announcement"><span className="announcement-pulse" />A better way to connect with your faculty <a href="#how-it-works">See how it works <ArrowRight size={13} /></a></div>
      <header className="header">
        <Logo />
        <div className="mobile-header-actions"><ThemeToggle /><button className="mobile-menu" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
        <nav className={menuOpen ? 'nav nav-open' : 'nav'} aria-label="Main navigation">
          <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a><a href="#students" onClick={() => setMenuOpen(false)}>For students</a><a href="#professors" onClick={() => setMenuOpen(false)}>For professors</a><a href="#features" onClick={() => setMenuOpen(false)}>Features</a>
          <div className="mobile-actions"><Link href="/login" onClick={() => setMenuOpen(false)} className="button button-text">Student login</Link><Link href="/login/teacher" className="button button-text">Teacher login</Link><Link className="button button-primary" href="/login/register">Student registration <ArrowRight size={15} /></Link></div>
        </nav>
        <div className="header-actions"><ThemeToggle /><Link href="/login" className="button button-text">Student login</Link><Link href="/login/teacher" className="button button-text">Teacher login</Link><Link className="button button-primary" href="/login/register">Student registration <ArrowRight size={15} /></Link></div>
      </header>

      <section className="hero" id="platform">
        <div className="hero-network" aria-hidden="true"><NeuralBackground className="hero-network-canvas" /></div><div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-icon"><Sparkles size={13} /></span> YOUR CAMPUS, MORE CONNECTED</div>
          <h1>Good things<br /> happen <span className="headline-accent">one conversation</span><br /> at a time.</h1>
          <p className="hero-description">The easiest way to find your professors, book a meeting, and make the most of every conversation at Thapar.</p>
          <p className="hero-typewriter"><span aria-hidden="true">Start with </span><TypewriterPhrase /><span aria-hidden="true">.</span></p>
          <div className="hero-buttons"><Link className="button button-primary button-large" href="/login/register">Create student account <ArrowRight size={16} /></Link><a href="#how-it-works" className="button button-outline button-large"><span className="play-icon">▶</span> How it works</a></div>
          <div className="community-note"><span className="community-symbol" aria-hidden="true"><Users size={21}/></span><div><strong>Made for the Thapar community</strong><p>Students and faculty, closer together.</p></div></div>
        </div>
        <div className="hero-visual" aria-label="A preview of the professor discovery and booking experience">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" /><div className="floating-spark spark-one">✳</div><div className="floating-spark spark-two">✳</div>
          <div className="dashboard-card">
            <div className="dash-top"><div><span className="dash-kicker">PLATFORM PREVIEW</span><h3>Find your mentor</h3></div><span className="icon-button" aria-hidden="true"><Bell size={16} /><i /></span></div>
            <div className="search-field"><Search size={15} /><span>Try “machine learning”</span><kbd>⌘ K</kbd></div>
            <div className="filter-row"><span className="filter-chip active-chip">All faculty</span><span className="filter-chip">Computer Science <ChevronDown size={12} /></span></div>
            <div className="dash-label">AVAILABLE THIS WEEK <span>See all <ArrowUpRight size={12} /></span></div>
            {faculty.slice(0, 2).map((person, index) => <div className="faculty-row" key={person.initials}><div className={`faculty-avatar ${person.color}`}>{person.initials}</div><div className="faculty-info"><strong>{person.name}</strong><span>{person.title}</span><small><span className="online-dot" /> {index === 0 ? 'Available today' : 'Next available tomorrow'}</small></div><span className="row-arrow" aria-hidden="true"><ArrowUpRight size={15} /></span></div>)}
            <div className="dash-footer"><span><span className="secure-dot" /> Verified Thapar faculty</span><span>12 available</span></div>
          </div>
          <div className="floating-note note-calendar"><span className="note-icon"><CalendarDays size={17} /></span><span><strong>Meeting confirmed</strong><small>Today at 2:30 PM</small></span><Check size={16} className="note-check" /></div>
          <div className="floating-note note-time"><span className="time-icon"><Clock3 size={17} /></span><span><strong>Your time matters</strong><small>Book in just a few clicks</small></span></div>
        </div>
        <a href="#students" className="scroll-cue"><span /> Scroll to explore <ArrowDown size={13} /></a>
      </section>

      <section className="trust-strip" aria-label="Platform benefits"><div><span className="trust-icon"><Users size={18} /></span><p><strong>One campus community</strong><small>Made for Thapar students & faculty</small></p></div><div><span className="trust-icon"><CalendarDays size={18} /></span><p><strong>Effortless scheduling</strong><small>Find a time that works for both</small></p></div><div><span className="trust-icon"><ShieldCheck size={18} /></span><p><strong>Thoughtfully private</strong><small>Your academic conversations, respected</small></p></div><div className="trust-mini"><span className="mini-avatars"><i>A</i><i>S</i><i>R</i></span><span>Better conversations<br /><strong>start right here</strong></span></div></section>

      <section className="section intro-section" id="students"><div className="section-heading"><span className="eyebrow">A LITTLE CLOSER GOES A LONG WAY</span><h2>Your next big idea<br />could start with <span className="headline-accent">hello.</span></h2><p>Office hours shouldn't be hard to find. Thapar Connect brings your campus community together, making it simple to get guidance, share ideas, and move forward.</p></div><div className="intro-aside"><span className="aside-mark"><GraduationCap size={25} /></span><p>Whether it&apos;s a question before class, guidance on a project, or a conversation about what&apos;s next — there&apos;s a professor ready to help.</p><a href="#how-it-works">A more connected campus <ArrowRight size={15} /></a></div></section>

      <section className="section feature-section" id="features"><div className="section-top"><div><span className="eyebrow">LESS BACK-AND-FORTH. MORE AHA MOMENTS.</span><h2>Everything clicks<br />into <span className="headline-accent">place.</span></h2></div><a className="text-link" href="#how-it-works">Explore the platform <ArrowUpRight size={15} /></a></div><div className="feature-grid">{features.map((feature, index) => <article className="feature-card" key={feature.title}><div className={`feature-icon feature-icon-${index}`}><feature.icon size={19} /></div><span className="feature-index">0{index + 1}</span><h3>{feature.title}</h3><p>{feature.copy}</p><a href="#how-it-works" aria-label={`Learn more: ${feature.title}`}><ArrowUpRight size={17} /></a></article>)}</div></section>

      <section className="story-section" id="how-it-works"><div className="story-inner"><div className="story-copy"><span className="eyebrow eyebrow-light">THREE STEPS. ONE GREAT CONVERSATION.</span><h2>From “I wonder”<br />to “I&apos;ve got this.”</h2><p>Getting the guidance you need is easier than ever. No email chains, no guesswork — just a straightforward way to connect.</p><Link className="button button-white" href="/login/register">Start your search <ArrowRight size={15} /></Link></div><div className="steps-list"><div className="step-item"><span className="step-num">01</span><span className="step-line" /><div><h3>Find the right professor</h3><p>Explore faculty by department, expertise, and availability.</p></div><Search size={20} /></div><div className="step-item"><span className="step-num">02</span><span className="step-line" /><div><h3>Pick a time that works</h3><p>Choose an open slot and tell them what&apos;s on your mind.</p></div><CalendarDays size={20} /></div><div className="step-item"><span className="step-num">03</span><span className="step-line" /><div><h3>Show up and grow</h3><p>Get a confirmation, a reminder, and make it count.</p></div><Check size={20} /></div></div></div><div className="story-decoration" aria-hidden="true"><span /><span /><span /></div></section>

      <section className="section professor-section" id="professors"><div className="professor-card"><div className="professor-graphic"><div className="graphic-ring ring-outer" /><div className="graphic-ring ring-inner" /><div className="graphic-center"><GraduationCap size={42} /></div><span className="graphic-orb orb-a"><CalendarDays size={15} /></span><span className="graphic-orb orb-b"><Users size={15} /></span><span className="graphic-orb orb-c"><Bell size={15} /></span></div><div className="professor-copy"><span className="eyebrow">FOR THE PEOPLE WHO MAKE IT HAPPEN</span><h2>More meaningful<br />office hours. <span className="headline-accent">Less admin.</span></h2><p>Set your availability once, keep your calendar in sync, and let students find a time that works. You focus on the conversation — we&apos;ll take care of the logistics.</p><ul><li><Check size={15} /> Set weekly or one-time availability</li><li><Check size={15} /> Approve and manage requests in one place</li><li><Check size={15} /> Keep students updated automatically</li></ul><Link className="button button-primary" href="/login/teacher">Teacher login <ArrowRight size={15} /></Link></div></div></section>

      <section className="closing-cta"><div className="cta-stars" aria-hidden="true">✳</div><span className="eyebrow eyebrow-light">YOUR NEXT CONVERSATION IS WAITING</span><h2>Curiosity looks<br />good on you.</h2><p>Start with a question. Leave with a little more clarity.</p><Link className="button button-white button-large" href="/login/register">Student registration <ArrowRight size={16} /></Link><span className="cta-note"><ShieldCheck size={14} /> Exclusively for the Thapar community</span></section>

      <footer className="footer">
        <div className="footer-top">
          <div className="footer-brand"><Logo /><p>Better conversations make<br />a better campus.</p></div>
          <div className="footer-links">
            <div><strong>Explore</strong><a href="#platform">Platform</a><a href="#features">Features</a><a href="#how-it-works">How it works</a></div>
            <div><strong>For you</strong><a href="#students">Students</a><a href="#professors">Professors</a><Link href="/login">Student login</Link><Link href="/login/teacher" className="button button-text">Teacher login</Link></div>
            <div><strong>Help &amp; support</strong><a href="#support">Quick help</a><a href="mailto:support@thapar.edu?subject=Contact%20Thapar%20Connect">Contact us</a><a href="mailto:support@thapar.edu?subject=Privacy%20and%20terms">Privacy &amp; terms</a></div>
          </div>
        </div>
        <section className="footer-support" id="support" aria-labelledby="footer-support-title">
          <div className="footer-support-intro">
            <span className="eyebrow">HELP &amp; SUPPORT</span>
            <h2 id="footer-support-title">Need a hand?</h2>
            <p>Find quick answers about Thapar Connect, or get in touch with our team.</p>
            <a className="footer-contact-link" href="mailto:support@thapar.edu?subject=Thapar%20Connect%20support">Email support <ArrowUpRight size={15} /></a>
            <span className="footer-support-address">support@thapar.edu</span>
          </div>
          <div className="footer-help-grid" aria-label="Quick help topics">
            <a className="footer-help-card" href="#platform"><span className="footer-help-number">01</span><span><strong>Find a professor</strong><small>Browse departments and expertise</small></span><ArrowUpRight size={15} /></a>
            <a className="footer-help-card" href="#how-it-works"><span className="footer-help-number">02</span><span><strong>Book a meeting</strong><small>See how scheduling works</small></span><ArrowUpRight size={15} /></a>
            <a className="footer-help-card" href="#professors"><span className="footer-help-number">03</span><span><strong>Faculty resources</strong><small>Manage availability and requests</small></span><ArrowUpRight size={15} /></a>
            <Link className="footer-help-card" href="/login"><span className="footer-help-number">04</span><span><strong>Account access</strong><small>Go to the sign-in page</small></span><ArrowUpRight size={15} /></Link>
          </div>
        </section>
        <div className="footer-bottom"><span>© 2026 Thapar Connect. Built for better conversations.</span><span><span className="secure-dot" /> A Thapar community platform</span></div>
      </footer>


    </main>
  )
}






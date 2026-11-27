import { ArrowUpRight, Menu, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../lib/session'
import { Brand } from './ui'

function Header() {
  const { session, signOut } = useSession()
  const [expanded, setExpanded] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const close = () => setExpanded(false)
  return <header className="site-header" onKeyDown={event => {
    if (expanded && event.key === 'Escape') {
      close()
      menuButton.current?.focus()
    }
  }}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="container header-inner">
      <Brand />
      <nav className="desktop-nav" aria-label="Primary">
        <NavLink to="/courts">Find a court</NavLink>
        <NavLink to="/facilities">Facilities</NavLink>
        <Link to="/#how-it-works">How it works</Link>
      </nav>
      <div className="header-actions">
        {session ? <>
          <button type="button" className="nav-button" onClick={signOut}>Sign out</button>
          <Link className="button button--dark button--small" to="/workspace">My dashboard <ArrowUpRight size={16} /></Link>
        </> : <>
          <Link className="nav-button" to="/login">Sign in</Link>
          <Link className="button button--dark button--small" to="/register">Get started <ArrowUpRight size={16} /></Link>
        </>}
      </div>
      <button ref={menuButton} type="button" className="icon-button mobile-menu-button" aria-label={expanded ? 'Close menu' : 'Open menu'}
        aria-controls="mobile-navigation" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>
    <nav className="mobile-navigation" aria-label="Primary" id="mobile-navigation" hidden={!expanded}>
      <NavLink to="/courts" onClick={close}>Find a court</NavLink>
      <NavLink to="/facilities" onClick={close}>Facilities</NavLink>
      <Link to="/#how-it-works" onClick={close}>How it works</Link>
      {session ? <>
        <Link className="button button--dark" to="/workspace" onClick={close}>My dashboard <ArrowUpRight size={16} /></Link>
        <button type="button" className="nav-button" onClick={() => { signOut(); close() }}>Sign out</button>
      </> : <>
        <Link to="/login" onClick={close}>Sign in</Link>
        <Link className="button button--dark" to="/register" onClick={close}>Get started <ArrowUpRight size={16} /></Link>
      </>}
    </nav>
  </header>
}

function Footer() {
  return <footer className="site-footer">
    <div className="container footer-inner">
      <div><Brand /><p>Find. Book. Play.</p></div>
      <nav aria-label="Footer">
        <Link to="/courts">Find a court</Link>
        <Link to="/facilities">Facilities</Link>
        <Link to="/login?role=manager">Arena managers</Link>
      </nav>
      <span className="footer-location">Lahore, Pakistan</span>
    </div>
  </footer>
}

export function SiteShell() {
  const location = useLocation()
  return <><Header key={location.pathname} /><main id="main-content" tabIndex={-1}><Outlet /></main><Footer /></>
}

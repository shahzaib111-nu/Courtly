import { Fragment, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { ArrowDownLeft, ChevronDown, ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Settings, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from './ui'
import { NotificationBell } from './player-notifications'
import { initials } from './player-workspace-ui'
import { useSession } from '../lib/session'
import type { Session } from '../lib/session'
export interface WorkspaceLink {
  label: string
  to: string
  Icon: LucideIcon
  end?: boolean
}

interface WorkspaceShellProps {
  session: Session
  roleLabel: 'Player' | 'Manager' | 'Administrator'
  root: string
  title: string
  groups: { label: string; links: WorkspaceLink[] }[]
  noticeCopy?: ComponentProps<typeof NotificationBell>['copy']
  accountPath?: string
  children?: ReactNode
}

export function WorkspaceShell({ session, roleLabel, root, title, groups, noticeCopy, children, accountPath }: WorkspaceShellProps) {
  const roleName = roleLabel.toLowerCase()
  const contentId = roleName + '-content'
  const [compact, setCompact] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [focusedLink, setFocusedLink] = useState<{ label: string; top: number } | null>(null)
  const navDialog = useRef<HTMLDialogElement>(null)
  const menu = useRef<HTMLDetailsElement>(null)
  const { pathname } = useLocation()
  const { signOutToLogin } = useSession()
  function closeMenu() {
    navDialog.current?.close()
  }

  function onSidebarFocus(element: HTMLElement, label: string) {
    const bounds = element.getBoundingClientRect()
    setFocusedLink({ label, top: bounds.top + bounds.height / 2 })
  }

  function navigation(sidebar = false) {
    return <nav className="player-nav" aria-label={roleLabel + ' workspace'}>
      {groups.map(group => <Fragment key={group.label}>
        <p className="player-nav-title">{group.label}</p>
        {group.links.map(({ label, to, Icon, end }) =>
          <NavLink key={to} to={to} end={end} title={label} aria-label={label} onClick={closeMenu}
            onFocus={sidebar && compact ? event => onSidebarFocus(event.currentTarget, label) : undefined}>
            <Icon size={19} aria-hidden="true" /><span>{label}</span>
          </NavLink>)}
      </Fragment>)}
    </nav>
  }
  const roleClass = roleLabel === 'Manager' ? ' manager-shell' : roleLabel === 'Administrator' ? ' admin-shell' : ''
  return <div className={`player-shell${compact ? ' player-shell--compact' : ''}${roleClass}`}>
    <a className="skip-link" href={'#' + contentId}>Skip to content</a>
    <aside className="player-sidebar" onBlur={() => setFocusedLink(null)} onScroll={() => setFocusedLink(null)}>
      <div className="player-brand"><Brand /></div>
      {navigation(true)}
      <Link className="player-public-link" to="/" aria-label="Public site" title="Public site"
        onFocus={compact ? event => onSidebarFocus(event.currentTarget, 'Public site') : undefined}>
        <ArrowDownLeft size={19} aria-hidden="true" /><span>Public site</span>
      </Link>
    </aside>
    {compact && focusedLink && <span className="sidebar-focus-label" aria-hidden="true" style={{ top: focusedLink.top }}>{focusedLink.label}</span>}
    <dialog ref={navDialog} className="player-mobile-dialog" onClose={() => setMobileOpen(false)} aria-label={roleLabel + ' navigation'}
      onClick={event => { if (event.currentTarget === event.target) closeMenu() }}>
      <div className="player-mobile-pane">
        <div className="player-mobile-head"><Brand /><button className="player-mobile-close" type="button" aria-label={'Close ' + roleName + ' menu'} onClick={closeMenu}><X size={22} /></button></div>
        {navigation()}
        <Link className="player-public-link" to="/" onClick={closeMenu}><ArrowDownLeft size={19} aria-hidden="true" />Public site</Link>
      </div>
    </dialog>
    <div className="player-stage">
      <header className="player-topbar">
        <div className="player-topbar-left">
          <button className="icon-button player-collapse" type="button" onClick={() => setCompact(!compact)}
            aria-label={compact ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!compact}>
            {compact ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <button className="icon-button player-mobile-toggle" type="button" aria-label={'Open ' + roleName + ' menu'} aria-expanded={mobileOpen}
            onClick={() => { navDialog.current?.showModal(); setMobileOpen(true) }}><Menu size={21} /></button>
          <nav className="player-breadcrumb" aria-label="Breadcrumb">
            {pathname.replace(/\/$/, '') !== root && <><Link to={root}>Workspace</Link><ChevronRight size={14} aria-hidden="true" /></>}
            <span aria-current="page">{title}</span>
          </nav>
        </div>
        <div className="player-topbar-right">
          <NotificationBell inboxPath={root + '/notifications'} copy={noticeCopy} />
          <details ref={menu} className="player-account" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
          }} onKeyDown={event => {
            if (event.key === 'Escape' && menu.current?.open) {
              menu.current.open = false
              menu.current.querySelector('summary')?.focus()
            }
          }}>
            <summary aria-label="Account menu"><span className="player-avatar">{initials(session.name)}</span>
              <span className="player-account-name">{session.name}</span><ChevronDown size={15} aria-hidden="true" /></summary>
            <div className="player-account-popover">
              <Link to={accountPath ?? root + '/settings'} onClick={() => { if (menu.current) menu.current.open = false }}>
                <Settings size={17} aria-hidden="true" /> {accountPath ? 'Administrator inbox' : 'Account settings'}</Link>
              <button type="button" onClick={signOutToLogin}><LogOut size={17} aria-hidden="true" /> Sign out</button>
            </div>
          </details>
        </div>
      </header>
      <main id={contentId} className="player-content" tabIndex={-1}>{children ?? <Outlet context={session} />}</main>
    </div>
  </div>
}

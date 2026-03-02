'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, BookOpen, List, TrendingUp, Scale,
  LogOut, Layers, Menu, X
} from 'lucide-react'

const navItems = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ]
  },
  {
    section: 'Accounting',
    items: [
      { href: '/dashboard/accounts', icon: List, label: 'Chart of Accounts' },
      { href: '/dashboard/journal', icon: BookOpen, label: 'Journal Entries' },
    ]
  },
  {
    section: 'Reports',
    items: [
      { href: '/dashboard/reports/trial-balance', icon: Layers, label: 'Trial Balance' },
      { href: '/dashboard/reports/profit-loss', icon: TrendingUp, label: 'Profit & Loss' },
      { href: '/dashboard/reports/balance-sheet', icon: Scale, label: 'Balance Sheet' },
    ]
  },
]

export default function Sidebar({ user }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => { setOpen(false) }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.email?.charAt(0).toUpperCase() || 'U'

  const NavContent = () => (
    <>
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">L</div>
        <span className="sidebar-logo-text">LedgerPro</span>
        <button onClick={() => setOpen(false)} className="sidebar-close-btn">
          <X size={20} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {navItems.map(section => (
          <div key={section.section}>
            <p className="nav-section-title">{section.section}</p>
            {section.items.map(item => {
              const Icon = item.icon
              const isActive = item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)
              return (
                <Link key={item.href} href={item.href} className={`nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={16} />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-item" style={{ color: 'var(--text-3)' }}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </>
  )

  return (
    <>
      <div className="mobile-topbar">
        <button className="hamburger-btn" onClick={() => setOpen(true)}>
          <Menu size={22} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="sidebar-logo-mark" style={{ width: 28, height: 28, fontSize: 14 }}>L</div>
          <span className="sidebar-logo-text" style={{ fontSize: 16 }}>LedgerPro</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className="sidebar sidebar-desktop">
        <NavContent />
      </aside>

      <aside className={`sidebar sidebar-mobile ${open ? 'sidebar-mobile-open' : ''}`}>
        <NavContent />
      </aside>

      <style jsx global>{`
        .mobile-topbar {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0;
          height: 56px;
          background: var(--bg-2);
          border-bottom: 1px solid var(--border);
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          z-index: 40;
        }
        .hamburger-btn {
          background: none; border: none;
          color: var(--text); cursor: pointer;
          padding: 6px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
        }
        .hamburger-btn:hover { background: var(--bg-3); }
        .sidebar-close-btn {
          display: none;
          margin-left: auto;
          background: none; border: none;
          color: var(--text-3); cursor: pointer; padding: 4px;
        }
        .sidebar-backdrop {
          display: none;
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(2px);
          z-index: 49;
        }
        .sidebar-desktop { display: flex; flex-direction: column; }
        .sidebar-mobile {
          display: none;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 260px;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
          z-index: 50;
          flex-direction: column;
        }
        .sidebar-mobile-open { transform: translateX(0); }

        @media (max-width: 768px) {
          .mobile-topbar { display: flex; }
          .sidebar-desktop { display: none; }
          .sidebar-mobile { display: flex; }
          .sidebar-backdrop { display: block; }
          .sidebar-close-btn { display: block; }
          .main-content { margin-left: 0 !important; padding-top: 56px; }
        }
      `}</style>
    </>
  )
}

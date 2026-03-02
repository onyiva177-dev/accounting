'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, BookOpen, List, FileText, TrendingUp, Scale,
  LogOut, ChevronRight, Layers
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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = user?.email?.charAt(0).toUpperCase() || 'U'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">L</div>
        <span className="sidebar-logo-text">LedgerPro</span>
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
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                >
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
    </aside>
  )
}

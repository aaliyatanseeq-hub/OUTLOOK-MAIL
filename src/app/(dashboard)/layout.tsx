'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MailIcon, LayoutDashboardIcon, SendIcon, LayoutTemplateIcon, HistoryIcon, SettingsIcon, InboxIcon } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, badge: false },
  { href: '/send',      label: 'Send Email', icon: SendIcon,            badge: false },
  { href: '/templates', label: 'Templates',  icon: LayoutTemplateIcon,  badge: false },
  { href: '/history',   label: 'History',    icon: HistoryIcon,         badge: false },
  { href: '/inbox',     label: 'Inbox',      icon: InboxIcon,           badge: true  },
  { href: '/settings',  label: 'Settings',   icon: SettingsIcon,        badge: false },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetch('/api/inbox?unread=true&page=1')
      .then(r => r.json())
      .then(d => setUnreadCount(d.total ?? 0))
      .catch(() => {})
  }, [pathname])

  return (
    <div className="flex min-h-screen bg-slate-950">
      {/* Sidebar */}
      <nav className="w-60 shrink-0 border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-sm flex flex-col">
        {/* Brand */}
        <div className="px-5 py-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
              <MailIcon className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white tracking-tight leading-none">EmailHub</p>
              <p className="text-xs text-slate-500 mt-0.5">Transactional Mail</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname?.startsWith(item.href)
            const showBadge = item.badge && unreadCount > 0
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-200 border border-indigo-400/35'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-800/80 space-y-3">
          <ThemeToggle />
          <p className="text-xs text-slate-600">v1.0 · EmailHub</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-950/30">
        {children}
      </main>
    </div>
  )
}

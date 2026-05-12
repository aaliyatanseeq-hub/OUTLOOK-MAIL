'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { MailIcon, LayoutDashboardIcon, SendIcon, LayoutTemplateIcon, HistoryIcon, SettingsIcon, InboxIcon, ClipboardListIcon } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, badge: false },
  { href: '/send',      label: 'Send Email', icon: SendIcon,            badge: false },
  { href: '/templates', label: 'Templates',  icon: LayoutTemplateIcon,  badge: false },
  { href: '/history',   label: 'History',    icon: HistoryIcon,         badge: false },
  { href: '/inbox',     label: 'Inbox',      icon: InboxIcon,           badge: true  },
  { href: '/responses', label: 'Responses',  icon: ClipboardListIcon,   badge: false },
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
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <nav className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col shadow-sm">
        {/* Brand */}
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
              <MailIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 tracking-tight leading-none">EmailHub</p>
              <p className="text-xs text-slate-400 mt-0.5">HR Notifications</p>
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
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {showBadge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-slate-200">
          <p className="text-xs text-slate-400">v1.0 · EmailHub</p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        {children}
      </main>
    </div>
  )
}

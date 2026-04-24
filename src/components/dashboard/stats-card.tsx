'use client'

import { LucideIcon } from 'lucide-react'

interface StatsCardProps {
  title: string
  value: number
  icon: LucideIcon
  color: 'blue' | 'purple' | 'green' | 'amber' | 'emerald' | 'cyan' | 'red'
}

const colorClasses = {
  blue: 'text-indigo-300',
  purple: 'text-violet-300',
  green: 'text-emerald-300',
  amber: 'text-amber-300',
  emerald: 'text-teal-300',
  cyan: 'text-cyan-300',
  red: 'text-rose-300',
}

export function StatsCard({ title, value, icon: Icon, color }: StatsCardProps) {
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">{title}</p>
          <p className="text-3xl font-semibold text-slate-100">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg border border-slate-700/80 bg-slate-900/80 flex items-center justify-center">
          <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
        </div>
      </div>
    </div>
  )
}

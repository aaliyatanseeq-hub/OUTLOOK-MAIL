'use client'

import { StatsCard } from './stats-card'
import {
  MailCheckIcon,
  SendIcon,
  UsersIcon,
  TrendingUpIcon,
  AlertCircleIcon,
  EyeIcon,
  MousePointerClick,
} from 'lucide-react'

interface StatsGridProps {
  totalCampaigns: number
  totalRecipients: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  failed: number
}

export function StatsGrid({
  totalCampaigns,
  totalRecipients,
  sent,
  delivered,
  opened,
  clicked,
  failed,
}: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatsCard
        title="Total Campaigns"
        value={totalCampaigns}
        icon={MailCheckIcon}
        color="blue"
      />
      <StatsCard
        title="Total Recipients"
        value={totalRecipients}
        icon={UsersIcon}
        color="purple"
      />
      <StatsCard
        title="Emails Sent"
        value={sent}
        icon={SendIcon}
        color="green"
      />
      <StatsCard
        title="Delivered"
        value={delivered}
        icon={TrendingUpIcon}
        color="emerald"
      />
      <StatsCard
        title="Opened"
        value={opened}
        icon={EyeIcon}
        color="cyan"
      />
      <StatsCard
        title="Clicked"
        value={clicked}
        icon={MousePointerClick}
        color="amber"
      />
      <StatsCard
        title="Failed"
        value={failed}
        icon={AlertCircleIcon}
        color="red"
      />
    </div>
  )
}

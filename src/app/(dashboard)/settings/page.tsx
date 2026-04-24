import { SettingsPanel } from '@/components/settings/settings-panel'

export default function SettingsPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Configure and test your email provider connections.</p>
      </div>
      <SettingsPanel />
    </div>
  )
}

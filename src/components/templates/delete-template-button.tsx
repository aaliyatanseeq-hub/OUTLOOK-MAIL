'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2Icon, LoaderIcon } from 'lucide-react'

export function DeleteTemplateButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handle() {
    if (!confirm(`Delete template "${templateName}"? This cannot be undone.`)) return
    setLoading(true)
    await fetch(`/api/templates/${templateId}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <button onClick={handle} disabled={loading} title="Delete" className="text-slate-500 hover:text-rose-400 transition-colors disabled:opacity-50">
      {loading ? <LoaderIcon className="w-4 h-4 animate-spin" /> : <Trash2Icon className="w-4 h-4" />}
    </button>
  )
}

export const dynamic = 'force-dynamic'

import { ResponsesClient } from '@/components/responses/responses-client'

export default function ResponsesPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Employee Responses</h1>
        <p className="text-slate-400 text-sm mt-1">
          Structured data collected from employee email replies.
        </p>
      </div>
      <ResponsesClient />
    </div>
  )
}

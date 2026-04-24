import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { PlusIcon, MailIcon } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { DeleteTemplateButton } from '@/components/templates/delete-template-button'

export default async function TemplatesPage() {
  const templates = await prisma.template.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { emails: true } } },
  })

  return (
    <div className="page-shell">
      <div className="flex items-center justify-between">
        <div className="page-header">
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">Reusable email templates with personalisation placeholders.</p>
        </div>
        <Link href="/templates/new" className="button-primary">
          <PlusIcon className="w-4 h-4" />
          New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="card text-center py-16 space-y-4">
          <MailIcon className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400">No templates yet.</p>
          <Link href="/templates/new" className="button-primary inline-flex">
            Create your first template
          </Link>
        </div>
      ) : (
        <div className="card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-4 px-4 text-xs uppercase tracking-wide font-semibold text-slate-500">Template</th>
                <th className="text-left py-4 px-4 text-xs uppercase tracking-wide font-semibold text-slate-500">Subject</th>
                <th className="text-left py-4 px-4 text-xs uppercase tracking-wide font-semibold text-slate-500">Used</th>
                <th className="text-left py-4 px-4 text-xs uppercase tracking-wide font-semibold text-slate-500">Created</th>
                <th className="text-right py-4 px-4 text-xs uppercase tracking-wide font-semibold text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-slate-800/60 hover:bg-slate-900/40 transition-colors">
                  <td className="py-4 px-4">
                    <Link href={`/templates/${t.id}`} className="font-medium text-white hover:text-indigo-300 transition-colors">
                      {t.name}
                    </Link>
                    {t.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-sm max-w-xs truncate">{t.subject}</td>
                  <td className="py-4 px-4 text-slate-400 text-sm">{t._count.emails} email{t._count.emails !== 1 ? 's' : ''}</td>
                  <td className="py-4 px-4 text-slate-500 text-sm">{formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}</td>
                  <td className="py-4 px-4">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/send?templateId=${t.id}`} className="text-emerald-400 hover:text-emerald-300 text-sm transition-colors">
                        Use
                      </Link>
                      <Link href={`/templates/${t.id}`} className="text-indigo-300 hover:text-indigo-200 text-sm transition-colors">
                        Edit
                      </Link>
                      <DeleteTemplateButton templateId={t.id} templateName={t.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

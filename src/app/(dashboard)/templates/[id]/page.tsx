import { prisma } from '@/lib/prisma'
import { TemplateForm } from '@/components/templates/template-form'
import { redirect } from 'next/navigation'

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await prisma.template.findUnique({ where: { id: params.id } })
  if (!template) redirect('/templates')

  return (
    <div className="page-shell max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">Edit Template</h1>
        <p className="page-subtitle">{template!.name}</p>
      </div>
      <TemplateForm existing={template!} />
    </div>
  )
}

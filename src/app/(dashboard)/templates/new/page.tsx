import { TemplateForm } from '@/components/templates/template-form'

export default function NewTemplatePage() {
  return (
    <div className="page-shell max-w-2xl">
      <div className="page-header">
        <h1 className="page-title">New Template</h1>
        <p className="page-subtitle">Create a reusable email template. Use {'{{name}}'} and {'{{email}}'} as placeholders.</p>
      </div>
      <TemplateForm />
    </div>
  )
}

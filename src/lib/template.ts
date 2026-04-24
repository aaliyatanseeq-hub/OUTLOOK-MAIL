// Simple placeholder template renderer
// Supports {{name}}, {{email}}, etc.

type TemplateData = Record<string, string | number | boolean | null | undefined>

export function renderTemplate(template: string, data: TemplateData): string {
  let result = template
  
  Object.entries(data).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return
    }
    const placeholder = `{{${key}}}`
    result = result.split(placeholder).join(String(value))
  })
  
  return result
}

export function getPlaceholdersFromTemplate(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const placeholders = new Set<string>()
  let match

  while ((match = regex.exec(template)) !== null) {
    placeholders.add(match[1])
  }

  return Array.from(placeholders)
}

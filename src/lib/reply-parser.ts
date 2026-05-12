/**
 * Parses structured employee reply emails.
 *
 * Expected format in the reply body:
 *   EMPLOYEE ID        : TQ-1045
 *   WORK PHONE         : +971 4 123 4567
 *   PERSONAL PHONE     : +971 55 987 6543
 *
 * Works even if the employee includes extra spaces, different casing,
 * or the Outlook quoted thread appears below.
 */

export interface ParsedEmployeeReply {
  employeeId:    string | null
  workPhone:     string | null
  personalPhone: string | null
  parsedOk:      boolean   // true only if ALL three fields found and non-empty
}

/** Field patterns to match — flexible on spacing and casing */
const PATTERNS: Array<{ key: keyof Omit<ParsedEmployeeReply, 'parsedOk'>; regex: RegExp }> = [
  {
    key: 'employeeId',
    regex: /EMPLOYEE\s*ID\s*[:\-]\s*(.+)/i,
  },
  {
    key: 'workPhone',
    regex: /WORK\s*PHONE\s*[:\-]\s*(.+)/i,
  },
  {
    key: 'personalPhone',
    regex: /PERSONAL\s*(PHONE|NUMBER|MOBILE)\s*[:\-]\s*(.+)/i,
  },
]

/**
 * Strips the Outlook quoted reply section ("On Mon, ... wrote:") so we
 * only parse the employee's actual input, not the original email we sent.
 */
function stripQuotedThread(text: string): string {
  // Common quoted reply markers
  const markers = [
    /^On .+wrote:/im,
    /^_{5,}/m,                    // _____ separator line
    /^-{5,}/m,                    // ----- separator line
    /^From:\s+/im,
    /^Sent:\s+/im,
  ]
  let earliest = text.length
  for (const marker of markers) {
    const match = marker.exec(text)
    if (match && match.index < earliest) {
      earliest = match.index
    }
  }
  return text.slice(0, earliest).trim()
}

export function parseEmployeeReply(bodyText: string): ParsedEmployeeReply {
  const cleaned = stripQuotedThread(bodyText)

  const result: ParsedEmployeeReply = {
    employeeId:    null,
    workPhone:     null,
    personalPhone: null,
    parsedOk:      false,
  }

  for (const { key, regex } of PATTERNS) {
    const match = regex.exec(cleaned)
    if (match) {
      // For personalPhone the value is in group 2 (group 1 is PHONE/NUMBER/MOBILE)
      const raw = (key === 'personalPhone' ? match[2] : match[1]) ?? ''
      const value = raw.trim().replace(/\s+/g, ' ')
      // Ignore if still blank placeholder
      if (value && value !== '_______________' && value !== '____' && value.length > 0) {
        result[key] = value
      }
    }
  }

  result.parsedOk = !!(result.employeeId && result.workPhone && result.personalPhone)
  return result
}

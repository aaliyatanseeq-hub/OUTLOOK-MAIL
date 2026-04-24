'use client'

import { useEffect, useRef, useState } from 'react'

interface EmailFrameProps {
  html?: string | null
  text?: string | null
  snippet?: string | null
}

// Renders email HTML inside an isolated iframe — prevents the email's own CSS
// from leaking into the app and causing layout glitches (same approach Gmail uses).
export function EmailFrame({ html, text, snippet }: EmailFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(200)

  const content = html
    ? `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.7;
    color: #1e293b;
    background: #f8fafc;
    word-break: break-word;
  }
  body { padding: 20px; }
  img { max-width: 100%; height: auto; }
  a { color: #4f46e5; }
  table { max-width: 100% !important; }
  blockquote {
    border-left: 3px solid #e2e8f0;
    margin: 8px 0; padding-left: 12px;
    color: #64748b;
  }
  hr { border-color: #e2e8f0; }
</style>
</head>
<body>${html}</body>
</html>`
    : `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body {
    margin: 0; padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; line-height: 1.7;
    color: #1e293b; background: #f8fafc;
    white-space: pre-wrap; word-break: break-word;
  }
</style>
</head>
<body>${text ? escapeHtml(text) : `<span style="color:#94a3b8;font-style:italic">${snippet ?? 'No content.'}</span>`}</body>
</html>`

  // Auto-resize iframe to fit its content (no scrollbars)
  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return
    const onLoad = () => {
      try {
        const body = frame.contentDocument?.body
        if (body) {
          setHeight(body.scrollHeight + 8)
        }
      } catch {}
    }
    frame.addEventListener('load', onLoad)
    return () => frame.removeEventListener('load', onLoad)
  }, [content])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={content}
      sandbox="allow-same-origin allow-popups"
      className="w-full rounded-xl border border-slate-700"
      style={{ height, minHeight: 80, background: '#f8fafc' }}
      scrolling="no"
      title="Email content"
    />
  )
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

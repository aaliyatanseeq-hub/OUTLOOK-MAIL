'use client'

import { useEffect, useRef, useState } from 'react'

interface EmailFrameProps {
  html?: string | null
  text?: string | null
  snippet?: string | null
}

export function EmailFrame({ html, text, snippet }: EmailFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = useState(300)

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
    overflow: hidden;
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
  /* Make sure nothing is hidden or collapsed */
  * { max-height: none !important; overflow: visible !important; }
</style>
</head>
<body>${html}</body>
</html>`
    : `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  html, body {
    margin: 0; padding: 20px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px; line-height: 1.7;
    color: #1e293b; background: #f8fafc;
    white-space: pre-wrap; word-break: break-word;
    overflow: hidden;
  }
</style>
</head>
<body>${text ? escapeHtml(text) : `<span style="color:#94a3b8;font-style:italic">${snippet ?? 'No content.'}</span>`}</body>
</html>`

  function measureHeight() {
    try {
      const frame = iframeRef.current
      const doc = frame?.contentDocument
      if (!doc) return
      const body = doc.body
      const html = doc.documentElement
      if (!body || !html) return
      const h = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.scrollHeight,
        html.offsetHeight,
      )
      if (h > 0) setHeight(h + 24)
    } catch {}
  }

  useEffect(() => {
    const frame = iframeRef.current
    if (!frame) return

    function onLoad() {
      measureHeight()
      // Re-measure after a short delay for emails with slow-rendering content
      setTimeout(measureHeight, 100)
      setTimeout(measureHeight, 500)

      // Watch for any DOM changes inside the iframe (e.g. images loading)
      try {
        const observer = new ResizeObserver(measureHeight)
        if (frame.contentDocument?.body) {
          observer.observe(frame.contentDocument.body)
        }
        return () => observer.disconnect()
      } catch {}
    }

    frame.addEventListener('load', onLoad)
    return () => frame.removeEventListener('load', onLoad)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={content}
      sandbox="allow-same-origin allow-popups"
      className="w-full rounded-xl border border-slate-700"
      style={{ height, minHeight: 120, background: '#f8fafc', display: 'block' }}
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

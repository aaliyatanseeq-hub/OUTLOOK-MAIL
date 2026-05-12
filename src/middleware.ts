import { NextRequest, NextResponse } from 'next/server'

const ADMIN_HOST    = 'emailhub-tanseeq.vercel.app'   // admin dashboard
const EMPLOYEE_HOST = 'tanseeq-hr.vercel.app'          // employee form only

const NOT_FOUND_PAGE = `<!DOCTYPE html><html><head><title>Not Found</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;font-family:Arial,sans-serif;">
  <div style="text-align:center;color:#94a3b8;"><p style="font-size:14px;">Page not found.</p></div>
</body></html>`

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const { pathname } = req.nextUrl

  const isEmployeeHost = host === EMPLOYEE_HOST
  const isAdminHost    = host === ADMIN_HOST
  const isLocalhost    = host.startsWith('localhost')

  // ── Employee URL: only /respond/* and /api/respond/* allowed ──
  if (isEmployeeHost) {
    if (pathname.startsWith('/respond/') || pathname.startsWith('/api/respond/')) {
      return NextResponse.next()
    }
    return new NextResponse(NOT_FOUND_PAGE, { status: 404, headers: { 'Content-Type': 'text/html' } })
  }

  // ── Admin URL or localhost: full access ──
  if (isAdminHost || isLocalhost) {
    return NextResponse.next()
  }

  // ── Any other URL (auto-generated Vercel URLs etc.): block admin, allow employee form ──
  if (pathname.startsWith('/respond/') || pathname.startsWith('/api/respond/')) {
    return NextResponse.next()
  }
  return new NextResponse(NOT_FOUND_PAGE, { status: 404, headers: { 'Content-Type': 'text/html' } })
}

export const config = {
  // Run on all routes except static files and _next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
}

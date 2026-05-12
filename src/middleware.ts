import { NextRequest, NextResponse } from 'next/server'

// The employee-facing hostname — only /respond/* is allowed here
const EMPLOYEE_HOST = 'tanseeq-hr.vercel.app'

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? ''
  const { pathname } = req.nextUrl

  // If request is coming from the employee URL
  if (host === EMPLOYEE_HOST) {
    // Only allow /respond/* routes and their API counterpart
    if (
      pathname.startsWith('/respond/') ||
      pathname.startsWith('/api/respond/')
    ) {
      return NextResponse.next()
    }

    // Block everything else — show a clean not-found page
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Not Found</title><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
      <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#020617;font-family:Arial,sans-serif;">
        <div style="text-align:center;color:#94a3b8;">
          <p style="font-size:14px;">Page not found.</p>
        </div>
      </body></html>`,
      { status: 404, headers: { 'Content-Type': 'text/html' } },
    )
  }

  return NextResponse.next()
}

export const config = {
  // Run on all routes except static files and _next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)'],
}

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Email Campaign Manager',
  description: 'Modern email campaign management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme');if(!t||t==='dark'){localStorage.setItem('theme','light');document.documentElement.dataset.theme='light';}})();`,
          }}
        />
      </head>
      <body className="bg-slate-100 text-slate-900 antialiased" data-theme="light">
        {children}
      </body>
    </html>
  )
}

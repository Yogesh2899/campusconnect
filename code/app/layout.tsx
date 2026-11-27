import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

export const metadata: Metadata = {
  title: 'Thapar Connect — Better conversations start here',
  description: 'Find your professors, book a meeting, and make the most of every conversation at Thapar Institute.',
  generator: 'Thapar Connect',
  icons: {
    icon: { url: '/thapar-logo.png', type: 'image/png', sizes: '192x192' },
    apple: '/thapar-logo.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f0f5ff',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          {children}
          {process.env.NODE_ENV === 'production' && <Analytics />}
        </ThemeProvider>
      </body>
    </html>
  )
}

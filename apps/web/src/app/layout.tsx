import type { Metadata } from 'next'
import { Sora, Manrope } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from '@/components/toaster'

// GlobFam Craefto Brand Fonts
const sora = Sora({
  subsets: ['latin'],
  weight: ['800'],
  variable: '--font-sora',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GlobFam - Multi-currency Family Finance Platform',
  description: 'Track your family finances across borders with multi-currency support',
  keywords: 'family finance, multi-currency, international students, money management',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${sora.variable} font-sans`} style={{ fontFamily: 'var(--font-manrope), sans-serif' }}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
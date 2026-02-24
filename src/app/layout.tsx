import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'
import { SessionProvider } from '@/components/layout/SessionProvider'
import { auth } from '@/auth'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'JusChill — For the Artists, Dreamers, and the Unseen',
  description: 'Create, record, produce, and share your art. Built for the 99% who were told to fit the algorithm.',
  keywords: ['music', 'art', 'creators', 'independent artists', 'recording studio', 'JusChill'],
  openGraph: {
    title: 'JusChill',
    description: 'Your studio. Your stage. No algorithm needed.',
    type: 'website',
    siteName: 'JusChill',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JusChill',
    description: 'Your studio. Your stage.',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-surface-0 text-white antialiased`}>
        <SessionProvider session={session}>
          {children}
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}

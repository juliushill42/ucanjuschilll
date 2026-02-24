import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'JusChill — For the Artists, Dreamers, and the Unseen',
  description: 'The platform where your art speaks. Record. Produce. Publish. Jus Chill.',
  openGraph: {
    title: 'JusChill',
    description: 'Studio + Stage. One platform. Built for the 99%.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-dark-950 text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

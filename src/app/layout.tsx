import RootLayoutClient from '@/components/RootLayoutClient';
import ThirdPartyScripts from '@/components/analytics/ThirdPartyScripts';
import { Geist_Mono, Space_Grotesk } from 'next/font/google';
import './critical.css';
import './globals.css';
import { metadata } from './metadata';

// Load Space Grotesk through Next.js optimization
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  preload: true
});

const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en'>
      <head>
        <link rel='manifest' href='/manifest.json' />
        <link rel='alternate' type='application/rss+xml' title='Fast Takeoff News RSS' href='/rss' />
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsMediaOrganization",
            "name": "Fast Takeoff News",
            "url": "https://news.fasttakeoff.org",
            "logo": "https://news.fasttakeoff.org/favicon.ico",
            "sameAs": [
              "https://twitter.com/fasttakeoff"
            ]
          })}
        </script>
      </head>
      <body
        className={`${spaceGrotesk.className} ${geistMono.variable} antialiased min-h-screen flex flex-col justify-center mx-auto`}
      >
        <RootLayoutClient>{children}</RootLayoutClient>
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
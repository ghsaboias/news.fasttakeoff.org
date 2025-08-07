import RootLayoutClient from '@/components/RootLayoutClient';
import ThirdPartyScripts from '@/components/analytics/ThirdPartyScripts';
import { Carlito, Geist_Mono } from 'next/font/google';
import './critical.css';
import './globals.css';
import { metadata } from './metadata';

// Load Space Grotesk through Next.js optimization
const carlito = Carlito({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  weight: ['400', '700']
});

const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' className="dark">
      <head>
        <link rel='manifest' href='/manifest.json' />
        <link rel='alternate' type='application/rss+xml' title='Fast Takeoff News RSS' href='/rss' />

        {/* Resource Hints for Twitter Embeds Performance */}
        <link rel='preconnect' href='https://platform.twitter.com' />
        <link rel='preconnect' href='https://cdn.syndication.twimg.com' />
        <link rel='preconnect' href='https://abs.twimg.com' />
        <link rel='preconnect' href='https://pbs.twimg.com' />
        <link rel='dns-prefetch' href='https://syndication.twitter.com' />
        <link rel='dns-prefetch' href='https://analytics.twitter.com' />

        {/* Twitter Widget Performance Optimizations */}
        <meta name="twitter:widgets:autoload" content="off" />
        <meta name="twitter:widgets:theme" content="dark" />
        <meta name="twitter:dnt" content="on" />
        <meta name="twitter:widgets:csp" content="on" />

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
        className={`${carlito.className} ${geistMono.variable} antialiased min-h-screen flex flex-col justify-center mx-auto bg-dark-950 text-dark-100`}
      >
        <RootLayoutClient>{children}</RootLayoutClient>
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
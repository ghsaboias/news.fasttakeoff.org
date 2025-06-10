import RootLayoutClient from '@/components/RootLayoutClient';
import { Geist_Mono, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
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

        {/* Google Analytics - Load after user interaction */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-ZZQ4KRK7H5" strategy="lazyOnload" />
        <Script id="google-analytics" strategy="lazyOnload">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-ZZQ4KRK7H5');
          `}
        </Script>
        {/* Google News Showcase - Load after user interaction */}
        <Script src="https://news.google.com/swg/js/v1/swg-basic.js" strategy="lazyOnload" />
        <Script id="google-news-showcase" strategy="lazyOnload">
          {`
            (self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
              basicSubscriptions.init({
                type: "NewsArticle",
                isPartOfType: ["Product"],
                isPartOfProductId: "CAownKXbCw:openaccess",
                clientOptions: { theme: "light", lang: "en" },
              });
            });
          `}
        </Script>
      </head>
      <body
        className={`${spaceGrotesk.className} ${geistMono.variable} antialiased min-h-screen flex flex-col justify-center mx-auto`}
      >
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
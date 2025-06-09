import RootLayoutClient from '@/components/RootLayoutClient';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { metadata } from './metadata';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export { metadata };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
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
          {/* Preload Clerk's core script */}
          <link
            rel='preload'
            href='https://clerk.fasttakeoff.org/npm/@clerk/clerk-js@latest/dist/clerk.browser.js'
            as='script'
            crossOrigin='anonymous'
          />
          {/* Preload Clerk's OAuth script */}
          <link
            rel='preload'
            href='https://clerk.fasttakeoff.org/npm/@clerk/clerk-js@latest/dist/clerk.oauth.js'
            as='script'
            crossOrigin='anonymous'
          />
          {/* Google Analytics */}
          <Script src="https://www.googletagmanager.com/gtag/js?id=G-ZZQ4KRK7H5" strategy="afterInteractive" />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-ZZQ4KRK7H5');
            `}
          </Script>
          {/* Google News Showcase */}
          <Script src="https://news.google.com/swg/js/v1/swg-basic.js" strategy="afterInteractive" />
          <Script id="google-news-showcase" strategy="afterInteractive">
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
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col justify-center mx-auto`}
        >
          <RootLayoutClient>{children}</RootLayoutClient>
        </body>
      </html>
    </ClerkProvider>
  );
}
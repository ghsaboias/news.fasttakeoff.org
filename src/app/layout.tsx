'use client';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { ClerkProvider } from '@clerk/nextjs';
import { Geist, Geist_Mono } from 'next/font/google';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const showHeaderAndFooter = pathname !== '/news-globe';

  return (
    <ClerkProvider>
      <html lang='en'>
        <head>
          <link rel='manifest' href='/manifest.json' />
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
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col justify-center mx-auto`}
        >
          {showHeaderAndFooter && <Header />}
          <main className='flex flex-1 justify-center items-start'>{children}</main>
          {showHeaderAndFooter && <Footer />}
        </body>
      </html>
    </ClerkProvider>
  );
}
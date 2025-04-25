import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fast Takeoff News',
  description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
  icons: {
    icon: [
      { url: '/images/brain.png', type: 'image/png', sizes: '1024x1024' },
    ],
    apple: '/images/brain-180.png',
  },
  openGraph: {
    title: 'Fast Takeoff News',
    description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
    url: 'https://news.fasttakeoff.org',
    siteName: 'Fast Takeoff News',
    images: [
      {
        url: 'https://news.fasttakeoff.org/images/og-screenshot.png',
        width: 1200,
        height: 630,
        alt: 'Fast Takeoff News - AI-powered news for everyone',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fast Takeoff News',
    description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
    images: [{
      url: 'https://news.fasttakeoff.org/images/og-screenshot.png',
      width: 1200,
      height: 630,
      alt: 'Fast Takeoff News - AI-powered news for everyone',
      type: 'image/png',
    }],
    creator: '@fasttakeoff',
    site: '@fasttakeoff',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col justify-center mx-auto`}
        >
          <Header />
          <main className='flex flex-1 justify-center items-start'>{children}</main>
          <Footer />
        </body>
      </html>
    </ClerkProvider>
  );
}
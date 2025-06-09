import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Fast Takeoff News',
    description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
    icons: {
        icon: [
            { url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32' },
        ],
        apple: '/images/brain-180.webp',
    },
    openGraph: {
        title: 'Fast Takeoff News',
        description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
        url: 'https://news.fasttakeoff.org',
        siteName: 'Fast Takeoff News',
        images: [
            {
                url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
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
            url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
            width: 1200,
            height: 630,
            alt: 'Fast Takeoff News - AI-powered news for everyone',
            type: 'image/webp',
        }],
        creator: '@fasttakeoff',
        site: '@fasttakeoff',
    },
}; 
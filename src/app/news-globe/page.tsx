import NewsGlobe from '@/components/NewsGlobe';

export async function generateMetadata() {
    return {
        title: 'News Globe - Fast Takeoff News',
        description: 'Interactive global news visualization.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/news-globe'
        }
    };
}

export default function NewsGlobePage() {
    return <NewsGlobe />;
} 
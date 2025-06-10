import NewsGlobeClient from './NewsGlobeClient';

export async function generateMetadata() {
    return {
        title: 'News Globe - Fast Takeoff News',
        description: 'Interactive 3D visualization of global news coverage.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/news-globe'
        }
    };
}

export default function NewsGlobePage() {
    return <NewsGlobeClient />;
} 
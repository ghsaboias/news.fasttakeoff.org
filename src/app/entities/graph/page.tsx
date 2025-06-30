import { Metadata } from 'next';
import EntityGraphClient from './EntityGraphClient';

export const metadata: Metadata = {
    title: 'Entity Graph - Fast Takeoff',
    description: 'Interactive visualization of entities and their connections from news reports.',
    keywords: 'entity graph, news analysis, data visualization, connected entities',
};

export default function EntityGraphPage() {
    return <EntityGraphClient />;
} 
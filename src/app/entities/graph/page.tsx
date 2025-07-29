import { Metadata } from 'next';
import EntityGraphClientWrapper from './EntityGraphClientWrapper';

export const metadata: Metadata = {
    title: 'Entity Graph - Fast Takeoff',
    description: 'Interactive visualization of entity relationships',
    keywords: 'entity graph, relationships, visualization, network',
};

export default function EntityGraphPage() {
    return <EntityGraphClientWrapper />;
} 
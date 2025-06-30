import { Metadata } from 'next';
import EntitiesClient from './EntitiesClient';

export const metadata: Metadata = {
    title: 'Entities - Fast Takeoff',
    description: 'Explore key entities mentioned in news reports',
    keywords: 'entities, people, organizations, locations, news analysis',
};

export default function EntitiesPage() {
    return <EntitiesClient />;
} 
import { Metadata } from 'next';
import NetworkVisualization from './NetworkVisualization';

export const metadata: Metadata = {
    title: 'Power Network - Fast Takeoff',
    description: 'Interactive visualization of influential people, companies, and funds shaping the global economy',
    keywords: 'power network, influence mapping, tech leaders, venture capital, business connections',
};

export default function PowerNetworkPage() {
    return <NetworkVisualization />
} 
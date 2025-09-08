import { useEffect, useState } from 'react';
import { GraphEntitiesResponse } from '../types/core';

interface Entity {
    type: 'person' | 'company' | 'fund';
    name: string;
    country?: string;
}

interface Relationship {
    from: string;
    to: string;
    type: string;
}

export interface GraphData {
    entities: Record<string, Entity>;
    relationships: Relationship[];
}

export function useGraphData() {
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                console.log('Fetching graph data...');
                const response = await fetch('/data/graph.json');
                if (!response.ok) throw new Error('Failed to load network data');
                const data = await response.json() as GraphEntitiesResponse;
                console.log('Graph data fetched successfully:', data);
                const relationships = data.relationships.map(([from, to, type]: [string, string, string]) => ({ from, to, type }));
                setGraphData({ entities: data.entities, relationships });
                setLoading(false);
            } catch (err) {
                console.error('Error loading graph data:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
                setLoading(false);
            }
        }
        loadData();
    }, []);

    console.log('useGraphData state:', { graphData, loading, error });
    return { graphData, loading, error };
} 
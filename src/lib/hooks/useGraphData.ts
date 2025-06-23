import { useEffect, useState } from 'react';

interface Entity {
    type: string;
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
                const response = await fetch('/data/graph.json');
                if (!response.ok) throw new Error('Failed to load network data');
                const data = await response.json();
                setGraphData(data);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setLoading(false);
            }
        }
        loadData();
    }, []);

    return { graphData, loading, error };
} 
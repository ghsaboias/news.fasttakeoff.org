import { useEffect, useState } from 'react';

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
                console.log('Fetching graph data from D1 database...');

                // Fetch entities and relationships from new API endpoints
                const [entitiesResponse, relationshipsResponse] = await Promise.all([
                    fetch('/api/power-network/entities'),
                    fetch('/api/power-network/relationships')
                ]);

                if (!entitiesResponse.ok || !relationshipsResponse.ok) {
                    throw new Error('Failed to load network data from database');
                }

                const entitiesData = await entitiesResponse.json();
                const relationshipsData = await relationshipsResponse.json();

                console.log('Graph data fetched successfully from D1:', {
                    entitiesCount: Object.keys(entitiesData.entities).length,
                    relationshipsCount: relationshipsData.relationships.length
                });

                const relationships = relationshipsData.relationships.map(([from, to, type]: [string, string, string]) => ({
                    from, to, type
                }));

                setGraphData({
                    entities: entitiesData.entities,
                    relationships
                });
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
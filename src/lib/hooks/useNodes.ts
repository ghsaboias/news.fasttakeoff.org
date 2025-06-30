import { useEffect, useRef } from 'react';
import { GraphNode, TransformedGraphData } from '../types/core';

type GenericGraphData = TransformedGraphData | { entities: Record<string, Omit<GraphNode, 'id' | 'relevance' | 'connectionCount'>>; relationships: { from: string, to: string }[] } | null;

export interface Node extends GraphNode {
    country?: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

export function useNodes(graphData: GenericGraphData, isMobile: boolean) {
    const nodesRef = useRef<Node[]>([]);

    useEffect(() => {
        if (!graphData?.entities || !graphData?.relationships) {
            nodesRef.current = [];
            return;
        }

        const { entities, relationships } = graphData;
        const entityList = Object.entries(entities);

        // Check if connection count is pre-calculated
        const hasPrecalculatedConnections = entityList.length > 0 && 'connectionCount' in entityList[0][1];

        const connectionCounts: Record<string, number> = {};
        if (!hasPrecalculatedConnections) {
            const seenPairs = new Set<string>();
            relationships.forEach(rel => {
                // Deduplicate by unordered pair so multiple edges count once
                const pairKey = [rel.from, rel.to].sort().join('|');
                if (seenPairs.has(pairKey)) return;
                seenPairs.add(pairKey);

                connectionCounts[rel.from] = (connectionCounts[rel.from] || 0) + 1;
                connectionCounts[rel.to] = (connectionCounts[rel.to] || 0) + 1;
            });
        }

        // Generate nodes from entities
        const nodes: Node[] = entityList.map(([id, entity]) => {
            const connectionCount = hasPrecalculatedConnections
                ? (entity as GraphNode).connectionCount
                : connectionCounts[id] || 0;

            // Scale radius based on connections
            const minRadius = 5;
            const maxRadius = 30;
            const connectionScale = Math.min(connectionCount / 15, 1);
            const radius = minRadius + (maxRadius - minRadius) * connectionScale;

            return {
                id,
                ...entity,
                relevance: (entity as GraphNode).relevance ?? 0,
                x: Math.random() * 800,
                y: Math.random() * 600,
                vx: 0,
                vy: 0,
                radius: isMobile ? radius * 1.2 : radius,
                connectionCount,
            };
        });

        nodesRef.current = nodes;
    }, [graphData, isMobile]);

    return { nodesRef };
} 
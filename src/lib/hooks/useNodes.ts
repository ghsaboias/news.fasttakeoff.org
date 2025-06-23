import { useEffect, useRef } from 'react';
import { GraphData } from './useGraphData';

interface Entity {
    type: string;
    name: string;
    country?: string;
}

export interface Node extends Entity {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    connectionCount: number;
}

export function useNodes(graphData: GraphData | null, isMobile: boolean) {
    const nodesRef = useRef<Node[]>([]);

    useEffect(() => {
        if (!graphData) {
            nodesRef.current = [];
            return;
        }

        // Calculate connection counts for each entity
        const connectionCounts: Record<string, number> = {};
        graphData.relationships.forEach(rel => {
            connectionCounts[rel.from] = (connectionCounts[rel.from] || 0) + 1;
            connectionCounts[rel.to] = (connectionCounts[rel.to] || 0) + 1;
        });

        // Generate nodes from entities
        const nodes: Node[] = Object.keys(graphData.entities).map((id) => {
            const entity = graphData.entities[id];
            const connectionCount = connectionCounts[id] || 0;

            // Scale radius based on connections (min 15, max 40 for desktop)
            const minRadius = entity.type === 'person' ? 20 : 15;
            const maxRadius = entity.type === 'person' ? 40 : 35;
            const connectionScale = Math.min(connectionCount / 20, 1); // Cap at 20 connections
            const baseRadius = minRadius + (maxRadius - minRadius) * connectionScale;
            const mobileRadius = isMobile ? baseRadius + 15 : baseRadius;

            return {
                id,
                ...entity,
                x: Math.random() * 800 + 100, // Default canvas size assumption
                y: Math.random() * 600 + 100,
                vx: 0,
                vy: 0,
                radius: mobileRadius,
                connectionCount,
            };
        });

        nodesRef.current = nodes;
    }, [graphData, isMobile]);

    const rebuildNodes = (canvasWidth: number, canvasHeight: number) => {
        nodesRef.current.forEach(node => {
            node.x = Math.random() * (canvasWidth - 200) + 100;
            node.y = Math.random() * (canvasHeight - 200) + 100;
        });
    };

    return { nodesRef, rebuildNodes };
} 
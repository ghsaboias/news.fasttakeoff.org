import { useEffect, useMemo, useRef } from 'react';
import { GraphNode, TransformedGraphData } from '../types/entities';

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

    const hasPrecalculatedConnections = useMemo(() => {
        if (!graphData?.entities) return false;
        const entityList = Object.entries(graphData.entities);
        return entityList.length > 0 && 'connectionCount' in entityList[0][1];
    }, [graphData?.entities]);

    const connectionCounts = useMemo(() => {
        if (!graphData?.relationships || hasPrecalculatedConnections) return {};
        const counts: Record<string, number> = {};
        const seenPairs = new Set<string>();
        graphData.relationships.forEach(rel => {
            const pairKey = [rel.from, rel.to].sort().join('|');
            if (seenPairs.has(pairKey)) return;
            seenPairs.add(pairKey);
            counts[rel.from] = (counts[rel.from] || 0) + 1;
            counts[rel.to] = (counts[rel.to] || 0) + 1;
        });
        return counts;
    }, [graphData?.relationships, hasPrecalculatedConnections]);

    const processedNodes = useMemo(() => {
        if (!graphData?.entities) return [];
        return Object.entries(graphData.entities).map(([id, entity]) => {
            const connectionCount = hasPrecalculatedConnections
                ? (entity as GraphNode).connectionCount
                : connectionCounts[id] || 0;
            let financialValue = 0;
            if (entity.netWorth) {
                financialValue = entity.netWorth;
            } else if (entity.marketCap) {
                financialValue = entity.marketCap * 1000;
            } else if (entity.aum) {
                financialValue = entity.aum * 1000;
            }
            let radius;
            if (financialValue > 0) {
                radius = 5 + Math.log1p(financialValue) * 3;
            } else {
                const minRadius = 5;
                const maxRadius = 30;
                const maxConnections = 15;
                const connectionScale = Math.min(connectionCount / maxConnections, 1);
                radius = minRadius + (maxRadius - minRadius) * connectionScale;
            }
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
    }, [graphData?.entities, hasPrecalculatedConnections, connectionCounts, isMobile]);

    useEffect(() => {
        nodesRef.current = processedNodes;
    }, [processedNodes]);

    return { nodesRef };
} 
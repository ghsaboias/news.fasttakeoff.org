import { useCallback } from 'react';
import { Node } from './useNodes';

interface Relationship {
    from: string;
    to: string;
    type: string;
}

export function useForceSimulation(
    nodesRef: React.MutableRefObject<Node[]>,
    relationships?: Relationship[]
) {
    const tick = useCallback(() => {
        if (!relationships) return;

        const nodes = nodesRef.current;

        // Apply damping
        nodes.forEach((node) => {
            node.vx *= 0.9;
            node.vy *= 0.9;
        });

        // Repulsion between all nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x - nodes[i].x;
                const dy = nodes[j].y - nodes[i].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const force = 1000 / (distance * distance);
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;

                    nodes[i].vx -= fx;
                    nodes[i].vy -= fy;
                    nodes[j].vx += fx;
                    nodes[j].vy += fy;
                }
            }
        }

        // Attraction for connected nodes
        relationships.forEach((rel) => {
            const nodeA = nodes.find((n) => n.id === rel.from);
            const nodeB = nodes.find((n) => n.id === rel.to);

            if (nodeA && nodeB) {
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const targetDistance = 150;

                if (distance > 0) {
                    const force = (distance - targetDistance) * 0.01;
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;

                    nodeA.vx += fx;
                    nodeA.vy += fy;
                    nodeB.vx -= fx;
                    nodeB.vy -= fy;
                }
            }
        });

        // Update positions
        nodes.forEach((node) => {
            node.x += node.vx;
            node.y += node.vy;
        });
    }, [nodesRef, relationships]);

    return tick;
} 
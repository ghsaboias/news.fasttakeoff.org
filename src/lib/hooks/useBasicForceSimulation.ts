import { useCallback } from 'react';
import { Node } from './useNodes';

interface Relationship {
    from: string;
    to: string;
    type: string;
}

/**
 * A lightweight force-directed simulation identical to the original
 * implementation used by the Power-Network prior to the entity-graph refactor.
 *  • Inverse-square repulsion between every pair of nodes.
 *  • Spring-like attraction for linked nodes toward a target distance.
 *  • Simple damping applied every tick.
 */
export function useBasicForceSimulation(
    nodesRef: React.MutableRefObject<Node[]>,
    relationships?: Relationship[]
) {
    const tick = useCallback(() => {
        if (!relationships) return;

        const nodes = nodesRef.current;

        // 1. Damping
        nodes.forEach((node) => {
            node.vx *= 0.9;
            node.vy *= 0.9;
        });

        // 2. Repulsion (inverse-square law)
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distanceSq = dx * dx + dy * dy;
                if (distanceSq === 0) continue;

                const distance = Math.sqrt(distanceSq);
                const force = 1000 / distanceSq; // original constant
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;

                nodeA.vx -= fx;
                nodeA.vy -= fy;
                nodeB.vx += fx;
                nodeB.vy += fy;
            }
        }

        // 3. Attraction for linked nodes (spring toward 150px)
        const targetDistance = 150;
        relationships.forEach((rel) => {
            const nodeA = nodes.find((n) => n.id === rel.from);
            const nodeB = nodes.find((n) => n.id === rel.to);
            if (!nodeA || !nodeB) return;

            const dx = nodeB.x - nodeA.x;
            const dy = nodeB.y - nodeA.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance === 0) return;

            const force = (distance - targetDistance) * 0.01; // original coeff
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            nodeA.vx += fx;
            nodeA.vy += fy;
            nodeB.vx -= fx;
            nodeB.vy -= fy;
        });

        // 4. Integrate velocities
        nodes.forEach((node) => {
            node.x += node.vx;
            node.y += node.vy;
        });
    }, [nodesRef, relationships]);

    return tick;
} 
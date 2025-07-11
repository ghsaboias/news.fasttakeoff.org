import { useCallback } from 'react';
import { Node } from './useNodes';

interface Relationship {
    from: string;
    to: string;
    type: string;
    strength?: number;
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

        // Repulsion and Collision
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const nodeA = nodes[i];
                const nodeB = nodes[j];
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                let distance = Math.sqrt(dx * dx + dy * dy);

                // Repulsion force
                if (distance > 0) {
                    const force = -200 / distance; // Increased base repulsion
                    const fx = (dx / distance) * force;
                    const fy = (dy / distance) * force;

                    nodeA.vx += fx;
                    nodeA.vy += fy;
                    nodeB.vx -= fx;
                    nodeB.vy -= fy;
                }

                // Collision detection
                const minDistance = (nodeA.radius || 10) + (nodeB.radius || 10);
                if (distance < minDistance) {
                    distance = distance === 0 ? 0.1 : distance; // Prevent division by zero
                    const overlap = minDistance - distance;
                    const fx = (dx / distance) * overlap * 0.5;
                    const fy = (dy / distance) * overlap * 0.5;

                    nodeA.vx -= fx;
                    nodeA.vy -= fy;
                    nodeB.vx += fx;
                    nodeB.vy += fy;
                }
            }
        }

        // Relationship type multipliers
        const typeMultipliers: Record<string, number> = {
            'owns_majority_stake_in': 3.5,
            'controlling_shareholder_of': 3.5,
            'founder_and_majority_owner': 3.5,
            'major_shareholder_in': 3.0,
            'lead_investor_in': 3.0,
            'strategic_investor_in': 3.0,
            'founder_and_ceo_of': 2.5,
            'executive_chairman_of': 2.5,
            'managing_partner_of': 2.5,
            'board_member_of': 2.0,
            'independent_director_of': 2.0,
            'advisory_board_member_of': 2.0
        };

        // Attraction for connected nodes (Link force)
        relationships.forEach((rel) => {
            const nodeA = nodes.find((n) => n.id === rel.from);
            const nodeB = nodes.find((n) => n.id === rel.to);

            if (nodeA && nodeB) {
                const dx = nodeB.x - nodeA.x;
                const dy = nodeB.y - nodeA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Use link strength to influence the force
                const multiplier = typeMultipliers[rel.type] || 1.0;
                const linkStrength = (rel.strength ? rel.strength : 0.005) * multiplier;
                const force = linkStrength * distance;

                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;

                nodeA.vx += fx;
                nodeA.vy += fy;
                nodeB.vx -= fx;
                nodeB.vy -= fy;
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
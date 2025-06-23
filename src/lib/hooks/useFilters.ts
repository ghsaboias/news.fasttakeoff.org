import { useState } from 'react';

interface Node {
    id: string;
    type: string;
    name: string;
    connectionCount: number;
}

interface Relationship {
    from: string;
    to: string;
    type: string;
}

export function useFilters() {
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState<Record<'person' | 'company' | 'fund', boolean>>({
        person: true,
        company: true,
        fund: true
    });

    const toggleFilter = (type: 'person' | 'company' | 'fund') => {
        setFilters(prev => ({ ...prev, [type]: !prev[type] }));
    };

    const isNodeVisible = (
        node: Node,
        selectedNode: Node | null,
        relationships?: Relationship[]
    ): boolean => {
        if (selectedNode && relationships) {
            // Always show the selected node itself
            if (node.id === selectedNode.id) return true;

            // Show nodes directly connected to the selected node (ignore search term)
            const isConnected = relationships.some((rel) =>
                (rel.from === selectedNode.id && rel.to === node.id) ||
                (rel.to === selectedNode.id && rel.from === node.id)
            );
            if (isConnected) {
                // Respect type filters so user can still hide entire categories
                return filters[node.type as 'person' | 'company' | 'fund'];
            }
        }

        // Regular filtering when nothing selected (or not connected)
        if (!filters[node.type as 'person' | 'company' | 'fund']) return false;
        if (searchTerm.trim()) {
            return node.name.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    };

    return {
        searchTerm,
        setSearchTerm,
        filters,
        toggleFilter,
        isNodeVisible
    };
} 
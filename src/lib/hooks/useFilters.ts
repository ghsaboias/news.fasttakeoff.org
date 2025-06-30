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

const DEFAULT_TYPES = ['person', 'company', 'fund'];

export function useFilters(entityTypes: string[] = DEFAULT_TYPES) {
    const [searchTerm, setSearchTerm] = useState('');

    const initialFilters = entityTypes.reduce((acc, type) => {
        acc[type.toLowerCase()] = true;
        return acc;
    }, {} as Record<string, boolean>);

    const [filters, setFilters] = useState<Record<string, boolean>>(initialFilters);

    const toggleFilter = (type: string) => {
        setFilters(prev => ({ ...prev, [type.toLowerCase()]: !prev[type.toLowerCase()] }));
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
                return filters[node.type.toLowerCase()];
            }
        }

        // Regular filtering when nothing selected (or not connected)
        if (!filters[node.type.toLowerCase()]) return false;
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
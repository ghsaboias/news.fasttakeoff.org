'use client';

import { Loader } from '@/components/ui/loader';
import { ENTITY_COLORS, ENTITY_LABELS } from '@/lib/config';
import { useApi } from '@/lib/hooks';
import { GraphData, GraphLink, GraphNode, TransformedGraphData } from '@/lib/types/core';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import {
    useCanvasCamera,
    useFilters,
    useForceSimulation,
    useMobileBreakpoint,
    useNetworkRenderer,
    useNodes,
    useNodeSelection,
    type Node
} from '../../../lib/hooks';

const ENTITY_TYPES = Object.keys(ENTITY_LABELS);

const fetchGraphData = async (): Promise<TransformedGraphData> => {
    const response = await fetch('/api/entities?format=graph');
    if (!response.ok) {
        throw new Error(`Failed to fetch graph data: ${response.statusText}`);
    }
    const data: GraphData = await response.json();

    // The API returns { nodes, links }. We need to transform it for the hooks.
    return {
        entities: data.nodes.reduce((acc: { [key: string]: GraphNode }, node: GraphNode) => {
            acc[node.id] = node;
            return acc;
        }, {}),
        relationships: data.links.map((link: GraphLink) => ({
            from: link.source,
            to: link.target,
            type: 'co-occurrence',
            strength: link.strength
        })),
    };
};

export default function EntityGraphClient() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showTopConnected, setShowTopConnected] = useState(false);

    // Data & layout
    const { data: graphData, loading, error } = useApi<TransformedGraphData>(fetchGraphData);

    const isMobile = useMobileBreakpoint(768);
    const { filters, searchTerm, setSearchTerm, toggleFilter, isNodeVisible } = useFilters(ENTITY_TYPES);

    // Nodes & physics
    const { nodesRef } = useNodes(graphData, isMobile);
    const tick = useForceSimulation(nodesRef, graphData?.relationships);

    // Camera & interaction
    const { cameraRef, onWheel, onPanStart, onPanMove, onPanEnd, onTouchStart, onTouchMove, onTouchEnd, centerOnNode } = useCanvasCamera();

    // Node selection with proper isNodeVisible binding
    const isNodeVisibleBound = (node: Node) => isNodeVisible(node, selectedNode, graphData?.relationships);
    const { selectedNode, setSelectedNode, canvasHandlers } = useNodeSelection(nodesRef, cameraRef, isNodeVisibleBound);

    // Rendering
    useNetworkRenderer({
        canvasRef,
        nodesRef,
        relationships: graphData?.relationships,
        cameraRef,
        selectedNode,
        isNodeVisible: isNodeVisibleBound,
        tick,
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-900">
                <div className="text-center">
                    <Loader size="lg" className="mx-auto mb-4" />
                    <p className="text-lg text-white">Loading Entity Graph...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-900">
                <div className="text-red-400 text-lg">Error: {error.message}</div>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full overflow-hidden">
            <Link
                href="/entities"
                className="absolute top-5 left-5 z-10 opacity-100"
            >
                <Image src="/images/brain_transparent.webp" alt="Return to entity list" width={32} height={32} />
            </Link>

            <div className="absolute top-4 left-20 bg-gray-800 p-2 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 z-20">
                <input
                    type="text"
                    placeholder="Search entities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-700 text-white text-xs px-2 py-1 rounded focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                    {ENTITY_TYPES.map((type) => (
                        <label key={type} className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={filters[type.toLowerCase()]}
                                onChange={() => toggleFilter(type.toLowerCase())}
                                className="accent-cyan-400 h-3 w-3"
                            />
                            <span className="capitalize">{ENTITY_LABELS[type]}</span>
                        </label>
                    ))}
                </div>
            </div>

            <canvas
                ref={canvasRef}
                className="w-full h-full bg-gray-900 cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onMouseDown={(e) => {
                    const result = canvasHandlers.onMouseDown(e);
                    if (result.type === 'pan') {
                        onPanStart(result.startPos.x, result.startPos.y);
                    }
                }}
                onMouseMove={(e) => {
                    const result = canvasHandlers.onMouseMove(e);
                    if (result.type === 'pan') {
                        onPanMove(result.clientPos.x, result.clientPos.y);
                    }
                }}
                onMouseUp={() => {
                    canvasHandlers.onMouseUp();
                    onPanEnd();
                }}
                onTouchStart={(e) => {
                    onTouchStart(e);
                    const result = canvasHandlers.onTouchStart(e);
                    if (result.type === 'pan') {
                        onPanStart(result.startPos.x, result.startPos.y);
                    }
                }}
                onTouchMove={(e) => {
                    onTouchMove(e);
                    const result = canvasHandlers.onTouchMove(e);
                    if (result.type === 'pan') {
                        onPanMove(result.clientPos.x, result.clientPos.y);
                    }
                }}
                onTouchEnd={(e) => {
                    onTouchEnd(e);
                    canvasHandlers.onTouchEnd(e);
                    onPanEnd();
                }}
                onWheel={onWheel}
                width={typeof window !== 'undefined' ? window.innerWidth : 800}
                height={typeof window !== 'undefined' ? window.innerHeight : 600}
            />

            {selectedNode && graphData && (
                <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg border border-gray-600 min-w-48 max-w-80">
                    <h3 className="text-white font-bold text-lg">{selectedNode.name}</h3>
                    <p className="text-gray-300 capitalize">{ENTITY_LABELS[selectedNode.type] || selectedNode.type}</p>

                    <p className="text-gray-400 text-sm">Connections: {selectedNode.connectionCount}</p>

                    {(() => {
                        if (!graphData) return null;
                        const connections = graphData.relationships
                            .filter(rel => rel.from === selectedNode.id || rel.to === selectedNode.id)
                            .map(rel => {
                                const otherId = rel.from === selectedNode.id ? rel.to : rel.from;
                                const otherEntity = graphData.entities[otherId];
                                return {
                                    type: rel.type,
                                    name: otherEntity?.name || otherId,
                                    entityType: otherEntity?.type || 'unknown'
                                };
                            })
                            .sort((a, b) => a.name.localeCompare(b.name));

                        return connections.length > 0 ? (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                                <p className="text-gray-300 text-sm font-medium mb-2">
                                    Connections ({connections.length})
                                </p>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {connections.map((conn, index) => (
                                        <div key={index} className="text-xs text-gray-400">
                                            {conn.name}
                                            <span className="text-gray-500 ml-1">({ENTITY_LABELS[conn.entityType] || conn.entityType})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                                <p className="text-gray-400 text-sm">No connections in current view</p>
                            </div>
                        );
                    })()}

                    <button
                        onClick={() => setSelectedNode(null)}
                        className="mt-3 text-gray-400 hover:text-white text-sm"
                    >
                        Close
                    </button>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-gray-800 p-3 rounded-lg border border-gray-600 text-xs">
                <h4 className="text-white font-medium mb-2">Entity Types</h4>
                <div className="space-y-1 text-gray-300">
                    {Object.entries(ENTITY_LABELS).map(([type, label]) => (
                        <div key={type} className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: ENTITY_COLORS[type as keyof typeof ENTITY_COLORS] }}
                            />
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => setShowTopConnected(!showTopConnected)}
                    className="mt-2 text-cyan-400 hover:text-cyan-300 text-xs"
                >
                    {showTopConnected ? 'Hide' : 'Show'} Top Connected
                </button>
            </div>

            {/* Top Connected Panel */}
            {showTopConnected && graphData && (
                <div className="absolute bottom-4 right-4 bg-gray-800 p-3 rounded-lg border border-gray-600 max-w-xs">
                    <h4 className="text-white font-medium mb-2 text-sm">Most Connected Entities</h4>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                        {nodesRef.current
                            .sort((a: Node, b: Node) => (b.connectionCount || 0) - (a.connectionCount || 0))
                            .slice(0, 25)
                            .map((node: Node, index: number) => (
                                <div
                                    key={node.id}
                                    className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-700 p-1 rounded"
                                    onClick={() => {
                                        setSelectedNode(node);
                                        // Center camera on node
                                        centerOnNode(node.x, node.y, window.innerWidth, window.innerHeight);
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-gray-400">#{index + 1}</span>
                                        <span className='text-white'>
                                            {node.name}
                                        </span>
                                    </div>
                                    <span className="text-yellow-400 font-medium">{node.connectionCount}</span>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
} 
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import {
    useCanvasCamera,
    useFilters,
    useForceSimulation,
    useGraphData,
    useMobileBreakpoint,
    useNetworkRenderer,
    useNodes,
    useNodeSelection,
    type Node
} from '../../lib/hooks';

export default function NetworkVisualization() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showTopConnected, setShowTopConnected] = useState(false);

    // Data & layout
    const { graphData, loading, error } = useGraphData();
    const isMobile = useMobileBreakpoint(768);
    const { filters, searchTerm, setSearchTerm, toggleFilter, isNodeVisible } = useFilters();

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
        tick
    });



    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-900">
                <div className="text-white text-lg">Loading Power Network...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-900">
                <div className="text-red-400 text-lg">Error: {error}</div>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full overflow-hidden">
            {/* Brain logo - positioned outside the translating container */}
            <Link
                href="/"
                className="absolute top-5 left-5 z-10 opacity-100"
            >
                <Image src="/images/brain_transparent.webp" alt="Return to homepage" width={32} height={32} />
            </Link>

            <div className="absolute top-4 left-20 bg-gray-800 p-2 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 z-20">
                <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-700 text-white text-xs px-2 py-1 rounded focus:outline-none"
                />
                <div className="flex items-center gap-2 text-xs text-gray-300">
                    {(['person', 'company', 'fund'] as const).map((type) => (
                        <label key={type} className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={filters[type]}
                                onChange={() => toggleFilter(type)}
                                className="accent-cyan-400 h-3 w-3"
                            />
                            <span className="capitalize">{type}</span>
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
                    <p className="text-gray-300 capitalize">{selectedNode.type}</p>
                    {selectedNode?.country && (
                        <p className="text-gray-400 text-sm">{selectedNode.country}</p>
                    )}

                    {/* Connections section */}
                    {(() => {
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
                            });

                        return connections.length > 0 ? (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                                <p className="text-gray-300 text-sm font-medium mb-2">
                                    Connections ({connections.length})
                                </p>
                                <div className="space-y-1 max-h-32 overflow-y-auto">
                                    {connections.map((conn, index) => (
                                        <div key={index} className="text-xs text-gray-400">
                                            <span className="text-cyan-400">{conn.type}</span> {conn.name}
                                            <span className="text-gray-500 ml-1">({conn.entityType})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                                <p className="text-gray-400 text-sm">No connections</p>
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

            {/* Legend for prominence indicators */}
            <div className="absolute bottom-4 left-4 bg-gray-800 p-3 rounded-lg border border-gray-600 text-xs">
                <h4 className="text-white font-medium mb-2">Network Prominence</h4>
                <div className="space-y-1 text-gray-300">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-white border-2 border-yellow-400"></div>
                        <span>Highly connected (10+ links)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-white"></div>
                        <span>Standard connections</span>
                    </div>
                    <div className="text-yellow-400">Larger nodes = more connections</div>
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
                            .sort((a, b) => b.connectionCount - a.connectionCount)
                            .slice(0, 15)
                            .map((node, index) => (
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
                                        <span className={`
                                            ${node.type === 'person' ? 'text-blue-400' : ''}
                                            ${node.type === 'company' ? 'text-green-400' : ''}
                                            ${node.type === 'fund' ? 'text-orange-400' : ''}
                                        `}>
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
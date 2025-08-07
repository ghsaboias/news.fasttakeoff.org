'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle
} from '../../components/ui/sheet';
import {
    useCanvasCamera,
    useEntityRelevance,
    useFilters,
    useGraphData,
    useMobileBreakpoint,
    useNetworkRenderer,
    useNodes,
    useNodeSelection,
    type Node
} from '../../lib/hooks';
import { useBasicForceSimulation } from '../../lib/hooks/useBasicForceSimulation';
import { formatEntityRelevance, formatFinancialValue, getFinancialValueDisplayClass, getRelevanceDisplayClass } from '../../lib/hooks/useEntityRelevance';

function NetworkVisualization() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showTopConnected, setShowTopConnected] = useState(false);
    const [showRelevanceScores, setShowRelevanceScores] = useState(false);
    const [showFinancialValues, setShowFinancialValues] = useState(true); // Default to financial values
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

    // Data & layout
    const { graphData, loading, error } = useGraphData();
    const isMobile = useMobileBreakpoint(768);
    const { filters, searchTerm, setSearchTerm, toggleFilter, isNodeVisible } = useFilters();

    // Entity relevance scoring
    const entityRelevance = useEntityRelevance(graphData);

    // Nodes & physics
    const { nodesRef } = useNodes(graphData, isMobile);
    const tick = useBasicForceSimulation(nodesRef, graphData?.relationships, isMobile);

    // Camera & interaction
    const { cameraRef, onWheel, onPanStart, onPanMove, onPanEnd, onTouchStart, onTouchMove, onTouchEnd, centerOnNode } = useCanvasCamera();

    // Handle canvas resize
    useEffect(() => {
        const updateCanvasSize = () => {
            setCanvasSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        // Set initial size
        updateCanvasSize();

        // Listen for resize events
        window.addEventListener('resize', updateCanvasSize);

        // Handle orientation change on mobile
        window.addEventListener('orientationchange', () => {
            setTimeout(updateCanvasSize, 100); // Delay to ensure proper dimensions
        });

        return () => {
            window.removeEventListener('resize', updateCanvasSize);
            window.removeEventListener('orientationchange', updateCanvasSize);
        };
    }, []);

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

    useEffect(() => {
        if (selectedNode) {
            setIsSheetOpen(true);
        } else {
            setIsSheetOpen(false);
        }
    }, [selectedNode]);

    const handleSheetChange = (open: boolean) => {
        setIsSheetOpen(open);
        if (!open) {
            setSelectedNode(null);
        }
    };

    const renderInfoPanelContent = (node: Node) => {
        if (!entityRelevance || !graphData) return null;

        const score = entityRelevance.getEntityScore(node.id);
        const connections = graphData.relationships
            .filter(rel => rel.from === node.id || rel.to === node.id)
            .map(rel => {
                const otherId = rel.from === node.id ? rel.to : rel.from;
                const otherEntity = graphData.entities[otherId];
                return {
                    type: rel.type,
                    name: otherEntity?.name || otherId,
                    entityType: otherEntity?.type || 'unknown',
                    id: otherId
                };
            });

        const detailLevel = score.detailLevel;
        const connectionsToShow = detailLevel >= 4 ? connections : connections.slice(0, detailLevel + 2);

        return (
            <>
                {/* Financial value and relevance score */}
                <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Financial Value:</span>
                            <span className={`text-sm ${getFinancialValueDisplayClass(score)}`}>
                                {formatFinancialValue(score)}
                            </span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-300 text-sm">Relevance Score:</span>
                            <span className={`text-sm ${getRelevanceDisplayClass(score)}`}>
                                {formatEntityRelevance(score)}
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                        {score.reasons.join(', ')}
                    </div>
                </div>

                {/* Connections section */}
                {connections.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700 max-h-48 overflow-y-auto">
                        <h4 className="text-gray-200 font-semibold text-sm mb-1">Connections</h4>
                        <ul className="space-y-1 text-xs">
                            {connectionsToShow.map((conn, index) => (
                                <li key={index} className="flex justify-between items-center">
                                    <span className="text-gray-400">
                                        {conn.type.replace(/_/g, ' ')}:
                                        <button onClick={() => {
                                            const targetNode = nodesRef.current.find(n => n.id === conn.id);
                                            if (targetNode && canvasRef.current) {
                                                setSelectedNode(targetNode);
                                                centerOnNode(targetNode.x, targetNode.y, canvasSize.width, canvasSize.height);
                                            }
                                        }} className="text-cyan-400 hover:underline ml-1">
                                            {conn.name}
                                        </button>
                                    </span>
                                    <span className="text-gray-500 capitalize">{conn.entityType}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </>
        );
    };

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
                <Image src="/images/brain_transparent.png" alt="Return to homepage" width={32} height={32} />
            </Link>

            {/* Search and Filter Controls - Mobile Responsive */}
            <div className="absolute top-4 left-4 right-4 md:left-20 md:right-auto bg-gray-800 p-2 rounded-lg z-20 max-w-full md:max-w-none">
                <div className="flex flex-col gap-2">
                    <input
                        type="text"
                        placeholder="Search entities..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-gray-700 text-white text-sm px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 w-full"
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                        {(['person', 'company', 'fund'] as const).map((type) => (
                            <label key={type} className="flex items-center gap-1 cursor-pointer select-none whitespace-nowrap">
                                <input
                                    type="checkbox"
                                    checked={filters[type]}
                                    onChange={() => toggleFilter(type)}
                                    className="accent-cyan-400 h-4 w-4"
                                />
                                <span className="capitalize">{type}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>

            <canvas
                ref={canvasRef}
                className="w-full h-full bg-gray-900 cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                data-testid="power-network-canvas"
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
                width={canvasSize.width}
                height={canvasSize.height}
            />

            {selectedNode && (
                isMobile ? (
                    <Sheet open={isSheetOpen} onOpenChange={handleSheetChange}>
                        <SheetContent side="bottom" className="bg-gray-800 border-t-gray-700 text-white">
                            <SheetHeader>
                                <SheetTitle className="text-white">{selectedNode.name}</SheetTitle>
                                <p className="text-gray-400 text-sm">
                                    {selectedNode.type}
                                    {selectedNode.country && ` - ${selectedNode.country}`}
                                </p>
                            </SheetHeader>
                            <div className="py-4">
                                {renderInfoPanelContent(selectedNode)}
                            </div>
                        </SheetContent>
                    </Sheet>
                ) : (
                    <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg border border-gray-600 min-w-48 max-w-80 shadow-lg">
                        <h3 className="text-white font-bold text-lg">{selectedNode.name}</h3>
                        <p className="text-gray-300 capitalize">{selectedNode.type}</p>
                        {selectedNode?.country && (
                            <p className="text-gray-400 text-sm">{selectedNode.country}</p>
                        )}
                        {renderInfoPanelContent(selectedNode)}
                    </div>
                )
            )}

            {/* Legend for financial tiers - Mobile Responsive */}
            <div className="absolute bottom-4 left-4 bg-gray-800 p-2 md:p-3 rounded-lg border border-gray-600 text-xs max-w-xs md:max-w-none">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">Financial Tiers</h4>
                    <button
                        onClick={() => setShowRelevanceScores(!showRelevanceScores)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs md:hidden"
                    >
                        {showRelevanceScores ? '−' : '+'}
                    </button>
                </div>
                <div className={`space-y-1 text-gray-300 ${isMobile && showRelevanceScores ? 'hidden' : ''}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-yellow-300 border-2 border-yellow-400"></div>
                        <span className="text-xs">Mega ($100B+)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 md:w-4 md:h-4 rounded-full bg-yellow-400 border-2 border-yellow-500"></div>
                        <span className="text-xs">Ultra ($50-100B)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-400"></div>
                        <span className="text-xs">High ($10-50B)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-green-300"></div>
                        <span className="text-xs">Wealth ($1-10B)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1 h-1 md:w-2 md:h-2 rounded-full bg-blue-300"></div>
                        <span className="text-xs">Emerging ($100M+)</span>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1 md:gap-2 mt-2">
                    <button
                        onClick={() => setShowTopConnected(!showTopConnected)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs whitespace-nowrap px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                        {showTopConnected ? 'Hide' : 'Show'} Top
                    </button>
                    <button
                        onClick={() => setShowFinancialValues(!showFinancialValues)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs whitespace-nowrap px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                        {showFinancialValues ? 'Hide' : 'Show'} Financial
                    </button>
                    <button
                        onClick={() => setShowRelevanceScores(!showRelevanceScores)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs whitespace-nowrap hidden md:block px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                        {showRelevanceScores ? 'Hide' : 'Show'} Relevance
                    </button>
                </div>
            </div>

            {/* Top Connected Panel */}
            {showTopConnected && graphData && (
                <div className={`absolute ${isMobile ? 'bottom-20' : 'bottom-4'} right-4 bg-gray-800 p-2 md:p-3 rounded-lg border border-gray-600 max-w-xs`}>
                    <h4 className="text-white font-medium mb-2 text-sm">Most Connected</h4>
                    <div className="space-y-1 max-h-48 md:max-h-64 overflow-y-auto">
                        {nodesRef.current
                            .sort((a, b) => b.connectionCount - a.connectionCount)
                            .slice(0, isMobile ? 10 : 15)
                            .map((node, index) => (
                                <div
                                    key={node.id}
                                    className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors"
                                    onClick={() => {
                                        setSelectedNode(node);
                                        // Center camera on node
                                        centerOnNode(node.x, node.y, canvasSize.width, canvasSize.height);
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

            {/* Financial Values Panel */}
            {showFinancialValues && entityRelevance && !showTopConnected && (
                <div className={`absolute ${isMobile ? 'bottom-20' : 'bottom-4'} right-4 bg-gray-800 p-2 md:p-3 rounded-lg border border-gray-600 max-w-xs`}>
                    <h4 className="text-white font-medium mb-2 text-sm">Highest Financial Value</h4>
                    <div className="space-y-1 max-h-48 md:max-h-64 overflow-y-auto">
                        {entityRelevance.getTopEntitiesByFinancialValue(isMobile ? 10 : 15).map((scoreData, index) => (
                            <div
                                key={scoreData.entityId}
                                className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors"
                                onClick={() => {
                                    const node = nodesRef.current.find(n => n.id === scoreData.entityId);
                                    if (node) {
                                        setSelectedNode(node);
                                        centerOnNode(node.x, node.y, canvasSize.width, canvasSize.height);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400">#{index + 1}</span>
                                    <span className={getFinancialValueDisplayClass(scoreData)}>
                                        {graphData?.entities[scoreData.entityId]?.name || scoreData.entityId}
                                    </span>
                                </div>
                                <span className="text-green-400 font-medium">{formatFinancialValue(scoreData)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Relevance Scores Panel */}
            {showRelevanceScores && entityRelevance && !showTopConnected && !showFinancialValues && (
                <div className={`absolute ${isMobile ? 'bottom-20' : 'bottom-4'} right-4 bg-gray-800 p-2 md:p-3 rounded-lg border border-gray-600 max-w-xs`}>
                    <h4 className="text-white font-medium mb-2 text-sm">Most Relevant</h4>
                    <div className="space-y-1 max-h-48 md:max-h-64 overflow-y-auto">
                        {entityRelevance.getTopEntitiesByScore(isMobile ? 10 : 15).map((scoreData, index) => (
                            <div
                                key={scoreData.entityId}
                                className="flex items-center justify-between text-xs cursor-pointer hover:bg-gray-700 p-2 rounded transition-colors"
                                onClick={() => {
                                    const node = nodesRef.current.find(n => n.id === scoreData.entityId);
                                    if (node) {
                                        setSelectedNode(node);
                                        centerOnNode(node.x, node.y, canvasSize.width, canvasSize.height);
                                    }
                                }}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-400">#{index + 1}</span>
                                    <span className={getRelevanceDisplayClass(scoreData)}>
                                        {graphData?.entities[scoreData.entityId]?.name || scoreData.entityId}
                                    </span>
                                </div>
                                <span className="text-cyan-400 font-medium">{scoreData.score.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default React.memo(NetworkVisualization); 
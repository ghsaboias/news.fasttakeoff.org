'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface Entity {
    type: string;
    name: string;
    country?: string;
}

interface Relationship {
    from: string;
    to: string;
    type: string;
}

interface GraphData {
    entities: Record<string, Entity>;
    relationships: Relationship[];
}

interface Node extends Entity {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

export default function NetworkVisualization() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [isMobile, setIsMobile] = useState(false);

    // Network state
    const nodesRef = useRef<Node[]>([]);
    const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
    const animationRef = useRef<number | undefined>(undefined);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });

    // Touch state for pinch zoom
    const lastTouchDistanceRef = useRef<number | null>(null);
    const touchCenterRef = useRef<{ x: number, y: number } | null>(null);

    // Detect mobile on mount
    useEffect(() => {
        setIsMobile(window.innerWidth < 768);
    }, []);

    // Load graph data
    useEffect(() => {
        async function loadData() {
            try {
                const response = await fetch('/data/graph.json');
                if (!response.ok) throw new Error('Failed to load network data');
                const data = await response.json();
                setGraphData(data);
                setLoading(false);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Initialize canvas and nodes when data loads
    useEffect(() => {
        if (!graphData || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const resizeCanvas = () => {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Generate nodes from entities
        const nodes: Node[] = Object.keys(graphData.entities).map((id) => {
            const entity = graphData.entities[id];
            const baseRadius = entity.type === 'person' ? 25 : 20;
            const mobileRadius = isMobile ? baseRadius + 15 : baseRadius;

            return {
                id,
                ...entity,
                x: Math.random() * (canvas.width - 200) + 100,
                y: Math.random() * (canvas.height - 200) + 100,
                vx: 0,
                vy: 0,
                radius: mobileRadius,
            };
        });
        nodesRef.current = nodes;

        // Center camera
        cameraRef.current = { x: 0, y: 0, zoom: 1 };

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [graphData, isMobile]);

    // Animation loop
    useEffect(() => {
        if (!graphData) return;

        // Physics simulation
        const simulate = () => {
            const nodes = nodesRef.current;
            const relationships = graphData.relationships;

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
        };

        // Render function
        const render = () => {
            if (!canvasRef.current) return;

            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const camera = cameraRef.current;
            const nodes = nodesRef.current;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);

            // Get connected relationships for selected node
            const connectedRelationships = selectedNode ?
                graphData.relationships.filter(rel =>
                    rel.from === selectedNode.id || rel.to === selectedNode.id
                ) : [];

            const connectedNodeIds = selectedNode ?
                connectedRelationships.flatMap(rel => [rel.from, rel.to]).filter(id => id !== selectedNode.id) : [];

            // Draw relationships
            graphData.relationships.forEach((rel) => {
                const nodeA = nodes.find((n) => n.id === rel.from);
                const nodeB = nodes.find((n) => n.id === rel.to);

                if (nodeA && nodeB) {
                    const isConnectedToSelected = selectedNode &&
                        (rel.from === selectedNode.id || rel.to === selectedNode.id);

                    // Set line style based on selection
                    if (selectedNode) {
                        if (isConnectedToSelected) {
                            ctx.strokeStyle = '#00ffff'; // Bright cyan for connected
                            ctx.lineWidth = 3;
                        } else {
                            ctx.strokeStyle = '#222'; // Dimmed for unconnected
                            ctx.lineWidth = 1;
                        }
                    } else {
                        ctx.strokeStyle = '#444'; // Default
                        ctx.lineWidth = 2;
                    }

                    ctx.beginPath();
                    ctx.moveTo(nodeA.x, nodeA.y);
                    ctx.lineTo(nodeB.x, nodeB.y);
                    ctx.stroke();

                    // Draw relationship label (only for connected ones when selected)
                    if (!selectedNode || isConnectedToSelected) {
                        const midX = (nodeA.x + nodeB.x) / 2;
                        const midY = (nodeA.y + nodeB.y) / 2;
                        ctx.fillStyle = isConnectedToSelected ? '#00ffff' : '#666';
                        ctx.font = '10px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.fillText(rel.type, midX, midY - 5);
                    }
                }
            });

            // Draw nodes
            nodes.forEach((node) => {
                const isSelected = selectedNode && selectedNode.id === node.id;
                const isConnectedToSelected = selectedNode && connectedNodeIds.includes(node.id);

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

                // Color by type with selection highlighting
                let fillColor;
                if (node.type === 'person') {
                    fillColor = isSelected ? '#00ffff' : (isConnectedToSelected ? '#6bb6ff' : '#4a90e2');
                } else if (node.type === 'company') {
                    fillColor = isSelected ? '#00ffff' : (isConnectedToSelected ? '#a4ed5c' : '#7ed321');
                } else if (node.type === 'fund') {
                    fillColor = isSelected ? '#00ffff' : (isConnectedToSelected ? '#ffb366' : '#e67e22');
                } else {
                    fillColor = isSelected ? '#00ffff' : (isConnectedToSelected ? '#aaa' : '#888');
                }

                // Dim unconnected nodes when something is selected
                if (selectedNode && !isSelected && !isConnectedToSelected) {
                    ctx.globalAlpha = 0.3;
                }

                ctx.fillStyle = fillColor;
                ctx.fill();

                // Node outline
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = isSelected ? 4 : (isConnectedToSelected ? 3 : 2);
                ctx.stroke();

                // Reset opacity
                ctx.globalAlpha = 1;

                // Draw labels (always visible for selected and connected nodes)
                if (!selectedNode || isSelected || isConnectedToSelected) {
                    ctx.fillStyle = '#fff';
                    ctx.font = '12px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(node.name, node.x, node.y + node.radius + 15);
                }
            });

            ctx.restore();
        };

        const animate = () => {
            simulate();
            render();
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [graphData, selectedNode]);

    // Helper functions for touch/mouse position
    const getEventPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };

        const rect = canvas.getBoundingClientRect();
        const camera = cameraRef.current;

        let clientX, clientY;
        if ('touches' in e && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if ('clientX' in e) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            return { x: 0, y: 0 };
        }

        return {
            x: (clientX - rect.left - camera.x) / camera.zoom,
            y: (clientY - rect.top - camera.y) / camera.zoom,
        };
    };

    const getNodeAt = (x: number, y: number): Node | null => {
        return nodesRef.current.find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        }) || null;
    };

    // Touch distance calculation for pinch zoom
    const getTouchDistance = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    const getTouchCenter = (touches: React.TouchList) => {
        if (touches.length < 2) return null;
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        };
    };

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const pos = getEventPosition(e);
        const node = getNodeAt(pos.x, pos.y);

        if (node) {
            setSelectedNode(node);
            isDraggingRef.current = true;
            dragOffsetRef.current = {
                x: pos.x - node.x,
                y: pos.y - node.y,
            };
        } else {
            setSelectedNode(null);
            isPanningRef.current = true;
            panStartRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDraggingRef.current && selectedNode) {
            const pos = getEventPosition(e);
            selectedNode.x = pos.x - dragOffsetRef.current.x;
            selectedNode.y = pos.y - dragOffsetRef.current.y;
            selectedNode.vx = 0;
            selectedNode.vy = 0;
        } else if (isPanningRef.current) {
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            cameraRef.current.x += dx;
            cameraRef.current.y += dy;
            panStartRef.current = { x: e.clientX, y: e.clientY };
        }
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        isPanningRef.current = false;
    };

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        if (e.touches.length === 1) {
            // Single touch - same as mouse down
            const pos = getEventPosition(e);
            const node = getNodeAt(pos.x, pos.y);

            if (node) {
                setSelectedNode(node);
                isDraggingRef.current = true;
                dragOffsetRef.current = {
                    x: pos.x - node.x,
                    y: pos.y - node.y,
                };
            } else {
                setSelectedNode(null);
                isPanningRef.current = true;
                panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        } else if (e.touches.length === 2) {
            // Two touches - prepare for pinch zoom
            isDraggingRef.current = false;
            isPanningRef.current = false;
            lastTouchDistanceRef.current = getTouchDistance(e.touches);
            touchCenterRef.current = getTouchCenter(e.touches);
        }
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        if (e.touches.length === 1) {
            // Single touch - same as mouse move
            if (isDraggingRef.current && selectedNode) {
                const pos = getEventPosition(e);
                selectedNode.x = pos.x - dragOffsetRef.current.x;
                selectedNode.y = pos.y - dragOffsetRef.current.y;
                selectedNode.vx = 0;
                selectedNode.vy = 0;
            } else if (isPanningRef.current) {
                const dx = e.touches[0].clientX - panStartRef.current.x;
                const dy = e.touches[0].clientY - panStartRef.current.y;
                cameraRef.current.x += dx;
                cameraRef.current.y += dy;
                panStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        } else if (e.touches.length === 2 && lastTouchDistanceRef.current && touchCenterRef.current) {
            // Two touches - pinch zoom
            const currentDistance = getTouchDistance(e.touches);
            const currentCenter = getTouchCenter(e.touches);

            if (currentDistance && currentCenter) {
                const zoomFactor = currentDistance / lastTouchDistanceRef.current;
                const camera = cameraRef.current;
                camera.zoom = Math.max(0.1, Math.min(3, camera.zoom * zoomFactor));

                lastTouchDistanceRef.current = currentDistance;
                touchCenterRef.current = currentCenter;
            }
        }
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        e.preventDefault();

        if (e.touches.length === 0) {
            // All touches ended
            isDraggingRef.current = false;
            isPanningRef.current = false;
            lastTouchDistanceRef.current = null;
            touchCenterRef.current = null;
        } else if (e.touches.length === 1) {
            // One touch remaining after pinch
            lastTouchDistanceRef.current = null;
            touchCenterRef.current = null;
        }
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const camera = cameraRef.current;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        camera.zoom = Math.max(0.1, Math.min(3, camera.zoom * zoomFactor));
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
                <Image src="/images/brain_transparent.webp" alt="Return to homepage" width={32} height={32} />
            </Link>

            <canvas
                ref={canvasRef}
                className="w-full h-full bg-gray-900 cursor-grab active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                width={window.innerWidth}
                height={window.innerHeight}
            />

            {selectedNode && graphData && (
                <div className="absolute top-4 right-4 bg-gray-800 p-4 rounded-lg border border-gray-600 min-w-48 max-w-80">
                    <h3 className="text-white font-bold text-lg">{selectedNode.name}</h3>
                    <p className="text-gray-300 capitalize">{selectedNode.type}</p>
                    {selectedNode.country && (
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
        </div>
    );
} 
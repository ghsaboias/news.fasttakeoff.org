import { useEffect, useRef } from 'react';
import { Node } from './useNodes';

interface Camera {
    x: number;
    y: number;
    zoom: number;
}

interface Relationship {
    from: string;
    to: string;
    type: string;
}

interface UseNetworkRendererProps {
    canvasRef: React.RefObject<HTMLCanvasElement | null>;
    nodesRef: React.MutableRefObject<Node[]>;
    cameraRef: React.MutableRefObject<Camera>;
    relationships?: Relationship[];
    selectedNode: Node | null;
    isNodeVisible: (node: Node) => boolean;
    tick: () => void;
}

export function useNetworkRenderer({
    canvasRef,
    nodesRef,
    cameraRef,
    relationships,
    selectedNode,
    isNodeVisible,
    tick
}: UseNetworkRendererProps) {
    const animationRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!relationships || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size and handle resize
        const resizeCanvas = () => {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        // Render function
        const render = () => {
            const camera = cameraRef.current;
            const nodes = nodesRef.current;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(camera.x, camera.y);
            ctx.scale(camera.zoom, camera.zoom);

            const visibleNodeIds = new Set(nodes.filter(isNodeVisible).map(n => n.id));

            // Get connected relationships for selected node
            const connectedRelationships = selectedNode ?
                relationships.filter(rel =>
                    (rel.from === selectedNode.id || rel.to === selectedNode.id) &&
                    visibleNodeIds.has(rel.from) && visibleNodeIds.has(rel.to)
                ) : [];

            const connectedNodeIds = selectedNode ?
                connectedRelationships.flatMap(rel => [rel.from, rel.to]).filter(id => id !== selectedNode.id) : [];

            // Draw relationships
            relationships.forEach((rel) => {
                const nodeA = nodes.find((n) => n.id === rel.from);
                const nodeB = nodes.find((n) => n.id === rel.to);

                if (nodeA && nodeB && visibleNodeIds.has(nodeA.id) && visibleNodeIds.has(nodeB.id)) {
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
                if (!visibleNodeIds.has(node.id)) return;

                const isSelected = selectedNode && selectedNode.id === node.id;
                const isConnectedToSelected = selectedNode && connectedNodeIds.includes(node.id);

                // Add glow effect for highly connected nodes
                if (node.connectionCount > 10) {
                    const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.radius * 1.5);
                    const baseColor = node.type === 'person' ? '#4a90e2' : (node.type === 'company' ? '#7ed321' : '#e67e22');
                    gradient.addColorStop(0, baseColor + 'FF');
                    gradient.addColorStop(0.5, baseColor + '40');
                    gradient.addColorStop(1, baseColor + '00');

                    ctx.beginPath();
                    ctx.arc(node.x, node.y, node.radius * 1.5, 0, Math.PI * 2);
                    ctx.fillStyle = gradient;
                    ctx.fill();
                }

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

                // Node outline - thicker for highly connected nodes
                const outlineWidth = isSelected ? 5 : (isConnectedToSelected ? 4 : Math.min(2 + node.connectionCount / 10, 4));
                ctx.strokeStyle = node.connectionCount > 10 ? '#ffd700' : '#fff'; // Gold outline for highly connected
                ctx.lineWidth = outlineWidth;
                ctx.stroke();

                // Reset opacity
                ctx.globalAlpha = 1;

                // Draw labels (always visible for selected, connected, and highly connected nodes)
                if (!selectedNode || isSelected || isConnectedToSelected || node.connectionCount > 8) {
                    // Larger font for highly connected nodes
                    const fontSize = node.connectionCount > 15 ? 14 : (node.connectionCount > 8 ? 13 : 12);
                    const fontWeight = node.connectionCount > 10 ? 'bold ' : '';
                    ctx.font = `${fontWeight}${fontSize}px sans-serif`;

                    // Brighter text for highly connected nodes
                    ctx.fillStyle = node.connectionCount > 10 ? '#ffff00' : '#fff';
                    ctx.textAlign = 'center';
                    ctx.fillText(node.name, node.x, node.y + node.radius + 15);

                    // Show connection count for highly connected nodes
                    if (node.connectionCount > 10) {
                        ctx.font = '10px sans-serif';
                        ctx.fillStyle = '#ffd700';
                        ctx.fillText(`(${node.connectionCount})`, node.x, node.y + node.radius + 28);
                    }
                }
            });

            ctx.restore();
        };

        // Animation loop
        const animate = () => {
            tick();
            render();
            animationRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [relationships, selectedNode, isNodeVisible, tick, canvasRef, nodesRef, cameraRef]);

    return null; // This hook only handles side effects
} 
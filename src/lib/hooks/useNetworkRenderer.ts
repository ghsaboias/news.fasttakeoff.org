import { ENTITY_COLORS } from '@/lib/config';
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
    strength?: number;
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

const getEntityColor = (type: string) => ENTITY_COLORS[type] || ENTITY_COLORS.DEFAULT;

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

            const connectedNodeIds = selectedNode
                ? new Set(
                    relationships
                        .filter(rel => rel.from === selectedNode.id || rel.to === selectedNode.id)
                        .flatMap(rel => [rel.from, rel.to])
                )
                : null;

            // 1. Draw relationships
            relationships.forEach((rel) => {
                const nodeA = nodes.find((n) => n.id === rel.from);
                const nodeB = nodes.find((n) => n.id === rel.to);

                if (nodeA && nodeB && visibleNodeIds.has(nodeA.id) && visibleNodeIds.has(nodeB.id)) {
                    const isConnectedToSelected = selectedNode && (rel.from === selectedNode.id || rel.to === selectedNode.id);

                    if (selectedNode && !isConnectedToSelected) {
                        ctx.globalAlpha = 0.1;
                        ctx.strokeStyle = '#555';
                        ctx.lineWidth = 0.5;
                    } else {
                        ctx.globalAlpha = 0.4;
                        const minWidth = 0.5;
                        const maxWidth = 5;
                        const strengthScale = Math.min((rel.strength || 1) / 10, 1);
                        ctx.lineWidth = minWidth + (maxWidth - minWidth) * strengthScale;
                        ctx.strokeStyle = isConnectedToSelected ? '#00ffff' : '#999';
                    }

                    ctx.beginPath();
                    ctx.moveTo(nodeA.x, nodeA.y);
                    ctx.lineTo(nodeB.x, nodeB.y);
                    ctx.stroke();
                    ctx.globalAlpha = 1.0;
                }
            });

            // 2. Draw nodes
            nodes.forEach((node) => {
                if (!visibleNodeIds.has(node.id)) return;

                const isSelected = selectedNode?.id === node.id;
                const isConnected = connectedNodeIds?.has(node.id);

                let alpha = 1.0;
                if (selectedNode && !isSelected && !isConnected) {
                    alpha = 0.2;
                }
                ctx.globalAlpha = alpha;

                // Main node fill
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = getEntityColor(node.type);
                ctx.fill();

                // Outline for selected/connected
                if (isSelected || isConnected) {
                    ctx.lineWidth = isSelected ? 4 : 2;
                    ctx.strokeStyle = '#00ffff'; // Cyan for highlight
                    ctx.stroke();
                }

                ctx.globalAlpha = 1.0;

                // 3. Draw labels
                const labelThreshold = camera.zoom > 0.4;
                const isImportant = node.connectionCount >= 3;

                if (isSelected || isConnected || (labelThreshold && isImportant)) {
                    ctx.globalAlpha = alpha;
                    const fontSize = 10 + Math.min(node.radius, 10);
                    ctx.font = `${fontSize}px sans-serif`;
                    ctx.fillStyle = '#fff';
                    ctx.textAlign = 'center';
                    ctx.fillText(node.name, node.x, node.y + node.radius + fontSize);
                    ctx.globalAlpha = 1.0;
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
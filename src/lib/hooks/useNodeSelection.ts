import { useRef, useState } from 'react';
import { Node } from './useNodes';

interface Camera {
    x: number;
    y: number;
    zoom: number;
}

export function useNodeSelection(
    nodesRef: React.MutableRefObject<Node[]>,
    cameraRef: React.MutableRefObject<Camera>,
    isNodeVisible: (node: Node) => boolean
) {
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const isDraggingRef = useRef(false);
    const dragOffsetRef = useRef({ x: 0, y: 0 });

    // Helper functions for touch/mouse position
    const getEventPosition = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
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
        return nodesRef.current.filter(isNodeVisible).find((node) => {
            const dx = node.x - x;
            const dy = node.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= node.radius;
        }) || null;
    };

    // Mouse event handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = e.currentTarget;
        const pos = getEventPosition(e, canvas);
        const node = getNodeAt(pos.x, pos.y);

        if (node) {
            setSelectedNode(node);
            isDraggingRef.current = true;
            dragOffsetRef.current = {
                x: pos.x - node.x,
                y: pos.y - node.y,
            };
            return { type: 'drag' as const, node };
        } else {
            setSelectedNode(null);
            return { type: 'pan' as const, startPos: { x: e.clientX, y: e.clientY } };
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDraggingRef.current && selectedNode) {
            const canvas = e.currentTarget;
            const pos = getEventPosition(e, canvas);
            selectedNode.x = pos.x - dragOffsetRef.current.x;
            selectedNode.y = pos.y - dragOffsetRef.current.y;
            selectedNode.vx = 0;
            selectedNode.vy = 0;
            return { type: 'drag' as const };
        }
        return { type: 'pan' as const, clientPos: { x: e.clientX, y: e.clientY } };
    };

    const handleMouseUp = () => {
        isDraggingRef.current = false;
        return { type: 'end' as const };
    };

    // Touch event handlers
    const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 1) {
            // Single touch - same as mouse down
            const canvas = e.currentTarget;
            const pos = getEventPosition(e, canvas);
            const node = getNodeAt(pos.x, pos.y);

            if (node) {
                setSelectedNode(node);
                isDraggingRef.current = true;
                dragOffsetRef.current = {
                    x: pos.x - node.x,
                    y: pos.y - node.y,
                };
                return { type: 'drag' as const, node };
            } else {
                setSelectedNode(null);
                return { type: 'pan' as const, startPos: { x: e.touches[0].clientX, y: e.touches[0].clientY } };
            }
        } else if (e.touches.length === 2) {
            // Two touches - prepare for pinch zoom
            isDraggingRef.current = false;
            return { type: 'pinch' as const };
        }
        return { type: 'none' as const };
    };

    const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 1) {
            // Single touch - same as mouse move
            if (isDraggingRef.current && selectedNode) {
                const canvas = e.currentTarget;
                const pos = getEventPosition(e, canvas);
                selectedNode.x = pos.x - dragOffsetRef.current.x;
                selectedNode.y = pos.y - dragOffsetRef.current.y;
                selectedNode.vx = 0;
                selectedNode.vy = 0;
                return { type: 'drag' as const };
            }
            return { type: 'pan' as const, clientPos: { x: e.touches[0].clientX, y: e.touches[0].clientY } };
        }
        return { type: 'pinch' as const };
    };

    const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 0) {
            // All touches ended
            isDraggingRef.current = false;
        }
        return { type: 'end' as const };
    };

    return {
        selectedNode,
        setSelectedNode,
        canvasHandlers: {
            onMouseDown: handleMouseDown,
            onMouseMove: handleMouseMove,
            onMouseUp: handleMouseUp,
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        }
    };
} 
import { useRef } from 'react';

interface Camera {
    x: number;
    y: number;
    zoom: number;
}

export function useCanvasCamera() {
    const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
    const isPanningRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const lastTouchDistanceRef = useRef<number | null>(null);
    const touchCenterRef = useRef<{ x: number, y: number } | null>(null);

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

    const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const camera = cameraRef.current;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        camera.zoom = Math.max(0.1, Math.min(3, camera.zoom * zoomFactor));
    };

    const onPanStart = (clientX: number, clientY: number) => {
        isPanningRef.current = true;
        panStartRef.current = { x: clientX, y: clientY };
    };

    const onPanMove = (clientX: number, clientY: number) => {
        if (!isPanningRef.current) return;

        const dx = clientX - panStartRef.current.x;
        const dy = clientY - panStartRef.current.y;
        cameraRef.current.x += dx;
        cameraRef.current.y += dy;
        panStartRef.current = { x: clientX, y: clientY };
    };

    const onPanEnd = () => {
        isPanningRef.current = false;
    };

    // Touch-specific handlers for pinch zoom
    const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2) {
            // Two touches - prepare for pinch zoom
            lastTouchDistanceRef.current = getTouchDistance(e.touches);
            touchCenterRef.current = getTouchCenter(e.touches);
        }
    };

    const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 2 && lastTouchDistanceRef.current && touchCenterRef.current) {
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

    const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
        if (e.touches.length === 0) {
            // All touches ended
            lastTouchDistanceRef.current = null;
            touchCenterRef.current = null;
        } else if (e.touches.length === 1) {
            // One touch remaining after pinch
            lastTouchDistanceRef.current = null;
            touchCenterRef.current = null;
        }
    };

    const centerOnNode = (nodeX: number, nodeY: number, canvasWidth: number, canvasHeight: number) => {
        const camera = cameraRef.current;
        camera.x = canvasWidth / 2 - nodeX * camera.zoom;
        camera.y = canvasHeight / 2 - nodeY * camera.zoom;
    };

    return {
        cameraRef,
        onWheel,
        onPanStart,
        onPanMove,
        onPanEnd,
        onTouchStart,
        onTouchMove,
        onTouchEnd,
        centerOnNode
    };
} 
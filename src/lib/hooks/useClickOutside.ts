import { useEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement = HTMLElement>(
    callback: () => void,
    excludeSelectors?: string[]
) {
    const ref = useRef<T>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as HTMLElement;

            // Check if click is inside the ref element
            if (ref.current && ref.current.contains(target)) {
                return;
            }

            // Check if click is inside any excluded elements
            if (excludeSelectors) {
                for (const selector of excludeSelectors) {
                    const excludedElement = target.closest(selector);
                    if (excludedElement) {
                        return;
                    }
                }
            }

            // If we get here, the click was outside
            callback();
        };

        // Add event listeners
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [callback, excludeSelectors]);

    return ref;
}

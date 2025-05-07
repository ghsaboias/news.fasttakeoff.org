'use client';

import { useEffect, useRef, useState } from "react";

interface ReportCardContentProps {
    body: string;
}

export default function ReportCardContent({ body }: ReportCardContentProps) {
    const paragraphs = body.split('\n\n').filter(Boolean);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const element = contentRef.current;
        if (!element) return;

        const checkAndUpdateScrollState = () => {
            if (element.scrollHeight <= element.clientHeight) {
                setIsAtBottom(true);
            } else {
                const { scrollTop, scrollHeight, clientHeight } = element;
                const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5;
                setIsAtBottom(isBottom);
            }
        };

        checkAndUpdateScrollState(); // Initial check on mount and when body changes

        element.addEventListener('scroll', checkAndUpdateScrollState);
        // Listen for window resize as clientHeight can change
        window.addEventListener('resize', checkAndUpdateScrollState);

        return () => {
            element.removeEventListener('scroll', checkAndUpdateScrollState);
            window.removeEventListener('resize', checkAndUpdateScrollState);
        };
    }, [body]); // Re-run effect if body content changes

    return (
        <div className="text-sm flex-grow h-16 relative">
            <div
                ref={contentRef}
                className="overflow-y-auto h-full scrollbar-none hover:scrollbar-thin hover:scrollbar-track-transparent hover:scrollbar-thumb-gray-300"
            >
                {paragraphs.map((paragraph, index) => (
                    <p key={index} className="mb-2 last:mb-0 text-justify">
                        {paragraph}
                    </p>
                ))}
            </div>
            {!isAtBottom && (
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none z-10"></div>
            )}
        </div>
    );
} 
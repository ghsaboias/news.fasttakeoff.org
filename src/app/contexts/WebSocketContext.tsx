'use client';

import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';

// Define the types for our news data
export interface FlashNews {
    id: string;
    mid: string;
    type: number;
    important: number;
    time: string;
    action: number;
    category: number[];
    data: {
        title: string;
        content: string;
        pic?: string;
    };
    remark?: Array<{
        id: number;
        title: string;
        type: string;
        link?: string;
    }>;
}

interface WebSocketContextType {
    newsItems: FlashNews[];
    lastJsonMessage: any;
    connectionStatus: string;
}

// Define the WebSocket message type
interface WebSocketMessage {
    type: string;
    data?: FlashNews;
    [key: string]: any;
}

// Sanitization function to prevent XSS
const sanitizeText = (text: string): string => {
    // Create a temporary DOM element
    const tempElement = document.createElement('div');
    // Set the text content (this escapes HTML)
    tempElement.textContent = text;
    // Return the sanitized text
    return tempElement.innerHTML;
};

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [newsItems, setNewsItems] = useState<FlashNews[]>([]);

    const { lastJsonMessage, readyState } = useWebSocket('wss://api.mktnews.net', {
        onOpen: () => console.log('WebSocket connection opened'),
        onClose: () => console.log('WebSocket connection closed'),
        onError: (event) => console.error('WebSocket error:', event),
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
    });

    // Connection status based on readyState
    const connectionStatusMap = {
        [ReadyState.CONNECTING]: 'Connecting',
        [ReadyState.OPEN]: 'Connected',
        [ReadyState.CLOSING]: 'Closing',
        [ReadyState.CLOSED]: 'Disconnected',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    };

    const connectionStatus = connectionStatusMap[readyState] || 'Unknown';

    useEffect(() => {
        if (lastJsonMessage) {
            const message = lastJsonMessage as WebSocketMessage;
            if (message.type === 'flash' && message.data) {
                // Type guard to ensure all required properties exist
                const newsData = message.data;
                if (!newsData.id || !newsData.data || !newsData.data.title || !newsData.data.content) {
                    console.warn('Received incomplete news data', newsData);
                    return;
                }

                setNewsItems((prev) => {
                    // Check if we already have this news item
                    const exists = prev.some(item => item.id === newsData.id);
                    if (exists) return prev;

                    // Create a sanitized copy of the news item
                    const sanitizedItem: FlashNews = {
                        id: newsData.id,
                        mid: newsData.mid,
                        type: newsData.type,
                        important: newsData.important,
                        time: newsData.time,
                        action: newsData.action,
                        category: newsData.category,
                        data: {
                            title: sanitizeText(newsData.data.title),
                            content: sanitizeText(newsData.data.content),
                            pic: newsData.data.pic
                        },
                        remark: newsData.remark
                    };

                    // Add sanitized item to the beginning of the array
                    return [sanitizedItem, ...prev].slice(0, 100); // Keep only the latest 100 items
                });
            }
        }
    }, [lastJsonMessage]);

    return (
        <WebSocketContext.Provider value={{ newsItems, lastJsonMessage, connectionStatus }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocketContext = () => {
    const context = useContext(WebSocketContext);
    if (context === undefined) {
        throw new Error('useWebSocketContext must be used within a WebSocketProvider');
    }
    return context;
}; 
/**
 * Shared fetcher for SWR and other data fetching needs.
 * Handles JSON parsing and HTTP error responses.
 */
export const fetcher = async <T = unknown>(url: string): Promise<T> => {
    const res = await fetch(url);

    if (!res.ok) {
        const error = new Error(`HTTP error ${res.status}`) as Error & { status: number };
        error.status = res.status;
        throw error;
    }

    return res.json();
};

/**
 * Fetcher with custom error messages for specific status codes.
 * Useful for user-facing error messages.
 */
export const fetcherWithMessages = (messages: Record<number, string>) => {
    return async <T = unknown>(url: string): Promise<T> => {
        const res = await fetch(url);

        if (!res.ok) {
            const message = messages[res.status] || `HTTP error ${res.status}`;
            const error = new Error(message) as Error & { status: number };
            error.status = res.status;
            throw error;
        }

        return res.json();
    };
};

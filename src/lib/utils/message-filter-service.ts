import { DISCORD } from '@/lib/config';
import type { EssentialDiscordMessage } from './message-transformer';

/**
 * Centralized message filtering service
 * Provides various filters for processing Discord messages
 */
export class MessageFilterService {
    /**
     * Filter messages by bot username and discriminator
     */
    static byBot(messages: EssentialDiscordMessage[]): EssentialDiscordMessage[] {
        return messages.filter(msg =>
            msg.author_username === DISCORD.BOT.USERNAME &&
            msg.author_discriminator === DISCORD.BOT.DISCRIMINATOR &&
            (msg.content?.includes('http') || (msg.embeds && msg.embeds.length > 0))
        );
    }

    /**
     * Filter messages by timestamp (after a given date)
     */
    static byTimeAfter(messages: EssentialDiscordMessage[], since: Date): EssentialDiscordMessage[] {
        return messages.filter(msg => new Date(msg.timestamp).getTime() >= since.getTime());
    }

    /**
     * Filter messages by timestamp (before a given date)
     */
    static byTimeBefore(messages: EssentialDiscordMessage[], until: Date): EssentialDiscordMessage[] {
        return messages.filter(msg => new Date(msg.timestamp).getTime() <= until.getTime());
    }

    /**
     * Filter messages by time range
     */
    static byTimeRange(messages: EssentialDiscordMessage[], start: Date, end: Date): EssentialDiscordMessage[] {
        const startTime = start.getTime();
        const endTime = end.getTime();
        return messages.filter(msg => {
            const msgTime = new Date(msg.timestamp).getTime();
            return msgTime >= startTime && msgTime <= endTime;
        });
    }

    /**
     * Filter messages by specific message IDs
     */
    static byIds(messages: EssentialDiscordMessage[], ids: string[]): EssentialDiscordMessage[] {
        const messagesMap = new Map(messages.map(msg => [msg.id, msg]));
        return ids.map(id => messagesMap.get(id)).filter((msg): msg is EssentialDiscordMessage => msg !== undefined);
    }

    /**
     * Remove duplicate messages based on content
     */
    static uniqueByContent(messages: EssentialDiscordMessage[]): EssentialDiscordMessage[] {
        const seen = new Set<string>();
        const keyFor = (msg: EssentialDiscordMessage): string => {
            const contentKey = msg.content?.trim();
            if (contentKey) return contentKey;
            if (msg.embeds && msg.embeds.length > 0) {
                return JSON.stringify(msg.embeds);
            }
            return JSON.stringify({}); // fallback key for messages with no content/embeds
        };

        const deduped: EssentialDiscordMessage[] = [];
        for (const msg of messages) {
            const key = keyFor(msg);
            if (!seen.has(key)) {
                seen.add(key);
                deduped.push(msg);
            }
        }
        return deduped;
    }

    /**
     * Filter messages by content keywords
     */
    static byKeywords(messages: EssentialDiscordMessage[], keywords: string[], matchAll = false): EssentialDiscordMessage[] {
        const normalizedKeywords = keywords.map(k => k.toLowerCase());
        
        return messages.filter(msg => {
            const content = (msg.content || '').toLowerCase();
            const embedText = msg.embeds?.map(e => 
                `${e.title || ''} ${e.description || ''}`
            ).join(' ').toLowerCase() || '';
            
            const fullText = `${content} ${embedText}`;
            
            if (matchAll) {
                return normalizedKeywords.every(keyword => fullText.includes(keyword));
            } else {
                return normalizedKeywords.some(keyword => fullText.includes(keyword));
            }
        });
    }

    /**
     * Filter messages by author
     */
    static byAuthor(messages: EssentialDiscordMessage[], authorUsername: string): EssentialDiscordMessage[] {
        return messages.filter(msg => 
            msg.author_username?.toLowerCase() === authorUsername.toLowerCase()
        );
    }

    /**
     * Filter messages that have embeds
     */
    static withEmbeds(messages: EssentialDiscordMessage[]): EssentialDiscordMessage[] {
        return messages.filter(msg => msg.embeds && msg.embeds.length > 0);
    }

    /**
     * Filter messages that have attachments
     */
    static withAttachments(messages: EssentialDiscordMessage[]): EssentialDiscordMessage[] {
        return messages.filter(msg => msg.attachments && msg.attachments.length > 0);
    }

    /**
     * Filter messages by length (useful for filtering out very short or very long messages)
     */
    static byContentLength(messages: EssentialDiscordMessage[], minLength = 0, maxLength = Infinity): EssentialDiscordMessage[] {
        return messages.filter(msg => {
            const contentLength = msg.content?.length || 0;
            return contentLength >= minLength && contentLength <= maxLength;
        });
    }

    /**
     * Filter messages that are replies to other messages
     */
    static repliesOnly(messages: EssentialDiscordMessage[]): EssentialDiscordMessage[] {
        return messages.filter(msg => msg.referenced_message_content);
    }

    /**
     * Filter messages that are not replies (original messages)
     */
    static originalOnly(messages: EssentialDiscordMessage[]): EssentialDiscordMessage[] {
        return messages.filter(msg => !msg.referenced_message_content);
    }

    /**
     * Advanced filter with multiple criteria
     */
    static advanced(messages: EssentialDiscordMessage[], criteria: {
        authors?: string[];
        keywords?: string[];
        keywordMatchAll?: boolean;
        hasEmbeds?: boolean;
        hasAttachments?: boolean;
        minLength?: number;
        maxLength?: number;
        startDate?: Date;
        endDate?: Date;
        repliesOnly?: boolean;
        originalOnly?: boolean;
    }): EssentialDiscordMessage[] {
        let filtered = [...messages];

        if (criteria.authors?.length) {
            filtered = filtered.filter(msg => 
                criteria.authors!.some(author => 
                    msg.author_username?.toLowerCase() === author.toLowerCase()
                )
            );
        }

        if (criteria.keywords?.length) {
            filtered = this.byKeywords(filtered, criteria.keywords, criteria.keywordMatchAll);
        }

        if (criteria.hasEmbeds !== undefined) {
            filtered = criteria.hasEmbeds ? this.withEmbeds(filtered) : filtered.filter(msg => !msg.embeds?.length);
        }

        if (criteria.hasAttachments !== undefined) {
            filtered = criteria.hasAttachments ? this.withAttachments(filtered) : filtered.filter(msg => !msg.attachments?.length);
        }

        if (criteria.minLength !== undefined || criteria.maxLength !== undefined) {
            filtered = this.byContentLength(filtered, criteria.minLength, criteria.maxLength);
        }

        if (criteria.startDate || criteria.endDate) {
            if (criteria.startDate && criteria.endDate) {
                filtered = this.byTimeRange(filtered, criteria.startDate, criteria.endDate);
            } else if (criteria.startDate) {
                filtered = this.byTimeAfter(filtered, criteria.startDate);
            } else if (criteria.endDate) {
                filtered = this.byTimeBefore(filtered, criteria.endDate);
            }
        }

        if (criteria.repliesOnly) {
            filtered = this.repliesOnly(filtered);
        } else if (criteria.originalOnly) {
            filtered = this.originalOnly(filtered);
        }

        return filtered;
    }

    /**
     * Chain multiple filters together
     */
    static chain(messages: EssentialDiscordMessage[], ...filters: Array<(msgs: EssentialDiscordMessage[]) => EssentialDiscordMessage[]>): EssentialDiscordMessage[] {
        return filters.reduce((currentMessages, filter) => filter(currentMessages), messages);
    }
}

export interface TestDataOptions {
    baseTime?: Date;
    messagesWithinHour?: boolean;
}

export function createTestData(options: TestDataOptions = {}) {
    const baseTime = options.baseTime || new Date();
    const messagesWithinHour = options.messagesWithinHour ?? true;

    // Create timestamps that are always within the last hour by default
    const message1Time = messagesWithinHour
        ? new Date(baseTime.getTime() - 30 * 60 * 1000) // 30 minutes ago
        : new Date(baseTime.getTime() - 90 * 60 * 1000); // 90 minutes ago (outside 1 hour window)

    const message2Time = new Date(baseTime.getTime() - 10 * 60 * 1000); // 10 minutes ago

    return {
        channels: [
            {
                id: "1179003366362329138",
                name: "🔵test-channel",
                type: 0
            },
            {
                id: "1179003366362329139",
                name: "🟡breaking-news",
                type: 0
            }
        ],
        messages: [
            {
                id: "1234567890123456789",
                channel_id: "1179003366362329138",
                author: {
                    id: "123456789012345678",
                    username: "FaytuksBot",
                    discriminator: "7032"
                },
                content: "Breaking news: https://example.com/news",
                timestamp: message1Time.toISOString(),
                embeds: [
                    {
                        title: "Major Economic Policy Announced",
                        description: "Government announces new economic measures",
                        url: "https://example.com/news"
                    }
                ]
            },
            {
                id: "1234567890123456790",
                channel_id: "1179003366362329138",
                author: {
                    id: "123456789012345678",
                    username: "FaytuksBot",
                    discriminator: "7032"
                },
                content: "Follow-up report: https://example.com/update",
                timestamp: message2Time.toISOString(),
                embeds: [
                    {
                        title: "Policy Implementation Details",
                        description: "Additional details on the economic measures",
                        url: "https://example.com/update"
                    }
                ]
            }
        ],
        reports: [
            {
                reportId: "report_123456789",
                channelId: "1179003366362329138",
                channelName: "🔵test-channel",
                headline: "ECONOMIC POLICY REFORM ANNOUNCED",
                city: "Brasília",
                body: "Government officials announced comprehensive economic policy reforms today.\n\nThe measures include new fiscal guidelines and regulatory changes.",
                messageCount: 2,
                messageIds: ["1234567890123456789", "1234567890123456790"],
                generatedAt: baseTime.toISOString(),
                timeframe: "2h" as const
            }
        ],
        executiveOrders: [
            {
                document_number: "2025-00001",
                title: "Executive Order on Test Policy",
                signing_date: "2025-06-01",
                executive_order_number: 15001,
                abstract: "Test executive order for unit testing",
                body_html: "<p>This is a test executive order.</p>",
                html_url: "https://federalregister.gov/test",
                pdf_url: "https://federalregister.gov/test.pdf",
                agencies: [
                    {
                        id: 1,
                        name: "Executive Office of the President",
                        url: "https://www.whitehouse.gov"
                    }
                ]
            }
        ]
    };
}

// Helper to create messages with specific time relationships
export function createMessagesWithTimeRelation(baseTime: Date = new Date()) {
    return {
        // Message older than 1 hour
        oldMessage: {
            id: "old_message_id",
            channel_id: "1179003366362329138",
            author: {
                id: "123456789012345678",
                username: "FaytuksBot",
                discriminator: "7032"
            },
            content: "Old news: https://example.com/old",
            timestamp: new Date(baseTime.getTime() - 90 * 60 * 1000).toISOString(), // 90 minutes ago
            embeds: [{ title: "Old News", description: "This is old", url: "https://example.com/old" }]
        },
        // Message within 1 hour
        recentMessage: {
            id: "recent_message_id",
            channel_id: "1179003366362329138",
            author: {
                id: "123456789012345678",
                username: "FaytuksBot",
                discriminator: "7032"
            },
            content: "Recent news: https://example.com/recent",
            timestamp: new Date(baseTime.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
            embeds: [{ title: "Recent News", description: "This is recent", url: "https://example.com/recent" }]
        }
    };
} 
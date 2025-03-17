"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { DiscordMessage } from "@/lib/types/core";
import MessageItem from "./MessageItem";

interface MessagesAccordionProps {
    channelDataForMessages: {
        count: number;
        messages: DiscordMessage[];
        loading: boolean
    } | undefined;
    channelMessages?: DiscordMessage[];
}

export default function MessagesAccordion({ channelDataForMessages, channelMessages = [] }: MessagesAccordionProps) {
    const data = channelDataForMessages;
    const messages = data?.messages.length ? data.messages : channelMessages;
    const count = data?.count || channelMessages.length;
    const loading = data?.loading || false;

    if (messages.length) {
        return (
            <div className="mt-4">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="messages">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer bg-muted px-4">
                            <div className="flex items-center gap-2">
                                Sources
                                <Badge variant="secondary" className="ml-2">
                                    {messages.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-4">
                                <Accordion type="single" collapsible className="w-full">
                                    {messages.map((message, index) => (
                                        <MessageItem
                                            key={message.id}
                                            message={message}
                                            index={index}
                                        />
                                    ))}
                                </Accordion>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        );
    } else if (count === 0 && !loading) {
        return (
            <div className="mt-4 p-4 bg-muted/50 text-muted-foreground rounded-lg">
                No messages found
            </div>
        );
    }
    return null;
} 
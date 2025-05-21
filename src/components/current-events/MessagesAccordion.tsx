"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/ui/loader";
import { DiscordMessage } from "@/lib/types/core";
import MessageItem from "./MessageItem";

interface MessagesAccordionProps {
    channelData: {
        count: number;
        messages: DiscordMessage[];
        loading: boolean
    } | undefined;
    channelMessages?: DiscordMessage[];
    isLoading: boolean;
}

export default function MessagesAccordion({ channelData, channelMessages = [], isLoading }: MessagesAccordionProps) {
    const data = channelData;
    const messages = data?.messages.length ? data.messages : channelMessages;
    const count = data?.count || channelMessages.length;

    if (messages.length) {
        return (
            <div>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="messages">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer bg-secondary px-4 hover:bg-secondary-hover">
                            <div className="flex items-center gap-2">
                                Sources
                                <Badge variant="secondary" className="ml-2 bg-transparent">
                                    {messages.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                            <div className="space-y-4">
                                <Accordion type="multiple" className="w-full">
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
    } else if (isLoading) {
        return (
            <div className="mt-4 p-4 bg-muted-light text-muted-foreground rounded-lg flex items-center justify-center">
                <Loader size="md" />
            </div>
        );
    } else if (count === 0 && !isLoading) {
        return (
            <div className="mt-4 p-4 bg-muted-light text-muted-foreground rounded-lg">
                No messages found
            </div>
        );
    }
    return null;
} 
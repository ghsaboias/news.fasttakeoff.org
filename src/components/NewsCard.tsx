'use client';

import { FlashNews } from '@/app/contexts/WebSocketContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

interface NewsCardProps {
    news: FlashNews;
}

interface RemarkItem {
    id: number;
    title: string;
    type: string;
    link?: string;
}

export function NewsCard({ news }: NewsCardProps) {
    const formattedDate = format(new Date(news.time), 'MMM dd, yyyy HH:mm:ss');

    // Function to render HTML content safely
    const createMarkup = (htmlContent: string) => {
        return { __html: htmlContent };
    };

    return (
        <Card className="w-full mb-4 overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-bold">{news.data.title || 'Breaking News'}</CardTitle>
                        <CardDescription>{formattedDate}</CardDescription>
                    </div>
                    {news.important === 1 && (
                        <Badge variant="destructive" className="ml-2">Important</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pb-2">
                {news.data.pic && (
                    <div className="mb-4 overflow-hidden rounded-md">
                        <img
                            src={news.data.pic}
                            alt={news.data.title || 'News image'}
                            className="w-full h-auto object-cover"
                        />
                    </div>
                )}
                <div
                    className="text-sm text-card-foreground prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={createMarkup(news.data.content)}
                />
            </CardContent>
            {news.remark && news.remark.length > 0 && (
                <CardFooter className="pt-0 flex flex-wrap gap-2">
                    {news.remark.map((remark: RemarkItem) => (
                        remark.link ? (
                            <Button
                                key={remark.id}
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <a href={remark.link} target="_blank" rel="noopener noreferrer">
                                    {remark.title}
                                </a>
                            </Button>
                        ) : (
                            <Badge key={remark.id} variant="outline">
                                {remark.title}
                            </Badge>
                        )
                    ))}
                </CardFooter>
            )}
        </Card>
    );
} 
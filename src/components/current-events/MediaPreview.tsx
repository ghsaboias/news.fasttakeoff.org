"use client";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Image from "next/image";
interface MediaPreviewProps {
    url: string;
    type: 'image' | 'video';
    contentType?: string;
    alt?: string;
}

export default function MediaPreview({ url, type, contentType, alt }: MediaPreviewProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="cursor-pointer w-full aspect-video bg-muted rounded-lg overflow-hidden">
                    {type === 'image' ? (
                        <Image
                            src={url}
                            alt={alt || 'Media content'}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                            width={1000}
                            height={1000}
                            unoptimized={url.includes('discordapp.com')}
                        />
                    ) : (
                        <video className="w-full h-full object-cover hover:scale-105 transition-transform">
                            <source src={url} type={contentType} />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-7xl w-full p-0 bg-transparent border-0 [&>button]:hidden" aria-describedby={undefined}>
                <VisuallyHidden>
                    <DialogTitle>{alt || 'Media content'}</DialogTitle>
                </VisuallyHidden>
                <div className="relative w-full h-full flex items-center justify-center">
                    {type === 'image' ? (
                        <Image
                            src={url}
                            alt={alt || 'Media content'}
                            className="max-h-[90vh] max-w-full object-contain rounded-lg"
                            width={1000}
                            height={1000}
                            unoptimized={url.includes('discordapp.com')}
                        />
                    ) : (
                        <video controls className="max-h-[90vh] max-w-full rounded-lg">
                            <source src={url} type={contentType} />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
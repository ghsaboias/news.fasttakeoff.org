import { Button } from "@/components/ui/button";
import { DiscordChannel, Report } from "@/lib/types/core";
import { getCacheContext } from "@/lib/utils";
import Link from "next/link";

interface ChannelDetailClientProps {
    channel: DiscordChannel;
    reports: Report[] | null;
}

export default function ChannelDetailClient({ channel, reports }: ChannelDetailClientProps) {
    const { env } = getCacheContext();

    return (
        <div className="p-6 max-w-5xl mx-auto gap-4 flex flex-col">
            <h3 className="text-xl font-bold tracking-tight">{channel.name}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {reports?.map((report) => (
                    <div className="border border-gray-200 rounded-lg p-4 overflow-scroll gap-2 flex flex-col" key={report.timestamp}>
                        <h1 className="text-2xl font-bold">{report.headline.toUpperCase()}</h1>
                        <h2 className="text-lg font-medium text-muted-foreground">{report.city}</h2>
                        <div className="prose prose-zinc max-w-none overflow-y-auto">
                            {report.body.slice(0, 100)}...
                        </div>
                        <Link href={`/current-events/${channel.id}/${report.timestamp}`}>
                            <Button>
                                Read More
                            </Button>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
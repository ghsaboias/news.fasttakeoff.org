import { ExecutiveOrder } from "@/lib/types/core";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

export default function OrderCard({ order }: { order: ExecutiveOrder }) {
    return (
        <Card key={order.id}>
            <CardHeader>
                <CardTitle className="line-clamp-2">{order.title}</CardTitle>
                <CardDescription>
                    {formatDate(order.publication.publicationDate || order.date)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="line-clamp-3 text-sm text-muted-foreground">
                    {order.summary && !order.summary.includes('undefined') && !order.summary.includes('NaN')
                        ? order.summary
                        : `Executive Order published on ${formatDate(order.publication.publicationDate || order.date)}`}
                </p>
            </CardContent>
            <CardFooter>
                <Button asChild variant="outline" size="sm">
                    <Link href={`/executive-orders/${order.id}`}>Read more</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
import { ExecutiveOrder } from "@/lib/types/executive-orders";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "../ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

export default function OrderCard({ order }: { order: ExecutiveOrder }) {
    return (
        <Card key={order.id} className="gap-4">
            <CardHeader>
                <CardTitle className="line-clamp-4 min-h-[55px]">{order.title}</CardTitle>
                <CardDescription className="text-xs">
                    {order.category} - {formatDate(order.publication.publicationDate || order.date)}
                </CardDescription>
            </CardHeader>
            <CardFooter>
                <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/executive-orders/${order.id}`}>Read more</Link>
                </Button>
            </CardFooter>
        </Card>
    )
}
import Link from "next/link";
import { Badge } from "../ui/badge";

interface BadgeLinkProps {
    href: string;
    children: React.ReactNode;
    variant?: "default" | "outline" | "secondary" | "destructive";
    className?: string;
}

export default function BadgeLink({ href, children, variant = "default", className }: BadgeLinkProps) {
    return (
        <Badge asChild variant={variant} className={className}>
            <Link href={href}>{children}</Link>
        </Badge>
    )
}


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
        <Link href={href}>
            <Badge variant={variant} className={className}>{children}</Badge>
        </Link>
    )
}


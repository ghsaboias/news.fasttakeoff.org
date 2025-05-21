import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

const sizeMap = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
    xl: "h-10 w-10",
};

export function Loader({ size = "md", className, ...props }: LoaderProps) {
    return (
        <div {...props}>
            <Loader2
                className={cn(
                    "animate-spin text-primary",
                    sizeMap[size],
                    className
                )}
            />
        </div>
    );
} 
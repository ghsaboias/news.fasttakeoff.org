import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// const isProtectedRoute = createRouteMatcher(["/current-events(.*)", "/executive-orders(.*)"]);
const isProtectedRoute = createRouteMatcher([]);

const ALLOWED_ORIGINS = [
    "https://my-game.gsaboia.workers.dev",
    "http://localhost:8787",
    "http://localhost:8000",
    "http://localhost:3000",
];

const CORS_HEADERS = {
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
};

export default clerkMiddleware(
    async (auth, req) => {
        const origin = req.headers.get("origin");
        const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
        const isAllowedOrigin = origin && ALLOWED_ORIGINS.includes(origin);

        // Handle CORS preflight for API routes
        if (isApiRoute && req.method === "OPTIONS") {
            return new NextResponse(null, {
                status: 204,
                headers: {
                    ...(isAllowedOrigin && { "Access-Control-Allow-Origin": origin }),
                    ...CORS_HEADERS,
                },
            });
        }

        if (isProtectedRoute(req)) {
            await auth.protect();
        }

        // Add CORS headers to API responses for allowed origins
        if (isApiRoute && isAllowedOrigin) {
            const response = NextResponse.next();
            response.headers.set("Access-Control-Allow-Origin", origin);
            Object.entries(CORS_HEADERS).forEach(([key, value]) => {
                response.headers.set(key, value);
            });
            return response;
        }
    },
    { signInUrl: "/sign-in", signUpUrl: "/sign-up" }
);

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
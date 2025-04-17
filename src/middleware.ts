import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Match only the protected routes
const isProtectedRoute = createRouteMatcher(["/current-events(.*)", "/executive-orders(.*)"]);

export default clerkMiddleware(
    async (auth, req) => {
        if (isProtectedRoute(req)) {
            await auth.protect();
        }
    },
    { signInUrl: '/sign-in', signUpUrl: '/sign-up' }
);

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};